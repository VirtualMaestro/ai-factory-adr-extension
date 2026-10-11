import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { readDelta, splitRefs } from './delta.js';

export const linkedAdrs = (doc) => splitRefs(doc.data.implements);

/** Only entrypoints: full plans and ultra index.md, not the bundle's task files. */
export async function readPlans(ctx) {
  const plans = [];
  for (const [dir, archived] of [[ctx.plansDir, false], [ctx.archivePlansDir, true]]) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') continue;
      throw err;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() && !(entry.isFile() && entry.name.endsWith('.md'))) continue;
      const file = path.join(dir, entry.name, ...(entry.isDirectory() ? ['index.md'] : []));
      let doc;
      try {
        doc = await readDelta(file);
      } catch (err) {
        if (err.code === 'ENOENT') continue;
        throw err;
      }
      const date = String(doc.data.archived ?? doc.content.match(/<!-- aif:archived:(\d{4}-\d{2}-\d{2}) -->/)?.[1] ?? '');
      plans.push({ file, doc, archived: archived || Boolean(date), date, completed: !/^\s*- \[ \]/m.test(doc.body) });
    }
  }
  return plans.sort((a, b) => a.file.localeCompare(b.file));
}

/** Stable through archive; fast plans need durable refs supplied in the delta. */
export function planRef(file, ctx) {
  if (file === ctx.fastPlan) return null;
  for (const dir of [ctx.plansDir, ctx.archivePlansDir]) {
    if (path.dirname(file) === dir) return path.basename(file, '.md');
    if (path.basename(file) === 'index.md' && path.dirname(path.dirname(file)) === dir) return path.basename(path.dirname(file));
  }
  return path.relative(ctx.projectDir, file).split(path.sep).join('/');
}
