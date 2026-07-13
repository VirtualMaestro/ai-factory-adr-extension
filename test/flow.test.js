import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { read } from '../src/artifacts/frontmatter.js';
import { linkPlan } from '../src/artifacts/links.js';
import { finalize } from '../src/lifecycle/finalize.js';
import { supersede } from '../src/lifecycle/supersede.js';
import { mkProject, writeAdr, writePlan } from './helpers.js';

test('link-plan writes reciprocal ADR↔plan links (inv 8,9)', async () => {
  const dir = await mkProject();
  const adr = await writeAdr(dir, { id: 'adr-lp', status: 'accepted', affects: [] });
  const plan = await writePlan(dir, { id: 'plan-adr-lp', implements: [] });

  await linkPlan(adr, plan, { projectDir: dir });

  assert.ok((await read(adr)).data.affects.includes('plan-adr-lp'));
  const planFm = (await read(plan)).data;
  assert.ok(planFm.implements.includes('adr-lp'));
  assert.ok(planFm.depends_on.includes('adr-lp'));
  assert.match((await read(adr)).body, /- \*\*Plan:\*\* plan-adr-lp/);
});

test('finalize activates a plan-backed ADR and archives the plan (Acc 20)', async () => {
  const dir = await mkProject();
  const body = '\n# T\n\n## Decision\n\nUse X.\n\n## Implementation\n\n- **Plan:** plan-adr-fin\n- **Evidence:** ready\n';
  const adr = await writeAdr(dir, { id: 'adr-fin', status: 'accepted', body, affects: ['plan-adr-fin'] });
  const plan = await writePlan(dir, { id: 'plan-adr-fin', implements: ['adr-fin'] });

  const res = await finalize(adr, { projectDir: dir });

  assert.ok(!existsSync(adr) && existsSync(res.active), 'ADR moved to active/');
  assert.match(res.active, /active[\\/]adr-fin\.md$/);
  assert.equal((await read(res.active)).data.status, 'active');
  assert.match((await read(res.active)).body, /- \*\*Evidence:\*\* implemented/);

  assert.ok(!existsSync(plan), 'plan left the live plans dir');
  const archived = path.join(dir, '.ai-factory/archive/plans/plan-adr-fin.md');
  assert.ok(existsSync(archived), 'plan archived');
  const pf = (await read(archived)).data;
  assert.equal(pf.status, 'done');
  assert.match(pf.archived, /^\d{4}-\d{2}-\d{2}$/);
});

test('finalize activates a documentation-only ADR without a plan (Acc 22)', async () => {
  const dir = await mkProject();
  const body = '\n# T\n\n## Implementation\n\n- **Plan:** not required\n- **Evidence:** documentation-only\n';
  const adr = await writeAdr(dir, { id: 'adr-doc', status: 'accepted', body });

  const res = await finalize(adr, { projectDir: dir });
  assert.equal((await read(res.active)).data.status, 'active');
  assert.equal(res.archivedPlan, null);
});

test('finalize refuses a non-accepted ADR', async () => {
  const dir = await mkProject();
  const adr = await writeAdr(dir, { id: 'adr-draftfin', status: 'draft' });
  await assert.rejects(() => finalize(adr, { projectDir: dir }), /requires an accepted ADR/);
});

test('supersede links reciprocally and moves the old ADR to superseded (Acc 23,24)', async () => {
  const dir = await mkProject();
  const oldAdr = await writeAdr(dir, { id: 'adr-old', status: 'active', body: '\n# Old\n\n## References\n\n- **Replaced by:** —\n' });
  const newAdr = await writeAdr(dir, { id: 'adr-new', status: 'accepted' });

  const res = await supersede(oldAdr, newAdr, { projectDir: dir });

  assert.ok(!existsSync(oldAdr) && existsSync(res.superseded));
  assert.equal((await read(res.superseded)).data.status, 'superseded');
  assert.match((await read(res.superseded)).body, /- \*\*Replaced by:\*\* \.\.\/accepted\/adr-new\.md/);
  assert.ok((await read(newAdr)).data.supersedes.includes('adr-old'));
});

test('superseding an ADR with a non-archived plan requires disposition (Acc 25)', async () => {
  const dir = await mkProject();
  const oldAdr = await writeAdr(dir, { id: 'adr-oldp', status: 'accepted' });
  const newAdr = await writeAdr(dir, { id: 'adr-newp', status: 'accepted' });
  const plan = await writePlan(dir, { id: 'plan-adr-oldp', implements: ['adr-oldp'] });

  await assert.rejects(() => supersede(oldAdr, newAdr, { projectDir: dir }), /explicit disposition/);

  const res = await supersede(oldAdr, newAdr, { projectDir: dir, planDisposition: 'archive' });
  assert.equal(res.plan.action, 'archived');
  assert.ok(!existsSync(plan), 'plan removed from live dir');
  assert.ok(existsSync(path.join(dir, '.ai-factory/archive/plans/plan-adr-oldp.md')));
});
