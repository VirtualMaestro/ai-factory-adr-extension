import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { verifyAnchors } from '../src/lifecycle/verify.js';
import { mkProject, writeAdr } from './helpers.js';

const GOOD = { evidence: 'implemented' };

/** Drop a source file at repo-root-relative `rel` with `content`. */
async function writeSrc(dir, rel, content) {
  const abs = path.join(dir, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, content, 'utf8');
}

test('present anchor file resolves; absent one is missing', async () => {
  const dir = await mkProject();
  await writeSrc(dir, 'src/x.js', 'export const x = 1;\n');
  const f = await writeAdr(dir, { id: 'adr-a', status: 'active', ...GOOD, code: ['src/x.js', 'src/gone.js'] });
  const res = await verifyAnchors(f, { projectDir: dir });
  assert.equal(res.anchors.find((a) => a.path === 'src/x.js').fileExists, true);
  assert.deepEqual(res.missing, ['src/gone.js']);
});

test('#symbol found and not-found', async () => {
  const dir = await mkProject();
  await writeSrc(dir, 'src/y.js', 'export function doThing() {}\n');
  const f = await writeAdr(dir, {
    id: 'adr-b', status: 'active', ...GOOD,
    code: ['src/y.js#doThing', 'src/y.js#missingSym'],
  });
  const res = await verifyAnchors(f, { projectDir: dir });
  assert.equal(res.anchors[0].symbolFound, true);
  assert.equal(res.anchors[1].symbolFound, false);
  assert.deepEqual(res.missing, ['src/y.js#missingSym']);
});

test('empty code array → no anchors, no missing, no crash', async () => {
  const dir = await mkProject();
  const f = await writeAdr(dir, { id: 'adr-c', status: 'active', body: GOOD });
  const res = await verifyAnchors(f, { projectDir: dir });
  assert.deepEqual(res.anchors, []);
  assert.deepEqual(res.missing, []);
});

test('documentation-only ADR is flagged docOnly', async () => {
  const dir = await mkProject();
  const f = await writeAdr(dir, { id: 'adr-d', status: 'active', evidence: 'documentation-only decision' });
  const res = await verifyAnchors(f, { projectDir: dir });
  assert.equal(res.docOnly, true);
});

test('anchor escaping the project is treated as missing, not a crash', async () => {
  const dir = await mkProject();
  const f = await writeAdr(dir, { id: 'adr-e', status: 'active', ...GOOD, code: ['../outside.js'] });
  const res = await verifyAnchors(f, { projectDir: dir });
  assert.equal(res.anchors[0].fileExists, false);
  assert.deepEqual(res.missing, ['../outside.js']);
});
