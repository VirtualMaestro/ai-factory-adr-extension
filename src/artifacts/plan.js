import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { read } from './frontmatter.js';
import { readAifPaths } from '../config/paths.js';

const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

async function listMarkdown(dir) {
  try {
    return (await readdir(dir)).filter((f) => f.endsWith('.md')).map((f) => path.join(dir, f));
  } catch {
    return []; // absent directory → no plans
  }
}

/**
 * Resolve plans implementing `adrId` via the `implements` frontmatter (§15, inv 8) — never by
 * filename (tolerates `NNNN_` sequential prefixes). Scans both the live plans dir and the archive.
 * A plan counts as archived if it lives under the archive dir, has `status: done`, or has `archived:`.
 * Returns { plans, active } where `active` = non-archived plans.
 */
export async function resolvePlans(adrId, { projectDir = process.cwd() } = {}) {
  const { plans: plansDir, archivePlans } = await readAifPaths(projectDir);
  const files = [
    ...(await listMarkdown(plansDir)).map((f) => ({ f, inArchive: false })),
    ...(await listMarkdown(archivePlans)).map((f) => ({ f, inArchive: true })),
  ];

  const plans = [];
  for (const { f, inArchive } of files) {
    let data;
    try {
      ({ data } = await read(f));
    } catch {
      continue; // unparseable file is not a resolvable plan
    }
    if (!asArray(data.implements).includes(adrId)) continue;
    const archived = inArchive || data.status === 'done' || data.archived != null;
    plans.push({ file: f, id: data.id, status: data.status, archived });
  }

  return { plans, active: plans.filter((p) => !p.archived) };
}

/**
 * The single non-archived plan for an ADR, or null. Throws on >1 (inv 7 / Acc 28).
 */
export async function resolveActivePlan(adrId, opts) {
  const { active } = await resolvePlans(adrId, opts);
  if (active.length > 1) {
    throw new Error(
      'Multiple non-archived plans implement one ADR.\n' +
        `  expected: at most one active plan for ${adrId}\n` +
        `  detected: ${active.map((p) => p.id).join(', ')}\n` +
        '  files:    nothing was changed\n' +
        '  next:     archive or remove the extra plan(s)',
    );
  }
  return active[0] ?? null;
}
