import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { adrRoot, STATUS_DIRS } from './config/paths.js';
import { ensureConfig } from './config/adrConfig.js';

/**
 * Create the ADR directory structure + default config. Idempotent (§7): re-running reports
 * `created` for new items and `present` for ones that already existed; never overwrites.
 * Returns { items: [{ item, path, status }] } where status ∈ created|present.
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

  return { items };
}
