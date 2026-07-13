import { readFile, writeFile, rename, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';

/**
 * Resolve `target` and assert it stays inside `projectDir` (§28: reject traversal / outside-project).
 * Throws on escape; returns the absolute resolved path otherwise.
 */
export function resolveInside(projectDir, target) {
  const base = path.resolve(projectDir);
  const resolved = path.resolve(base, target);
  const rel = path.relative(base, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(
      'Path escapes the project.\n' +
        `  expected: a path inside ${base}\n` +
        `  detected: ${target} → ${resolved}\n` +
        '  files:    nothing was changed\n' +
        '  next:     pass a path within the project root',
    );
  }
  return resolved;
}

/** Write atomically: tmp file in the same dir, then rename over the target (§28). */
export async function atomicWrite(file, data) {
  const tmp = `${file}.tmp`;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(tmp, data, 'utf8');
  try {
    await rename(tmp, file);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
}

/** Restore every listed file to its original bytes when `action` fails. */
export async function withFileRollback(files, action) {
  const snapshots = [];
  for (const file of new Set(files)) {
    try {
      snapshots.push([file, await readFile(file, 'utf8')]);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      snapshots.push([file, null]);
    }
  }

  try {
    return await action();
  } catch (err) {
    const rollbackErrors = [];
    for (const [file, content] of snapshots) {
      try {
        if (content === null) await unlink(file).catch((e) => { if (e.code !== 'ENOENT') throw e; });
        else await atomicWrite(file, content);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) throw new AggregateError([err, ...rollbackErrors], `Operation failed and rollback was incomplete: ${err.message}`);
    throw err;
  }
}
