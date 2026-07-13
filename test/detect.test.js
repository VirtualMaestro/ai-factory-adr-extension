import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { detectAif, AifError } from '../src/aif/detect.js';

const tmp = () => mkdtemp(path.join(os.tmpdir(), 'adr-detect-'));
const marker = (dir, obj) => writeFile(path.join(dir, '.ai-factory.json'), JSON.stringify(obj), 'utf8');

test('non-initialized project throws an actionable AifError', async () => {
  const dir = await tmp();
  await assert.rejects(detectAif(dir), (e) => e instanceof AifError && /ai-factory init/.test(e.message));
});

test('compatible version passes and is returned', async () => {
  const dir = await tmp();
  await marker(dir, { version: '2.17.0' });
  assert.equal(await detectAif(dir, { warn: () => {} }), '2.17.0');
});

test('known-incompatible version stops with an error', async () => {
  const dir = await tmp();
  await marker(dir, { version: '3.1.0' }); // outside >=2.0.0 <3.0.0
  await assert.rejects(detectAif(dir, { warn: () => {} }), (e) => e instanceof AifError && /Incompatible/.test(e.message));
});

test('unknown version warns and proceeds', async () => {
  const dir = await tmp();
  await marker(dir, { name: 'proj' }); // no version field
  let warned = false;
  const v = await detectAif(dir, { warn: () => { warned = true; } });
  assert.equal(v, null);
  assert.ok(warned);
});
