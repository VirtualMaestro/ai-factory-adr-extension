import { unlink } from 'node:fs/promises';
import { read } from '../artifacts/frontmatter.js';
import { resolveActivePlan } from '../artifacts/plan.js';
import { supersedeLink } from '../artifacts/links.js';
import { transition } from './move.js';
import { archivePlan } from './archive.js';
import { resolveInside } from '../util/safe-path.js';

const REPLACEABLE = ['accepted', 'active'];

/**
 * Deterministic supersede core (§19.7): reciprocal links, orphan-plan disposition, atomic move of the
 * old ADR into superseded/. `planDisposition` ∈ 'archive' | 'delete' | null (required when a
 * non-archived plan exists — inv 17). Agent analysis (dup scan etc.) is the P4 skill's job.
 */
export async function supersede(oldFile, newFile, { projectDir = process.cwd(), planDisposition = null } = {}) {
  const oldAbs = resolveInside(projectDir, oldFile);
  const newAbs = resolveInside(projectDir, newFile);
  const oldAdr = await read(oldAbs);
  const newAdr = await read(newAbs);

  const fail = (msg, detail) => {
    throw new Error(`${msg}\n  detected: ${detail}\n  files:    nothing was changed\n  next:     satisfy the precondition and retry`);
  };
  if (!REPLACEABLE.includes(oldAdr.data.status)) fail('Old ADR must be accepted or active.', `status=${oldAdr.data.status}`);
  if (!REPLACEABLE.includes(newAdr.data.status)) fail('Replacement ADR must be accepted or active.', `status=${newAdr.data.status}`);
  if (oldAdr.data.id === newAdr.data.id) fail('Old and new ADR ids must differ.', `both are ${oldAdr.data.id}`);

  const plan = await resolveActivePlan(oldAdr.data.id, { projectDir });
  if (plan && !planDisposition) {
    fail('Superseding an ADR with a non-archived plan needs an explicit disposition.', `plan ${plan.id} is active; pass --archive-plan or --delete-plan`);
  }

  await supersedeLink(oldAbs, newAbs, { projectDir });

  let disposed = null;
  if (plan) {
    if (planDisposition === 'archive') disposed = { action: 'archived', ...(await archivePlan(plan.file, { projectDir, note: `superseded by ${newAdr.data.id}` })) };
    else if (planDisposition === 'delete') {
      await unlink(plan.file);
      disposed = { action: 'deleted', file: plan.file };
    }
  }

  const moved = await transition(oldAbs, 'superseded', { projectDir });
  return { oldId: oldAdr.data.id, newId: newAdr.data.id, superseded: moved.target, plan: disposed };
}
