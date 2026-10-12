import { read as readDoc, serialize } from '../artifacts/frontmatter.js';
import { resolveActivePlan } from '../artifacts/plan.js';
import { transition, transitionTarget } from './move.js';
import { archivePlan, archivePlanTarget, todayUTC } from './archive.js';
import { resolveInside, atomicWrite, withFileRollback } from '../util/safe-path.js';
import { stageMove } from '../util/git.js';
import { deltaProblems } from '../live/delta.js';
import { liveContext, computeLive, gateProblem, gateError, liveError, withLiveLock, ignoredWarnings } from '../live/apply.js';

export function isDocumentationOnly(data) {
  return /^documentation-only(?: decision)?$/i.test(String(data.evidence ?? '').trim());
}

/**
 * Deterministic finalize core (§19.6): activate an accepted ADR and archive its plan.
 * Strict `aif-verify` is the P3 skill's job — this assumes the caller verified.
 * All touched files are restored if any write, move, or archive step fails.
 * When the project keeps `LIVE.md`, the ADR's `live:` delta is applied in the same rollback.
 */
export async function finalize(file, { projectDir = process.cwd() } = {}) {
  const abs = resolveInside(projectDir, file);
  const { data, body } = await readDoc(abs);

  if (data.status !== 'accepted') {
    throw new Error(
      'finalize requires an accepted ADR.\n' +
        `  expected: status=accepted\n  detected: status=${data.status}\n` +
        '  files:    nothing was changed\n  next:     accept the ADR first',
    );
  }

  const plan = await resolveActivePlan(data.id, { projectDir });
  const docOnly = !plan && isDocumentationOnly(data);
  if (!plan && !docOnly) {
    throw new Error(
      'No plan to finalize.\n' +
        `  expected: a non-archived plan implementing ${data.id}, or a documentation-only ADR\n` +
        '  detected: neither\n  files:    nothing was changed\n' +
        '  next:     create a plan (`adr link-plan`) or set `evidence: documentation-only`',
    );
  }

  // LIVE.md (§3.4 step 1): the delta is parsed, applied and the result checked before any write.
  const ctx = await liveContext(projectDir);
  const delta = data.live ?? null;
  if (ctx.exists) {
    const problem = gateProblem(delta, delta == null ? [] : deltaProblems(delta, { adr: true }));
    if (problem) throw gateError(data.id, problem);
    if (delta.applied != null) {
      throw liveError(`${data.id} is already applied on ${delta.applied}.`, {
        expected: 'an accepted ADR whose delta has no `applied:`',
        detected: `live.applied: ${delta.applied}`,
        next: 'remove `applied:` only if LIVE.md does not hold the change yet',
      });
    }
  }

  const activate = async () => {
    let live = null;
    if (ctx.exists) {
      const changes = delta.changes ?? [];
      const supersedes = [].concat(data.supersedes ?? []).map(String);
      live = { changes, ...(await computeLive(ctx, { changes, kind: 'adr', ref: data.id, supersedes, label: data.id })) };
      if (changes.length) data.live = { ...delta, applied: todayUTC() };
    }

    // Never clobber authored evidence (§19.6) — only fill it when empty.
    const evidenceChanged = plan && !String(data.evidence ?? '').trim();
    if (evidenceChanged) data.evidence = 'implemented';

    const activeTarget = transitionTarget(abs, 'active', { projectDir });
    const files = [abs, activeTarget];
    if (live) files.push(ctx.livePath);
    if (plan) files.push(plan.file, await archivePlanTarget(plan.file, { projectDir }));

    return withFileRollback(files, async () => {
      // `transition` re-reads the ADR from disk, so `live.applied` has to be there before it moves.
      if (evidenceChanged || live?.changes.length) await atomicWrite(abs, serialize(data, body));
      // Written before the moves, so an archive collision is a real rollback of LIVE.md too.
      if (live?.changed) await atomicWrite(ctx.livePath, live.after);
      const moved = await transition(abs, 'active', { projectDir, managed: true });
      const archived = plan ? await archivePlan(plan.file, { projectDir }) : null;
      if (live?.changed) stageMove(ctx.livePath);
      const warnings = live ? [...live.warnings, ...ignoredWarnings(ctx, [live.changed ? ctx.livePath : null])] : [];
      return {
        id: data.id,
        active: moved.target,
        plan: plan?.id ?? null,
        archivedPlan: archived?.target ?? null,
        live: live && { changed: live.changed, ops: live.ops, warnings },
      };
    });
  };
  // The lock spans the read of LIVE.md to its write: see withLiveLock.
  return ctx.exists ? withLiveLock(ctx, activate) : activate();
}
