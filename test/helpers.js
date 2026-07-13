import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { init } from '../src/init.js';
import { serialize } from '../src/artifacts/frontmatter.js';
import { DIR_BY_STATUS } from '../src/lifecycle/status.js';

/** A temp project with `.ai-factory/` marker + ADR structure initialized. */
export async function mkProject() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'adr-p1-'));
  await mkdir(path.join(dir, '.ai-factory'), { recursive: true });
  await writeFile(path.join(dir, '.ai-factory.json'), JSON.stringify({ version: '2.17.0' }), 'utf8');
  await init(dir);
  return dir;
}

const CLEAN_BODY = `\n# Title\n\n## Decision\n\nWe will use X for Y because Z.\n\n## Implementation\n\n- **Plan:** none\n- **Evidence:** not implemented\n`;

/** Write an ADR into its status directory. Returns the absolute file path. */
export async function writeAdr(dir, { id, status, type = 'adr', body = CLEAN_BODY, ...fm }) {
  const file = path.join(dir, 'docs/adr', DIR_BY_STATUS[status], `${id}.md`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, serialize({ id, type, status, ...fm }, body), 'utf8');
  return file;
}

/** Write a plan into `.ai-factory/plans` (or a custom subdir, e.g. `archive/plans`). */
export async function writePlan(dir, { id, implements: impl = [], status = 'in_progress', archived, name, subdir = 'plans' }) {
  const file = path.join(dir, '.ai-factory', subdir, `${name ?? id}.md`);
  await mkdir(path.dirname(file), { recursive: true });
  const fm = { id, type: 'plan', status, implements: impl };
  if (archived) fm.archived = archived;
  await writeFile(file, serialize(fm, '\n# Plan\n'), 'utf8');
  return file;
}
