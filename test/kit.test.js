import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import AdmZip from 'adm-zip';
import { buildZip, exportKit } from '../cnlp-kit/export.mjs';
import { bodyIssues, readProfile } from '../src/artifacts/cnlp.js';

// The kit exports the live files, so this asserts the export lands a working set — not that
// the kit's own copy of anything is correct, because it holds no copy.

const target = async () => mkdtemp(path.join(os.tmpdir(), 'cnlp-kit-'));
const repoRoot = () => path.resolve(path.dirname(new URL(import.meta.url).pathname.slice(1)), '..');

// The kit occupies 2 entries at the target root: `cnlp/` holds everything it brings, and
// `cnlp-migrate/` is moved into whichever agent runs it. Deleting `cnlp/` cleans up.
const SET = [
  'cnlp/cnlp-format.md', 'cnlp/profiles/profile.md', 'cnlp/profiles/skill.md',
  'cnlp/cnlp.js', 'cnlp/skill-format.test.js', 'cnlp/quality-rules.md',
  'cnlp-migrate/SKILL.md',
];

test('the export lands every file of the documented set, and nothing else at the root', async () => {
  const dir = await target();
  const { written } = await exportKit(dir);
  for (const f of SET) {
    assert.ok(written.includes(f), `${f} was not written`);
    assert.ok(existsSync(path.join(dir, f)), `${f} is missing on disk`);
  }
  const roots = [...new Set(written.map((f) => f.split('/')[0]))].sort();
  assert.deepEqual(roots, ['cnlp', 'cnlp-migrate'], 'the kit scattered files at the root');
});

test('the exported checker resolves the exported documents', async () => {
  const dir = await target();
  await exportKit(dir);
  // The standard and the profiles sit beside the checker now, so `resolveDoc` was retargeted.
  // This asserts the rewrite instead of trusting it.
  const mod = await import(pathToFileURL(path.join(dir, 'cnlp/cnlp.js')).href);
  for (const name of ['format', 'skill', 'profile']) {
    assert.ok(existsSync(mod.resolveDoc(name)), `${name} does not resolve from the exported checker`);
  }
});

test('the exported migration skill conforms to the exported profile', async () => {
  const dir = await target();
  await exportKit(dir);
  const profile = readProfile(await readFile(path.join(dir, 'cnlp/profiles/skill.md'), 'utf8'));
  const body = await readFile(path.join(dir, 'cnlp-migrate/SKILL.md'), 'utf8');
  // A migration skill that breaks the format it teaches is worthless.
  assert.deepEqual(bodyIssues(body, profile).map((i) => `${i.line}: ${i.message}`), []);
  // The profile's `format:` is read from the project root, where `cnlp/` was copied.
  assert.ok(existsSync(path.join(dir, profile.format)), `format ${JSON.stringify(profile.format)} does not resolve`);
});

test('the exported test points at the exported checker and skills, without our packaging guard', async () => {
  const dir = await target();
  await exportKit(dir, { skillsDir: 'agents/skills' });
  const src = await readFile(path.join(dir, 'cnlp/skill-format.test.js'), 'utf8');
  assert.match(src, /'\.\/cnlp\.js'/);
  // One line to edit when the target keeps skills somewhere else, which the README names.
  assert.match(src, /^const SKILLS_DIR = 'agents\/skills';/m);
  assert.doesNotMatch(src, /cites a shipped document by path/, 'the package-only guard travelled');
  assert.doesNotMatch(src, /cnlp-kit:strip/, 'the strip markers travelled');
});

// The archive is the delivery: someone copies it into another repository and unpacks it at
// the root. These assertions are that scenario, without a path back to this repository.
test('the archive unpacks into a working kit', async () => {
  const dir = await target();
  const out = path.join(dir, 'cnlp-kit.zip');
  const { entries } = await buildZip(out);
  assert.ok(existsSync(out), 'no archive written');

  const packed = new AdmZip(out).getEntries().filter((e) => !e.isDirectory).map((e) => e.entryName).sort();
  assert.deepEqual(packed, [...entries].sort(), 'the archive and the exported set differ');
  assert.ok(packed.includes('cnlp/README.md'), 'no README to start from');

  const unpacked = await target();
  new AdmZip(out).extractAllTo(unpacked, true);

  const readme = await readFile(path.join(unpacked, 'cnlp/README.md'), 'utf8');
  const { version } = JSON.parse(await readFile(path.join(repoRoot(), 'package.json'), 'utf8'));
  assert.match(readme, new RegExp(version.replace(/\./g, '\\.')), 'the README does not name the version it came from');

  // No runtime owns the skill folder, and the kit occupies 2 entries at the root, not 7.
  assert.ok(packed.includes('cnlp-migrate/SKILL.md'), 'the skill is not at the top level');
  assert.ok(!packed.some((f) => f.startsWith('.claude/')), 'the archive names a runtime');
  assert.deepEqual([...new Set(packed.map((f) => f.split('/')[0]))].sort(), ['cnlp', 'cnlp-migrate']);

  // The unpacked kit checks a corpus at the project root, from inside `cnlp/`.
  const test = await readFile(path.join(unpacked, 'cnlp/skill-format.test.js'), 'utf8');
  assert.match(test, /'\.\/cnlp\.js'/);
  await mkdir(path.join(unpacked, 'skills'), { recursive: true });
  await cp(path.join(unpacked, 'cnlp-migrate'), path.join(unpacked, 'skills/cnlp-migrate'), { recursive: true });
  execFileSync(process.execPath, ['--test', 'cnlp/skill-format.test.js'], { cwd: unpacked, stdio: 'pipe' });
});

test('--no-test omits the test, and an authored profile survives re-export', async () => {
  const dir = await target();
  await exportKit(dir, { test: false });
  assert.ok(!existsSync(path.join(dir, 'cnlp/skill-format.test.js')), 'test was written anyway');

  const profile = path.join(dir, 'cnlp/profiles/skill.md');
  await writeFile(profile, `${await readFile(profile, 'utf8')}\n# authored here\n`, 'utf8');
  const { skipped } = await exportKit(dir);
  assert.ok(skipped.includes('cnlp/profiles/skill.md'), 'an authored profile was overwritten');
  assert.match(await readFile(profile, 'utf8'), /# authored here/);

  const forced = await exportKit(dir, { force: true });
  assert.ok(forced.written.includes('cnlp/profiles/skill.md'), '--force did not overwrite');
});
