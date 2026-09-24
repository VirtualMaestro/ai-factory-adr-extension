import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async (rel) => JSON.parse(await readFile(path.join(root, rel), 'utf8'));

test('extension.json validates against the vendored AIF schema', async () => {
  const schema = await load('schemas/extension.schema.json');
  const manifest = await load('extension.json');
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  assert.ok(validate(manifest), JSON.stringify(validate.errors, null, 2));
});

test('commands use the corrected object shape (not string paths)', async () => {
  const manifest = await load('extension.json');
  assert.ok(Array.isArray(manifest.commands) && manifest.commands.length === 1);
  const cmd = manifest.commands[0];
  assert.equal(typeof cmd, 'object');
  assert.deepEqual(Object.keys(cmd).sort(), ['description', 'module', 'name']);
});

test('all eighteen ADR skills are listed, including the migration, verify, verify-all, check-consistency, next, plan-improve, reconcile, and auto-phase skills', async () => {
  const manifest = await load('extension.json');
  assert.equal(manifest.skills.length, 18);
  assert.ok(manifest.skills.includes('skills/adr-check-consistency'), 'adr-check-consistency is installed');
  assert.ok(manifest.skills.includes('skills/adr-migrate'), 'adr-migrate is installed');
  assert.ok(manifest.skills.includes('skills/adr-verify'), 'adr-verify is installed');
  assert.ok(manifest.skills.includes('skills/adr-verify-all'), 'adr-verify-all is installed');
  assert.ok(manifest.skills.includes('skills/adr-next'), 'adr-next is installed');
  assert.ok(manifest.skills.includes('skills/adr-plan-improve'), 'adr-plan-improve is installed');
  assert.ok(manifest.skills.includes('skills/adr-reconcile'), 'adr-reconcile is installed');
  assert.ok(manifest.skills.includes('skills/adr-auto-plan'), 'adr-auto-plan is installed');
  assert.ok(manifest.skills.includes('skills/adr-auto-implement'), 'adr-auto-implement is installed');
});
