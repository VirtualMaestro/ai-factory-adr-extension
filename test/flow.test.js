import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { read } from '../src/artifacts/frontmatter.js';
import { linkPlan } from '../src/artifacts/links.js';
import { finalize } from '../src/lifecycle/finalize.js';
import { supersede } from '../src/lifecycle/supersede.js';
import { atomicWrite } from '../src/util/safe-path.js';
import { buildFileStatus } from '../src/status.js';
import { mkProject, writeAdr, writePlan } from './helpers.js';

test('status warns until every known ADR dependency is active', async () => {
  const dir = await mkProject();
  for (const status of ['proposed', 'draft', 'accepted', 'active', 'superseded']) {
    await writeAdr(dir, { id: `adr-dep-${status}`, status });
  }
  await writeFile(path.join(dir, 'docs/adr/drafts/broken.md'), '---\nid: [\n---\n', 'utf8');
  const adr = await writeAdr(dir, {
    id: 'adr-target',
    status: 'accepted',
    depends_on: [
      'adr-dep-proposed',
      'adr-dep-draft',
      'adr-dep-accepted',
      'adr-dep-active',
      'adr-dep-superseded',
      'adr-missing',
    ],
  });

  assert.deepEqual((await buildFileStatus(adr, dir)).warnings, [
    'depends on "adr-dep-proposed" which is not yet active (status: proposed)',
    'depends on "adr-dep-draft" which is not yet active (status: draft)',
    'depends on "adr-dep-accepted" which is not yet active (status: accepted)',
    'depends on superseded "adr-dep-superseded"; consider its replacement',
  ]);
});

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

test('link-plan restores both files when its second write fails', async () => {
  const dir = await mkProject();
  const adr = await writeAdr(dir, { id: 'adr-lp-rollback', status: 'accepted', affects: [] });
  const plan = await writePlan(dir, { id: 'plan-adr-lp-rollback', implements: [] });
  const before = [await readFile(adr, 'utf8'), await readFile(plan, 'utf8')];
  let writes = 0;

  await assert.rejects(() => linkPlan(adr, plan, {
    projectDir: dir,
    write: (...args) => (++writes === 2 ? Promise.reject(new Error('injected write failure')) : atomicWrite(...args)),
  }), /injected write failure/);

  assert.equal(await readFile(adr, 'utf8'), before[0]);
  assert.equal(await readFile(plan, 'utf8'), before[1]);
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
  const body = '\n# T\n\n## Implementation\n\n- **Plan:** not required\n- **Evidence:** documentation-only\n'.replaceAll('\n', '\r\n');
  const adr = await writeAdr(dir, { id: 'adr-doc', status: 'accepted', body });

  const res = await finalize(adr, { projectDir: dir });
  assert.equal((await read(res.active)).data.status, 'active');
  assert.equal(res.archivedPlan, null);
});

test('documentation-only words outside structured Implementation fields do not bypass a plan', async () => {
  const dir = await mkProject();
  const body = '\n# T\n\n## Context\n\nThis is documentation-only background; implementation is not required by another option.\n\n## Implementation\n\n- **Plan:** none\n- **Evidence:** pending\n';
  const adr = await writeAdr(dir, { id: 'adr-doc-false-positive', status: 'accepted', body });
  await assert.rejects(() => finalize(adr, { projectDir: dir }), /No plan to finalize/);
  assert.ok(existsSync(adr));
});

test('finalize rolls back the ADR when plan archival fails', async () => {
  const dir = await mkProject();
  const body = '\n# T\n\n## Implementation\n\n- **Plan:** plan-rollback\n- **Evidence:** ready\n';
  const adr = await writeAdr(dir, { id: 'adr-fin-rollback', status: 'accepted', body });
  const plan = await writePlan(dir, { id: 'plan-rollback', implements: ['adr-fin-rollback'] });
  const collision = await writePlan(dir, { id: 'unrelated-archive', status: 'done', name: 'plan-rollback', subdir: 'archive/plans' });
  const before = [await readFile(adr, 'utf8'), await readFile(plan, 'utf8'), await readFile(collision, 'utf8')];

  await assert.rejects(() => finalize(adr, { projectDir: dir }), /Archived plan already exists/);

  assert.equal(await readFile(adr, 'utf8'), before[0]);
  assert.equal(await readFile(plan, 'utf8'), before[1]);
  assert.equal(await readFile(collision, 'utf8'), before[2]);
  assert.ok(!existsSync(path.join(dir, 'docs/adr/active/adr-fin-rollback.md')));
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
  assert.equal((await buildFileStatus(res.superseded, dir)).replacedBy, '../accepted/adr-new.md');
});

test('supersede restores links when the final move fails', async () => {
  const dir = await mkProject();
  const body = '\n# Old\n\n## References\n\n- **Replaced by:** —\n';
  const oldAdr = await writeAdr(dir, { id: 'adr-old-rollback', status: 'active', body });
  const newAdr = await writeAdr(dir, { id: 'adr-new-rollback', status: 'accepted' });
  const collision = await writeAdr(dir, { id: 'adr-old-rollback', status: 'superseded', body });
  const before = [await readFile(oldAdr, 'utf8'), await readFile(newAdr, 'utf8'), await readFile(collision, 'utf8')];

  await assert.rejects(() => supersede(oldAdr, newAdr, { projectDir: dir }), /Target already exists/);

  assert.equal(await readFile(oldAdr, 'utf8'), before[0]);
  assert.equal(await readFile(newAdr, 'utf8'), before[1]);
  assert.equal(await readFile(collision, 'utf8'), before[2]);
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
  const archived = path.join(dir, '.ai-factory/archive/plans/plan-adr-oldp.md');
  assert.ok(existsSync(archived));
  assert.equal((await read(archived)).data.archived_reason, 'superseded by adr-newp'); // §19.7 step 5
});
