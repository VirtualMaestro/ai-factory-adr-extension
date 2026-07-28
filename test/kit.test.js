import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { exportKit } from '../cnlp-kit/export.mjs';
import { bodyIssues, readProfile } from '../src/artifacts/cnlp.js';

// The kit exports the live files, so this asserts the export lands a working set — not that
// the kit's own copy of anything is correct, because it holds no copy.

const target = async () => mkdtemp(path.join(os.tmpdir(), 'cnlp-kit-'));

test('the export lands every file of the documented set', async () => {
  const dir = await target();
  const { written } = await exportKit(dir, { skillsDir: 'skills' });
  for (const f of [
    'docs/cnlp-format.md', 'profiles/profile.md', 'profiles/skill.md',
    'tools/cnlp/cnlp.js', 'test/skill-format.test.js',
    'docs/cnlp-quality-rules.md', 'skills/cnlp-migrate/SKILL.md',
  ]) {
    assert.ok(written.includes(f), `${f} was not written`);
    assert.ok(existsSync(path.join(dir, f)), `${f} is missing on disk`);
  }
});

test('the exported checker resolves the exported documents', async () => {
  const dir = await target();
  await exportKit(dir, { skillsDir: 'skills' });
  // `tools/cnlp/` is 2 levels deep, as `src/artifacts/` is here, so `../../` still lands on
  // the root. This asserts that depth claim instead of trusting it.
  const mod = await import(pathToFileURL(path.join(dir, 'tools/cnlp/cnlp.js')).href);
  for (const name of ['format', 'skill', 'profile']) {
    assert.ok(existsSync(mod.resolveDoc(name)), `${name} does not resolve from the exported checker`);
  }
});

test('the exported migration skill conforms to the exported profile', async () => {
  const dir = await target();
  await exportKit(dir, { skillsDir: 'skills' });
  const profile = readProfile(await readFile(path.join(dir, 'profiles/skill.md'), 'utf8'));
  const body = await readFile(path.join(dir, 'skills/cnlp-migrate/SKILL.md'), 'utf8');
  // A migration skill that breaks the format it teaches is worthless.
  assert.deepEqual(bodyIssues(body, profile).map((i) => `${i.line}: ${i.message}`), []);
});

test('the exported test points at the exported checker and skills, without our packaging guard', async () => {
  const dir = await target();
  await exportKit(dir, { skillsDir: '.claude/skills' });
  const src = await readFile(path.join(dir, 'test/skill-format.test.js'), 'utf8');
  assert.match(src, /'\.\.\/tools\/cnlp\/cnlp\.js'/);
  assert.match(src, /path\.join\(repoRoot, '\.claude\/skills'\)/);
  assert.doesNotMatch(src, /cites a shipped document by path/, 'the package-only guard travelled');
  assert.doesNotMatch(src, /cnlp-kit:strip/, 'the strip markers travelled');
});

test('--no-test omits the test, and an authored profile survives re-export', async () => {
  const dir = await target();
  await exportKit(dir, { skillsDir: 'skills', test: false });
  assert.ok(!existsSync(path.join(dir, 'test/skill-format.test.js')), 'test was written anyway');

  const profile = path.join(dir, 'profiles/skill.md');
  await writeFile(profile, `${await readFile(profile, 'utf8')}\n# authored here\n`, 'utf8');
  const { skipped } = await exportKit(dir, { skillsDir: 'skills' });
  assert.ok(skipped.includes('profiles/skill.md'), 'an authored profile was overwritten');
  assert.match(await readFile(profile, 'utf8'), /# authored here/);

  const forced = await exportKit(dir, { skillsDir: 'skills', force: true });
  assert.ok(forced.written.includes('profiles/skill.md'), '--force did not overwrite');
});
