import path from 'node:path';
import { read, serialize } from './frontmatter.js';
import { atomicWrite, resolveInside, withFileRollback } from '../util/safe-path.js';

function uniqPush(value, item) {
  const arr = Array.isArray(value) ? value : value == null ? [] : [value];
  if (!arr.includes(item)) arr.push(item);
  return arr;
}

/** Replace a `- **Label:** …` line in the body; append under a heading is out of scope (template seeds it). */
export function setField(body, label, value) {
  const re = new RegExp(`^- \\*\\*${label}:\\*\\* .*$`, 'm');
  const line = `- **${label}:** ${value}`;
  return re.test(body) ? body.replace(re, line) : body;
}

/**
 * Reciprocal ADR↔plan link (§19.4, inv 8,9): plan `implements`/`depends_on` the ADR;
 * ADR `affects` the plan and its Implementation section names the plan.
 */
export async function linkPlan(adrFile, planFile, { projectDir = process.cwd(), write = atomicWrite } = {}) {
  const adrPath = resolveInside(projectDir, adrFile);
  const planPath = resolveInside(projectDir, planFile);
  const adr = await read(adrPath);
  const plan = await read(planPath);
  const adrId = adr.data.id;
  const planId = plan.data.id;

  adr.data.affects = uniqPush(adr.data.affects, planId);
  plan.data.implements = uniqPush(plan.data.implements, adrId);
  plan.data.depends_on = uniqPush(plan.data.depends_on, adrId);
  const adrBody = setField(adr.body, 'Plan', planId);

  return withFileRollback([adrPath, planPath], async () => {
    await write(planPath, serialize(plan.data, plan.body));
    await write(adrPath, serialize(adr.data, adrBody));
    return { adrId, planId };
  });
}

/**
 * Reciprocal supersede link (§19.7, inv 11,12): new ADR `supersedes` old id; old ADR's
 * `Replaced by` reference points at the new file with a correct relative path.
 * (Status/dir change is done separately by the atomic move.)
 */
export async function supersedeLink(oldFile, newFile, { projectDir = process.cwd(), write = atomicWrite } = {}) {
  const oldPath = resolveInside(projectDir, oldFile);
  const newPath = resolveInside(projectDir, newFile);
  const oldAdr = await read(oldPath);
  const newAdr = await read(newPath);
  const oldId = oldAdr.data.id;
  const newId = newAdr.data.id;

  newAdr.data.supersedes = uniqPush(newAdr.data.supersedes, oldId);
  // All status dirs are siblings at equal depth, so the relative path is stable across the old file's
  // pending move into superseded/.
  const rel = path.relative(path.dirname(oldPath), newPath).split(path.sep).join('/');
  const oldBody = setField(oldAdr.body, 'Replaced by', rel);

  return withFileRollback([oldPath, newPath], async () => {
    await write(newPath, serialize(newAdr.data, newAdr.body));
    await write(oldPath, serialize(oldAdr.data, oldBody));
    return { oldId, newId, replacedBy: rel };
  });
}
