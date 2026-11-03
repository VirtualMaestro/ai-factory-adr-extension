import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { adrRoot, liveFile, STATUS_DIRS } from './config/paths.js';
import { ensureConfig } from './config/adrConfig.js';
import { liveTemplate } from './live/apply.js';
import { atomicWrite } from './util/safe-path.js';
import { todayUTC } from './lifecycle/archive.js';
import { installCnlpSkills, syncCorpus, writeAgentBlock } from './cnlp-setup.js';

/**
 * Create the ADR directory structure, the default config, an empty LIVE.md and the CNL-P tooling: the
 * corpus in `cnlp.config.json`, the cnlp-kit skills and the agent block in `AGENTS.md`. Idempotent (§7):
 * re-running reports `created` for new items and `present` for ones that already existed; it never
 * overwrites a user file, and only adds corpus entries or refreshes the marked agent block (`updated`).
 * Returns { items: [{ item, path, status }] } where status ∈ created|present|updated|skipped.
 */
export async function init(projectDir = process.cwd()) {
  const root = await adrRoot(projectDir);
  const items = [];

  for (const dir of STATUS_DIRS) {
    const full = path.join(root, dir);
    const existed = existsSync(full);
    if (!existed) await mkdir(full, { recursive: true });
    items.push({ item: path.relative(projectDir, full), path: full, status: existed ? 'present' : 'created' });
  }

  const cfg = await ensureConfig(projectDir);
  items.push({ item: path.relative(projectDir, cfg.path), path: cfg.path, status: cfg.created ? 'created' : 'present' });

  // Every project keeps LIVE.md (5.0); a project with ADRs fills it with adr-live-seed.
  const live = await liveFile(projectDir);
  const liveExisted = existsSync(live);
  if (!liveExisted) await atomicWrite(live, liveTemplate(todayUTC()));
  items.push({ item: path.relative(projectDir, live), path: live, status: liveExisted ? 'present' : 'created' });

  // CNL-P tooling: the corpus before `cnlp init`, which writes an example corpus into a project with no config.
  const corpus = await syncCorpus(projectDir);
  items.push({ item: path.relative(projectDir, corpus.path), path: corpus.path, status: corpus.status });
  await installCnlpSkills(projectDir);
  const block = await writeAgentBlock(projectDir);
  items.push({ item: path.relative(projectDir, block.path), path: block.path, status: block.status });

  return { items };
}
