import { unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { read, serialize } from '../artifacts/frontmatter.js';
import { readAifPaths } from '../config/paths.js';
import { resolveInside, atomicWrite } from '../util/safe-path.js';

export function todayUTC() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Archive a plan following `aif-archive` semantics (§19.6): `status: done`, add `archived: DATE`,
 * move to `paths.archive/plans/` keeping the filename. Atomic with rollback (inv 15).
 */
export async function archivePlan(planFile, { projectDir = process.cwd() } = {}) {
  const source = resolveInside(projectDir, planFile);
  const { archivePlans } = await readAifPaths(projectDir);
  const target = path.join(archivePlans, path.basename(source));
  if (existsSync(target)) {
    throw new Error(
      'Archived plan already exists.\n' +
        `  expected: no file at ${target}\n  detected: it exists\n` +
        '  files:    nothing was changed\n  next:     resolve the duplicate archived plan',
    );
  }
  const { data, body } = await read(source);
  data.status = 'done';
  data.archived = todayUTC();
  await atomicWrite(target, serialize(data, body));
  try {
    await unlink(source);
  } catch (err) {
    await unlink(target).catch(() => {});
    throw err;
  }
  return { source, target };
}
