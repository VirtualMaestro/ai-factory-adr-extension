import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAdr } from '../src/lifecycle/validate.js';
import { mkProject, writeAdr } from './helpers.js';

const GOOD = '\n# T\n\n## Decision\n\nUse X.\n\n## Implementation\n\n- **Plan:** plan-adr-ok\n- **Evidence:** implemented, commit abc123\n';

test('a well-formed draft validates clean', async () => {
  const dir = await mkProject();
  const f = await writeAdr(dir, { id: 'adr-ok', status: 'draft' });
  const { errors } = await validateAdr(f, { projectDir: dir });
  assert.deepEqual(errors, []);
});

test('wrong type and stem/id mismatch are reported (inv 2,3)', async () => {
  const dir = await mkProject();
  const bad = await writeAdr(dir, { id: 'adr-typed', status: 'draft', type: 'plan' });
  assert.ok((await validateAdr(bad, { projectDir: dir })).errors.some((e) => /type must be/.test(e)));

  // frontmatter id differs from the filename stem
  const f = await writeAdr(dir, { id: 'adr-real', status: 'draft' });
  const { rename } = await import('node:fs/promises');
  const renamed = f.replace('adr-real.md', 'adr-other.md');
  await rename(f, renamed);
  assert.ok((await validateAdr(renamed, { projectDir: dir })).errors.some((e) => /filename stem/.test(e)));
});

test('directory/status mismatch is an error (inv 4)', async () => {
  const dir = await mkProject();
  // write a file claiming status=draft but placed in accepted/
  const f = await writeAdr(dir, { id: 'adr-misplaced', status: 'accepted' });
  const moved = f.replace(/accepted/, 'drafts');
  const { rename } = await import('node:fs/promises');
  await rename(f, moved);
  const { errors } = await validateAdr(moved, { projectDir: dir });
  assert.ok(errors.some((e) => /expects directory/.test(e)));
});

test('accepted ADR with template placeholders is rejected (inv 6)', async () => {
  const dir = await mkProject();
  const f = await writeAdr(dir, { id: 'adr-ph', status: 'accepted' }); // default body has "not implemented"
  const { errors } = await validateAdr(f, { projectDir: dir });
  assert.ok(errors.some((e) => /unresolved placeholders/.test(e)));
});

test('active ADR without evidence is rejected, with evidence passes (inv 10)', async () => {
  const dir = await mkProject();
  const noEv = await writeAdr(dir, { id: 'adr-noev', status: 'active' });
  assert.ok((await validateAdr(noEv, { projectDir: dir })).errors.some((e) => /evidence/.test(e)));

  const withEv = await writeAdr(dir, { id: 'adr-ev', status: 'active', body: GOOD });
  assert.deepEqual((await validateAdr(withEv, { projectDir: dir })).errors, []);
});

test('superseded ADR must reference its replacement (inv 11)', async () => {
  const dir = await mkProject();
  const f = await writeAdr(dir, { id: 'adr-sup', status: 'superseded', body: '\n# T\n\n## References\n\n- **Replaced by:** —\n' });
  assert.ok((await validateAdr(f, { projectDir: dir })).errors.some((e) => /reference its replacement/.test(e)));
});
