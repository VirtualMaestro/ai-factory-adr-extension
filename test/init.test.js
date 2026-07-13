import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { init } from '../src/init.js';
import { STATUS_DIRS } from '../src/config/paths.js';

const tmp = () => mkdtemp(path.join(os.tmpdir(), 'adr-init-'));

test('init creates the five status dirs and the config, reporting created', async () => {
  const dir = await tmp();
  const { items } = await init(dir);

  for (const d of STATUS_DIRS) assert.ok(existsSync(path.join(dir, 'docs/adr', d)), `missing ${d}`);
  assert.ok(existsSync(path.join(dir, '.ai-factory/adr-extension.yaml')));
  assert.equal(items.filter((i) => i.status === 'created').length, STATUS_DIRS.length + 1);
});

test('init is idempotent — second run reports present and does not overwrite config', async () => {
  const dir = await tmp();
  await init(dir);
  const cfgFile = path.join(dir, '.ai-factory/adr-extension.yaml');
  await writeFile(cfgFile, 'version: 1\n# user edit\n', 'utf8'); // simulate user customization
  const before = await readFile(cfgFile, 'utf8');

  const { items } = await init(dir);

  assert.ok(items.every((i) => i.status === 'present'), 'expected all present on re-run');
  assert.equal(await readFile(cfgFile, 'utf8'), before, 'config must not be overwritten');
});

test('init honors a relocated adr.root from the config', async () => {
  const dir = await tmp();
  await mkdir(path.join(dir, '.ai-factory'), { recursive: true });
  await writeFile(path.join(dir, '.ai-factory/adr-extension.yaml'), 'version: 1\nadr:\n  root: docs/decisions\n', 'utf8');

  await init(dir);

  assert.ok(existsSync(path.join(dir, 'docs/decisions/proposals')));
  assert.ok(!existsSync(path.join(dir, 'docs/adr')));
  assert.ok((await stat(path.join(dir, 'docs/decisions/active'))).isDirectory());
});
