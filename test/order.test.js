import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOrder } from '../src/order.js';
import { mkProject, writeAdr } from './helpers.js';

const EV = { evidence: 'implemented' };

test('linear chain: only the deps-satisfied accepted ADR is next; the rest follow in order', async () => {
  const dir = await mkProject();
  await writeAdr(dir, { id: 'adr-a', status: 'active', ...EV });
  await writeAdr(dir, { id: 'adr-b', status: 'accepted', depends_on: ['adr-a'] });
  await writeAdr(dir, { id: 'adr-c', status: 'accepted', depends_on: ['adr-b'] });

  const res = await buildOrder({ projectDir: dir });
  assert.deepEqual(res.next, ['adr-b'], 'b is ready (dep a active); c is not (dep b still accepted)');
  assert.deepEqual(res.order.map((o) => o.id), ['adr-b', 'adr-c'], 'b ordered before c');
  const c = res.order.find((o) => o.id === 'adr-c');
  assert.equal(c.ready, false);
  assert.deepEqual(c.blockedBy, ['adr-b']);
  assert.deepEqual(res.cycles, []);
});

test('an accepted ADR with a non-active dep is not next', async () => {
  const dir = await mkProject();
  await writeAdr(dir, { id: 'adr-dep', status: 'draft' });
  await writeAdr(dir, { id: 'adr-x', status: 'accepted', depends_on: ['adr-dep'] });

  const res = await buildOrder({ projectDir: dir });
  assert.ok(!res.next.includes('adr-x'), 'x waits on a draft dep');
  assert.deepEqual(res.order.find((o) => o.id === 'adr-x').blockedBy, ['adr-dep']);
});

test('a cycle is reported and its members are excluded from next/order', async () => {
  const dir = await mkProject();
  await writeAdr(dir, { id: 'adr-p', status: 'accepted', depends_on: ['adr-q'] });
  await writeAdr(dir, { id: 'adr-q', status: 'accepted', depends_on: ['adr-p'] });

  const res = await buildOrder({ projectDir: dir });
  assert.equal(res.cycles.length, 1);
  assert.deepEqual([...res.cycles[0]].sort(), ['adr-p', 'adr-q']);
  assert.deepEqual(res.next, []);
  assert.deepEqual(res.order, []);
});

test('an unknown dep id blocks (cannot confirm all deps active)', async () => {
  const dir = await mkProject();
  await writeAdr(dir, { id: 'adr-m', status: 'accepted', depends_on: ['adr-ghost'] });

  const res = await buildOrder({ projectDir: dir });
  assert.deepEqual(res.next, [], 'not ready — the dependency does not exist');
  const b = res.blocked.find((x) => x.id === 'adr-m');
  assert.deepEqual(b.blockedBy, ['adr-ghost']);
  assert.match(b.note, /unknown dependency adr-ghost/);
});

test('overlapping cycles keep every member (SCC, not a single back-edge)', async () => {
  const dir = await mkProject();
  // A→B, A→C, B→A, C→B  ⇒ one SCC {A,B,C}; a naive DFS would drop C.
  await writeAdr(dir, { id: 'adr-a', status: 'accepted', depends_on: ['adr-b', 'adr-c'] });
  await writeAdr(dir, { id: 'adr-b', status: 'accepted', depends_on: ['adr-a'] });
  await writeAdr(dir, { id: 'adr-c', status: 'accepted', depends_on: ['adr-b'] });

  const res = await buildOrder({ projectDir: dir });
  assert.equal(res.cycles.length, 1);
  assert.deepEqual(res.cycles[0], ['adr-a', 'adr-b', 'adr-c'], 'all three reported as cyclic');
  assert.deepEqual(res.next, []);
  assert.deepEqual(res.order, []);
  assert.deepEqual(res.blocked, [], 'no member mislabeled as merely blocked');
});

test('a superseded dep permanently blocks and carries a repoint note', async () => {
  const dir = await mkProject();
  await writeAdr(dir, { id: 'adr-old', status: 'superseded', replaced_by: 'adr-new' });
  await writeAdr(dir, { id: 'adr-s', status: 'accepted', depends_on: ['adr-old'] });

  const res = await buildOrder({ projectDir: dir });
  assert.ok(!res.next.includes('adr-s'));
  const b = res.blocked.find((x) => x.id === 'adr-s');
  assert.deepEqual(b.blockedBy, ['adr-old']);
  assert.match(b.note, /superseded adr-old/);
});

test('independent ready ADRs come out in deterministic id order', async () => {
  const dir = await mkProject();
  await writeAdr(dir, { id: 'adr-2', status: 'accepted' });
  await writeAdr(dir, { id: 'adr-1', status: 'accepted' });

  const res = await buildOrder({ projectDir: dir });
  assert.deepEqual(res.next, ['adr-1', 'adr-2']);
});
