import { setField } from '../artifacts/links.js';
import { read as readDoc, serialize } from '../artifacts/frontmatter.js';
import { resolveActivePlan } from '../artifacts/plan.js';
import { transition } from './move.js';
import { archivePlan } from './archive.js';
import { resolveInside, atomicWrite } from '../util/safe-path.js';

const DOC_ONLY_RE = /documentation-only|not required/i;

/**
 * Deterministic finalize core (§19.6): activate an accepted ADR and archive its plan.
 * Strict `aif-verify` is the P3 skill's job — this assumes the caller verified.
 * ponytail: two-file op; ADR activates then plan archives. If archive fails post-activation the ADR
 * is already active — reported, not rolled back. Full cross-file atomicity if it ever matters.
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
  const docOnly = !plan && DOC_ONLY_RE.test(body);
  if (!plan && !docOnly) {
    throw new Error(
      'No plan to finalize.\n' +
        `  expected: a non-archived plan implementing ${data.id}, or a documentation-only ADR\n` +
        '  detected: neither\n  files:    nothing was changed\n' +
        '  next:     create a plan (`adr link-plan`) or mark the ADR documentation-only',
    );
  }

  let newBody = body;
  if (plan) newBody = setField(newBody, 'Evidence', 'implemented');
  else newBody = setField(setField(newBody, 'Plan', 'not required'), 'Evidence', 'documentation-only decision');
  if (newBody !== body) await atomicWrite(abs, serialize(data, newBody));

  const moved = await transition(abs, 'active', { projectDir });
  const archived = plan ? await archivePlan(plan.file, { projectDir }) : null;

  return { id: data.id, active: moved.target, plan: plan?.id ?? null, archivedPlan: archived?.target ?? null };
}
