import { read as readDoc, serialize } from '../artifacts/frontmatter.js';
import { resolveActivePlan } from '../artifacts/plan.js';
import { transition, transitionTarget } from './move.js';
import { archivePlan, archivePlanTarget } from './archive.js';
import { resolveInside, atomicWrite, withFileRollback } from '../util/safe-path.js';

export function isDocumentationOnly(data) {
  return /^documentation-only(?: decision)?$/i.test(String(data.evidence ?? '').trim());
}

/**
 * Deterministic finalize core (§19.6): activate an accepted ADR and archive its plan.
 * Strict `aif-verify` is the P3 skill's job — this assumes the caller verified.
 * All touched files are restored if any write, move, or archive step fails.
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

  // Never clobber authored evidence (§19.6) — only fill it when empty.
  const evidenceChanged = plan && !String(data.evidence ?? '').trim();
  if (evidenceChanged) data.evidence = 'implemented';

  const activeTarget = transitionTarget(abs, 'active', { projectDir });
  const files = [abs, activeTarget];
  if (plan) files.push(plan.file, await archivePlanTarget(plan.file, { projectDir }));

  return withFileRollback(files, async () => {
    if (evidenceChanged) await atomicWrite(abs, serialize(data, body));
    const moved = await transition(abs, 'active', { projectDir, managed: true });
    const archived = plan ? await archivePlan(plan.file, { projectDir }) : null;
    return { id: data.id, active: moved.target, plan: plan?.id ?? null, archivedPlan: archived?.target ?? null };
  });
}
