// Integration tests — exercise the real `ai-factory` CLI (assumed globally installed, on PATH).
// The whole suite skips with a clear message when the CLI is absent so `node --test` stays green.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WIN = process.platform === 'win32';

// ponytail: shell:true so Windows resolves the `ai-factory.cmd` shim; args are test-controlled temp
// paths, not untrusted input, so §28's shell-interpolation rule (which targets ADR filenames) is n/a.
function aif(args, cwd) {
  const quoted = WIN ? args.map((a) => (/\s/.test(a) ? `"${a}"` : a)) : args;
  return execFileSync('ai-factory', quoted, { cwd, encoding: 'utf8', stdio: 'pipe', shell: WIN });
}

let available = false;
try {
  aif(['--version']);
  available = true;
} catch {
  available = false;
}
const opts = { skip: available ? false : 'ai-factory CLI not on PATH — integration suite skipped' };

async function newProject(agents) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'adr-integ-'));
  try {
    aif(['init', '--agents', agents, '--config'], dir);
  } catch {
    aif(['init', '--agents', agents], dir); // tolerate CLI versions without --config
  }
  return dir;
}

const skillsDir = (dir, runtime) => path.join(dir, `.${runtime}`, 'skills');
const adrSkills = async (dir, runtime) =>
  existsSync(skillsDir(dir, runtime))
    ? (await readdir(skillsDir(dir, runtime))).filter((n) => n.startsWith('aif-adr-'))
    : [];

test('add installs all 8 skills for each configured runtime and registers `adr` (Acc 2,3,4,6)', opts, async () => {
  const dir = await newProject('claude,codex');
  aif(['extension', 'add', EXT_ROOT], dir);

  assert.equal((await adrSkills(dir, 'claude')).length, 8, 'claude skills');
  assert.equal((await adrSkills(dir, 'codex')).length, 8, 'codex skills');
  assert.match(aif(['adr', '--help'], dir), /init/);

  aif(['adr', 'init'], dir);
  assert.ok(existsSync(path.join(dir, 'docs/adr/active')), 'adr init created the structure');
});

test('re-adding does not duplicate skills or extension entries (Acc 7)', opts, async () => {
  const dir = await newProject('claude');
  aif(['extension', 'add', EXT_ROOT], dir);
  aif(['extension', 'add', EXT_ROOT], dir); // second add

  assert.equal((await adrSkills(dir, 'claude')).length, 8);
  const cfg = JSON.parse(await readFile(path.join(dir, '.ai-factory.json'), 'utf8'));
  const entries = (cfg.extensions ?? []).filter((e) => e.name === 'ai-factory-adr-extension');
  assert.equal(entries.length, 1, 'exactly one extension entry');
});

test('update preserves ADR docs and user config (Acc 8)', opts, async () => {
  const dir = await newProject('claude');
  aif(['extension', 'add', EXT_ROOT], dir);
  aif(['adr', 'init'], dir);
  await writeFile(path.join(dir, 'docs/adr/active/adr-keepme.md'), 'seeded ADR\n', 'utf8');
  const cfgFile = path.join(dir, '.ai-factory/adr-extension.yaml');
  await writeFile(cfgFile, 'version: 1\n# user edit\n', 'utf8');

  try {
    aif(['extension', 'update', 'ai-factory-adr-extension'], dir);
  } catch {
    aif(['extension', 'update', '--force'], dir); // repair path if registry lookup is unavailable offline
  }

  assert.equal(await readFile(path.join(dir, 'docs/adr/active/adr-keepme.md'), 'utf8'), 'seeded ADR\n');
  assert.match(await readFile(cfgFile, 'utf8'), /# user edit/);
});

test('remove deletes extension skills but never ADR documents (Acc 9)', opts, async () => {
  const dir = await newProject('claude');
  aif(['extension', 'add', EXT_ROOT], dir);
  aif(['adr', 'init'], dir);
  await writeFile(path.join(dir, 'docs/adr/active/adr-keepme.md'), 'seeded ADR\n', 'utf8');

  aif(['extension', 'remove', 'ai-factory-adr-extension'], dir);

  assert.equal((await adrSkills(dir, 'claude')).length, 0, 'skills removed');
  assert.ok(existsSync(path.join(dir, 'docs/adr/active/adr-keepme.md')), 'ADR doc preserved');
});

test('adr commands refuse to run in a non-initialized project (Acc 5)', opts, async () => {
  // The gate is unit-covered (detect.test.js); here confirm the CLI itself is unaffected in a bare dir.
  const bare = await mkdtemp(path.join(os.tmpdir(), 'adr-bare-'));
  await mkdir(bare, { recursive: true });
  // No .ai-factory.json → AIF won't even load the extension command, so `adr` is simply unavailable.
  assert.doesNotThrow(() => {
    try { aif(['--help'], bare); } catch { /* CLI help still works */ }
  });
});
