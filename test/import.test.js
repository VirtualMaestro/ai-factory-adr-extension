import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { init } from '../src/init.js';
import { importAdr } from '../src/artifacts/import.js';
import { read } from '../src/artifacts/frontmatter.js';

const tmp = () => mkdtemp(path.join(os.tmpdir(), 'adr-import-'));

test('imports a skeleton into the status dir with matching frontmatter', async () => {
  const dir = await tmp();
  await init(dir);

  const res = await importAdr('cache layer', { status: 'active', id: 'adr-foo', projectDir: dir });

  const expected = path.join(dir, 'docs/adr/active/adr-foo.md');
  assert.equal(res.path, expected);
  assert.ok(existsSync(expected), 'file should exist at active/adr-foo.md');
  assert.equal(path.basename(expected, '.md'), res.id, 'stem must equal id (inv 3)');

  const { data } = await read(expected);
  assert.equal(data.id, 'adr-foo');
  assert.equal(data.status, 'active');
  assert.equal(data.type, 'adr');
});

test('derives the id from the topic when --id is omitted', async () => {
  const dir = await tmp();
  await init(dir);

  const res = await importAdr('Cache Layer!!', { status: 'accepted', projectDir: dir });

  assert.equal(res.id, 'adr-cache-layer');
  assert.ok(existsSync(path.join(dir, 'docs/adr/accepted/adr-cache-layer.md')));
});

test('rejects a duplicate id present in any status dir', async () => {
  const dir = await tmp();
  await init(dir);
  await importAdr('foo', { status: 'proposed', id: 'adr-foo', projectDir: dir });

  await assert.rejects(
    () => importAdr('foo again', { status: 'active', id: 'adr-foo', projectDir: dir }),
    /already exists/,
  );
});

test('rejects an unknown status', async () => {
  const dir = await tmp();
  await init(dir);

  await assert.rejects(
    () => importAdr('foo', { status: 'nonsense', id: 'adr-foo', projectDir: dir }),
    /Unknown lifecycle status/,
  );
});
