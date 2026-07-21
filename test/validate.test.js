import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAdr } from '../src/lifecycle/validate.js';
import { mkProject, writeAdr, writePlan } from './helpers.js';

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
  const f = await writeAdr(dir, {
    id: 'adr-ph',
    status: 'accepted',
    body: '\n# T\n\n## Decision\n\nWe will use **[decision]** for **[scope]**.\n',
  });
  const { errors } = await validateAdr(f, { projectDir: dir });
  assert.ok(errors.some((e) => /unresolved placeholders/.test(e)));
});

test('active ADR without evidence is rejected, with evidence passes (inv 10)', async () => {
  const dir = await mkProject();
  const noEv = await writeAdr(dir, { id: 'adr-noev', status: 'active' });
  assert.ok((await validateAdr(noEv, { projectDir: dir })).errors.some((e) => /evidence/.test(e)));

  const withEv = await writeAdr(dir, { id: 'adr-ev', status: 'active', evidence: 'implemented, commit abc123' });
  assert.deepEqual((await validateAdr(withEv, { projectDir: dir })).errors, []);
});

test('frontmatter plan naming a nonexistent plan warns; a real (even archived) plan stays silent', async () => {
  const dir = await mkProject();
  const PLAN_WARN = /has no plan implementing/;

  const ghost = await writeAdr(dir, { id: 'adr-ghost', status: 'accepted', plan: 'plan-missing' });
  assert.ok((await validateAdr(ghost, { projectDir: dir })).warnings.some((w) => PLAN_WARN.test(w)));

  const linked = await writeAdr(dir, { id: 'adr-linked', status: 'accepted', plan: 'plan-adr-linked' });
  await writePlan(dir, { id: 'plan-adr-linked', implements: ['adr-linked'] });
  assert.ok(!(await validateAdr(linked, { projectDir: dir })).warnings.some((w) => PLAN_WARN.test(w)));

  const done = await writeAdr(dir, { id: 'adr-done', status: 'active', plan: 'plan-adr-done', evidence: 'implemented' });
  await writePlan(dir, { id: 'plan-adr-done', implements: ['adr-done'], status: 'done', subdir: 'archive/plans' });
  assert.ok(!(await validateAdr(done, { projectDir: dir })).warnings.some((w) => PLAN_WARN.test(w)));
});

test('active ADR without code anchors warns; with anchors or doc-only stays silent', async () => {
  const dir = await mkProject();
  const CODE_WARN = /empty code anchors/;

  const noCode = await writeAdr(dir, { id: 'adr-nocode', status: 'active', evidence: 'implemented' });
  assert.ok((await validateAdr(noCode, { projectDir: dir })).warnings.some((w) => CODE_WARN.test(w)));

  const withCode = await writeAdr(dir, { id: 'adr-code', status: 'active', evidence: 'implemented', code: ['src/x.js'] });
  assert.ok(!(await validateAdr(withCode, { projectDir: dir })).warnings.some((w) => CODE_WARN.test(w)));

  const docOnly = await writeAdr(dir, { id: 'adr-doconly', status: 'active', evidence: 'documentation-only decision' });
  assert.ok(!(await validateAdr(docOnly, { projectDir: dir })).warnings.some((w) => CODE_WARN.test(w)));
});

test('superseded ADR must reference its replacement (inv 11)', async () => {
  const dir = await mkProject();
  const f = await writeAdr(dir, { id: 'adr-sup', status: 'superseded' });
  assert.ok((await validateAdr(f, { projectDir: dir })).errors.some((e) => /reference its replacement/.test(e)));

  const ok = await writeAdr(dir, { id: 'adr-sup-ok', status: 'superseded', replaced_by: 'adr-next' });
  assert.ok(!(await validateAdr(ok, { projectDir: dir })).errors.some((e) => /reference its replacement/.test(e)));
});
