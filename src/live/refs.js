import { readdirSync } from 'node:fs';
import path from 'node:path';
import { resolveInside } from '../util/safe-path.js';

/** A ref as `LIVE.md` stores it: POSIX separators, no leading `./`, no trailing `/`. */
export function normaliseRef(ref) {
  return String(ref ?? '').trim().replace(/\\/g, '/').replace(/^(?:\.\/)+/, '').replace(/\/+$/, '');
}

/**
 * Whether `rel` exists under `base` with the exact case of every segment. `existsSync` alone
 * succeeds on Windows for `Src/A.js`, and the ref then breaks on a Linux CI.
 */
function existsExact(base, rel) {
  let dir = base;
  for (const segment of rel.split('/')) {
    let names;
    try {
      names = readdirSync(dir);
    } catch {
      return false;
    }
    if (!names.includes(segment)) return false;
    dir = path.join(dir, segment);
  }
  return true;
}

/**
 * What a ref names, by lookup and never by shape: a branch named `adr-foo` gives the plan stem
 * `adr-foo`, which looks exactly like an ADR id. Every hit is returned, so the caller can tell
 * 0 (broken) from more than 1 (ambiguous).
 *
 * `ctx` = { projectDir, adrs: Map<id, { status, file, replaced_by }>, plansDir, archivePlansDir }.
 * Returns [{ kind: 'adr', id } | { kind: 'plan', file } | { kind: 'path', file }].
 */
export function resolveRef(ref, ctx) {
  const r = normaliseRef(ref);
  if (!r) return [];
  const hits = [];
  if (ctx.adrs.has(r)) hits.push({ kind: 'adr', id: r });
  if (!r.includes('/')) {
    for (const dir of [ctx.plansDir, ctx.archivePlansDir]) {
      if (existsExact(dir, `${r}.md`)) hits.push({ kind: 'plan', file: path.join(dir, `${r}.md`) });
      if (existsExact(dir, `${r}/index.md`)) hits.push({ kind: 'plan', file: path.join(dir, r, 'index.md') });
    }
  }
  let abs = null;
  try {
    abs = resolveInside(ctx.projectDir, r);
  } catch {
    return hits; // outside the project: no path hit, so the caller reports it broken, not a crash
  }
  if (existsExact(path.resolve(ctx.projectDir), r)) hits.push({ kind: 'path', file: abs });
  return hits;
}
