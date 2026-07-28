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

// Conformant with docs/cnlp-format.md §7 — an accepted/active ADR is validated against it (inv 12).
const CLEAN_BODY = `
# Title

## Context

problem:
- the fixture states one observable problem

constraints:
- the fixture stays conformant with docs/cnlp-format.md §7

decision_drivers:
- a body under test carries no violation of its own

## Decision

decision: use a conformant body in every fixture that writes an ADR

scope:
- covers the test fixtures
- excludes: production ADR content

rules:
1. keep this body clean of §7 and §8 violations

## Alternatives considered

alternatives:
- id: prose-body
  description: the pre-CNL-P fixture body
  rejected_because: it fails inv 12 on an accepted ADR

## Consequences

positive:
- fixtures exercise the grammar the tooling enforces

negative:
- the fixture is longer than the prose it replaces

risks:
- none: the fixture carries no decision of its own
`;

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
