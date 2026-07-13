import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePlans, resolveActivePlan } from '../src/artifacts/plan.js';
import { mkProject, writePlan } from './helpers.js';

test('resolvePlans matches via `implements`, never by filename (tolerates NNNN_ prefix)', async () => {
  const dir = await mkProject();
  await writePlan(dir, { id: 'plan-adr-x', implements: ['adr-x'], name: '0007_adr-x-plan' });
  await writePlan(dir, { id: 'plan-adr-y', implements: ['adr-y'] });

  const { active } = await resolvePlans('adr-x', { projectDir: dir });
  assert.equal(active.length, 1);
  assert.equal(active[0].id, 'plan-adr-x');
});

test('archived plans (in archive dir, status done, or archived: field) are not active', async () => {
  const dir = await mkProject();
  await writePlan(dir, { id: 'plan-adr-a', implements: ['adr-a'], subdir: 'archive/plans', status: 'done', archived: '2026-01-01' });

  const { plans, active } = await resolvePlans('adr-a', { projectDir: dir });
  assert.equal(plans.length, 1);
  assert.equal(plans[0].archived, true);
  assert.equal(active.length, 0);
});

test('resolveActivePlan throws when more than one non-archived plan implements an ADR (inv 7)', async () => {
  const dir = await mkProject();
  await writePlan(dir, { id: 'plan-1', implements: ['adr-b'], name: 'plan-1' });
  await writePlan(dir, { id: 'plan-2', implements: ['adr-b'], name: 'plan-2' });

  await assert.rejects(() => resolveActivePlan('adr-b', { projectDir: dir }), /Multiple non-archived plans/);
});

test('resolveActivePlan returns null when no plan implements the ADR', async () => {
  const dir = await mkProject();
  assert.equal(await resolveActivePlan('adr-none', { projectDir: dir }), null);
});
