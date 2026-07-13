import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DIR_BY_STATUS, STATUS_BY_DIR, validateDirStatus } from '../src/lifecycle/status.js';
import { isLegal, legalTargets } from '../src/lifecycle/transitions.js';
import { transition } from '../src/lifecycle/move.js';
import { read } from '../src/artifacts/frontmatter.js';
import { mkProject, writeAdr } from './helpers.js';

test('status↔directory maps are inverse and cover all five statuses (inv 4)', () => {
  assert.equal(DIR_BY_STATUS.proposed, 'proposals');
  assert.equal(STATUS_BY_DIR.superseded, 'superseded');
  assert.equal(Object.keys(DIR_BY_STATUS).length, 5);
  for (const [status, dir] of Object.entries(DIR_BY_STATUS)) assert.equal(STATUS_BY_DIR[dir], status);
});

test('transition legality follows §17 exactly', () => {
  for (const pair of ['none>proposed', 'proposed>draft', 'draft>accepted', 'accepted>draft', 'accepted>active', 'active>superseded', 'accepted>superseded']) {
    const [f, t] = pair.split('>');
    assert.ok(isLegal(f, t), `expected legal: ${pair}`);
  }
  for (const pair of ['proposed>accepted', 'draft>active', 'active>accepted', 'superseded>active', 'proposed>active']) {
    const [f, t] = pair.split('>');
    assert.ok(!isLegal(f, t), `expected illegal: ${pair}`);
  }
  assert.deepEqual(legalTargets('accepted').sort(), ['active', 'draft', 'superseded']);
});

test('validateDirStatus flags a file whose directory disagrees with its status', () => {
  assert.ok(validateDirStatus('docs/adr/drafts/adr-x.md', 'draft').ok);
  assert.ok(!validateDirStatus('docs/adr/accepted/adr-x.md', 'draft').ok);
});

test('transition atomically moves the file and flips frontmatter status', async () => {
  const dir = await mkProject();
  const src = await writeAdr(dir, { id: 'adr-move', status: 'proposed' });

  const res = await transition(src, 'draft', { projectDir: dir });

  assert.ok(!existsSync(src), 'source must be gone');
  assert.ok(existsSync(res.target), 'target must exist');
  assert.match(res.target, /drafts[\\/]adr-move\.md$/);
  const { data } = await read(res.target);
  assert.equal(data.status, 'draft');
});

test('transition rejects an illegal jump and leaves the file untouched', async () => {
  const dir = await mkProject();
  const src = await writeAdr(dir, { id: 'adr-illegal', status: 'proposed' });
  await assert.rejects(() => transition(src, 'active', { projectDir: dir }), /Illegal lifecycle transition/);
  assert.ok(existsSync(src), 'source must remain');
});

test('transition refuses a target collision and leaves both files intact (inv 15)', async () => {
  const dir = await mkProject();
  const src = await writeAdr(dir, { id: 'adr-dup', status: 'proposed' });
  const collision = await writeAdr(dir, { id: 'adr-dup', status: 'draft' }); // same stem already in drafts/

  await assert.rejects(() => transition(src, 'draft', { projectDir: dir }), /Target already exists/);
  assert.ok(existsSync(src) && existsSync(collision), 'no partial move');
});

test('transition rejects a path outside the project (§28)', async () => {
  const dir = await mkProject();
  await assert.rejects(() => transition('../../etc/passwd', 'draft', { projectDir: dir }), /escapes the project/);
});
