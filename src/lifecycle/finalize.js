import { setField } from '../artifacts/links.js';
import { read as readDoc, serialize } from '../artifacts/frontmatter.js';
import { resolveActivePlan } from '../artifacts/plan.js';
import { transition, transitionTarget } from './move.js';
import { archivePlan, archivePlanTarget } from './archive.js';
import { resolveInside, atomicWrite, withFileRollback } from '../util/safe-path.js';

function implementationFields(body) {
  const heading = body.match(/^##[ \t]+Implementation[ \t]*\r?$/mi);
  if (!heading) return {};
  const rest = body.slice(heading.index + heading[0].length);
  const next = rest.search(/^##[ \t]+/m);
  const section = next < 0 ? rest : rest.slice(0, next);
  const field = (name) => section.match(new RegExp(`^- \\*\\*${name}:\\*\\*[ \\t]*(.+)$`, 'mi'))?.[1]?.trim();
  return { plan: field('Plan'), evidence: field('Evidence') };
}

export function isDocumentationOnly(body) {
  const { plan, evidence } = implementationFields(body);
  return /^not required$/i.test(plan ?? '') || /^documentation-only(?: decision)?$/i.test(evidence ?? '');
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
  const docOnly = !plan && isDocumentationOnly(body);
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
  const activeTarget = transitionTarget(abs, 'active', { projectDir });
  const files = [abs, activeTarget];
  if (plan) files.push(plan.file, await archivePlanTarget(plan.file, { projectDir }));

  return withFileRollback(files, async () => {
    if (newBody !== body) await atomicWrite(abs, serialize(data, newBody));
    const moved = await transition(abs, 'active', { projectDir, managed: true });
    const archived = plan ? await archivePlan(plan.file, { projectDir }) : null;
    return { id: data.id, active: moved.target, plan: plan?.id ?? null, archivedPlan: archived?.target ?? null };
  });
}
