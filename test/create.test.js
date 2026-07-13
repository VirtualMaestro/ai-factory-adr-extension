import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { read } from '../src/artifacts/frontmatter.js';
import { stemMatchesId } from '../src/artifacts/id.js';
import { createProposal } from '../src/artifacts/create.js';
import { mkProject, writeAdr } from './helpers.js';

test('createProposal scaffolds a proposed ADR with a stable id (Acc 11, inv 1-3)', async () => {
  const dir = await mkProject();

  const { id, path: file } = await createProposal('Use Postgres for storage', { projectDir: dir });

  assert.equal(id, 'adr-use-postgres-for-storage');
  assert.match(file, /proposals[\\/]adr-use-postgres-for-storage\.md$/, 'lands in proposals/');
  assert.ok(existsSync(file));
  assert.ok(stemMatchesId(file, id), 'filename stem == id (inv 3)');

  const { data } = await read(file);
  assert.equal(data.id, id);
  assert.equal(data.status, 'proposed');
  assert.equal(data.type, 'adr');
});

test('createProposal rejects a duplicate id anywhere in the lifecycle and touches no file (Acc 27)', async () => {
  const dir = await mkProject();
  // Same id already accepted → topic maps to adr-dup.
  await writeAdr(dir, { id: 'adr-dup', status: 'accepted' });

  const proposalsDir = path.join(dir, 'docs/adr/proposals');
  const before = await readdir(proposalsDir);

  await assert.rejects(() => createProposal('dup', { projectDir: dir }), /already exists/);

  assert.deepEqual(await readdir(proposalsDir), before, 'no proposal written on dup');
});

test('createProposal throws on an empty topic', async () => {
  const dir = await mkProject();
  await assert.rejects(() => createProposal('---', { projectDir: dir }), /Cannot derive an ADR id/);
});
