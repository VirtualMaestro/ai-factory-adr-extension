import { writeFile, rename, mkdir, unlink } from 'node:fs/promises';
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
