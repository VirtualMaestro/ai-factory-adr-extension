import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, serialize } from './frontmatter.js';
import { slugToId, isValidId } from './id.js';
import { adrRoot, STATUS_DIRS } from '../config/paths.js';
import { DIR_BY_STATUS, isValidStatus } from '../lifecycle/status.js';
import { resolveInside, atomicWrite } from '../util/safe-path.js';

const TEMPLATE = fileURLToPath(new URL('../../templates/adr.md', import.meta.url));

class ImportError extends Error {}

/**
 * Scaffold a template-conformant ADR skeleton at a chosen status/id. Generalizes proposal creation
 * to any lifecycle status — used by migration (§19.1 for proposals; migration for existing decisions).
 * Deterministic core: derives/validates the id, guards duplicates, places the file in the status dir.
 *
 * The skeleton keeps the template placeholders (`[decision]`, `[scope]`, …) on purpose: a
 * freshly imported accepted/active skeleton is *expected* to fail `adr validate` until the agent fills
 * it. The command owns id/status/placement; the skill (agent) owns content.
 *
 * Returns { id, status, path }.
 */
export async function importAdr(topic, { status = 'proposed', id, projectDir = process.cwd() } = {}) {
  if (!isValidStatus(status)) {
    throw new ImportError(
      'Unknown lifecycle status.\n' +
        `  expected: one of ${Object.keys(DIR_BY_STATUS).join(', ')}\n` +
        `  detected: ${JSON.stringify(status)}\n` +
        '  files:    nothing was changed\n' +
        '  next:     pass a valid --status',
    );
  }

  const resolvedId = id != null ? String(id) : slugToId(topic); // slugToId throws on empty topic
  if (!isValidId(resolvedId)) {
    throw new ImportError(
      'Invalid ADR id.\n' +
        '  expected: adr-<lowercase-hyphenated-slug>\n' +
        `  detected: ${JSON.stringify(resolvedId)}\n` +
        '  files:    nothing was changed\n' +
        '  next:     pass a valid --id',
    );
  }

  const root = await adrRoot(projectDir);

  // Dup-id guard: stem == id (inv 3), so a duplicate is a file named `<id>.md` in any status dir.
  for (const dir of STATUS_DIRS) {
    if (existsSync(path.join(root, dir, `${resolvedId}.md`))) {
      throw new ImportError(
        'An ADR with this id already exists.\n' +
          `  expected: no ADR with id ${resolvedId}\n` +
          `  detected: ${dir}/${resolvedId}.md\n` +
          '  files:    nothing was changed\n' +
          '  next:     refine the existing ADR, or choose a distinct id/topic',
      );
    }
  }

  const target = resolveInside(projectDir, path.join(root, DIR_BY_STATUS[status], `${resolvedId}.md`));

  const { data, body } = parse(await readFile(TEMPLATE, 'utf8'));
  data.id = resolvedId;
  data.status = status; // template ships status: proposed; override for imported decisions
  await atomicWrite(target, serialize(data, body));

  return { id: resolvedId, status, path: target };
}
