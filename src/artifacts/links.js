import { read, serialize } from './frontmatter.js';
import { atomicWrite, resolveInside, withFileRollback } from '../util/safe-path.js';

function uniqPush(value, item) {
  const arr = Array.isArray(value) ? value : value == null ? [] : [value];
  if (!arr.includes(item)) arr.push(item);
  return arr;
}

/**
 * Reciprocal ADR↔plan link (§19.4, inv 8,9): plan `implements`/`depends_on` the ADR;
 * ADR `plan:` frontmatter names the plan. The ADR body is never touched.
 */
export async function linkPlan(adrFile, planFile, { projectDir = process.cwd(), write = atomicWrite } = {}) {
  const adrPath = resolveInside(projectDir, adrFile);
  const planPath = resolveInside(projectDir, planFile);
  const adr = await read(adrPath);
  const plan = await read(planPath);
  const adrId = adr.data.id;
  const planId = plan.data.id;

  adr.data.plan = planId;
  plan.data.implements = uniqPush(plan.data.implements, adrId);
  plan.data.depends_on = uniqPush(plan.data.depends_on, adrId);

  return withFileRollback([adrPath, planPath], async () => {
    await write(planPath, serialize(plan.data, plan.body));
    await write(adrPath, serialize(adr.data, adr.body));
    return { adrId, planId };
  });
}

/**
 * Reciprocal supersede link (§19.7, inv 11,12): new ADR `supersedes` old id; old ADR's
 * `replaced_by:` frontmatter names the new id. (Status/dir change is done separately
 * by the atomic move.)
 */
export async function supersedeLink(oldFile, newFile, { projectDir = process.cwd(), write = atomicWrite } = {}) {
  const oldPath = resolveInside(projectDir, oldFile);
  const newPath = resolveInside(projectDir, newFile);
  const oldAdr = await read(oldPath);
  const newAdr = await read(newPath);
  const oldId = oldAdr.data.id;
  const newId = newAdr.data.id;

  newAdr.data.supersedes = uniqPush(newAdr.data.supersedes, oldId);
  oldAdr.data.replaced_by = newId;

  return withFileRollback([oldPath, newPath], async () => {
    await write(newPath, serialize(newAdr.data, newAdr.body));
    await write(oldPath, serialize(oldAdr.data, oldAdr.body));
    return { oldId, newId, replacedBy: newId };
  });
}
