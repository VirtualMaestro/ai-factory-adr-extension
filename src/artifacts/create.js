import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, serialize } from './frontmatter.js';
import { slugToId } from './id.js';
import { adrRoot, STATUS_DIRS } from '../config/paths.js';
import { resolveInside, atomicWrite } from '../util/safe-path.js';

const TEMPLATE = fileURLToPath(new URL('../../templates/adr.md', import.meta.url));

class CreateError extends Error {}

/**
 * Scaffold a new ADR proposal (§19.1): derive a stable id from the topic, guard against duplicate
 * ids anywhere in the lifecycle, and write `proposals/adr-<slug>.md` with `status: proposed` from
 * the template. Deterministic core; the agent (skill) fills Context afterwards.
 * Returns { id, path }.
 */
export async function createProposal(topic, { projectDir = process.cwd() } = {}) {
  const id = slugToId(topic); // throws on empty topic
  const root = await adrRoot(projectDir);

  // Dup-id guard: stem == id (inv 3), so a duplicate is a file named `<id>.md` in any status dir.
  for (const dir of STATUS_DIRS) {
    if (existsSync(path.join(root, dir, `${id}.md`))) {
      throw new CreateError(
        'An ADR with this id already exists.\n' +
          `  expected: no ADR with id ${id}\n` +
          `  detected: ${dir}/${id}.md\n` +
          '  files:    nothing was changed\n' +
          '  next:     refine the existing ADR, or choose a distinct topic',
      );
    }
  }

  const target = resolveInside(projectDir, path.join(root, 'proposals', `${id}.md`));

  const { data, body } = parse(await readFile(TEMPLATE, 'utf8'));
  data.id = id; // template ships status: proposed; only the id is topic-specific
  await atomicWrite(target, serialize(data, body));

  return { id, path: target };
}
