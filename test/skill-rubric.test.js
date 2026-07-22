import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FULL = [
  'aif-adr-propose',
  'aif-adr-refine',
  'aif-adr-reconcile',
  'aif-adr-plan',
  'aif-adr-plan-improve'
];
const SHORT = ['aif-adr-implement', 'aif-adr-verify', 'aif-adr-verify-all', 'aif-adr-finalize', 'aif-adr-accept'];
const NONE = ['aif-adr-next', 'aif-adr-migrate', 'aif-adr-supersede', 'aif-adr-status', 'aif-adr-overview'];

const HEADING = '## Evaluating solutions';

async function skillBody(name) {
  return readFile(path.join(repoRoot, 'skills', name, 'SKILL.md'), 'utf8');
}

function extractSection(body) {
  const lines = body.split(/\r?\n/);
  const starts = lines.flatMap((line, i) => (line.trim() === HEADING ? [i] : []));
  if (starts.length !== 1) return { count: starts.length };
  const start = starts[0];
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { count: 1, start, text: lines.slice(start, end).join('\n').trimEnd() };
}

test('each target skill has exactly one rubric section, placed before the workflow heading', async () => {
  for (const name of [...FULL, ...SHORT]) {
    const body = await skillBody(name);
    const section = extractSection(body);
    assert.equal(section.count, 1, `${name}: expected exactly one "${HEADING}" section`);
    const workflowIndex = body.split(/\r?\n/).findIndex((line) => /^## .*workflow/i.test(line));
    assert.ok(workflowIndex !== -1, `${name}: no workflow heading found`);
    assert.ok(section.start < workflowIndex, `${name}: rubric must precede the workflow heading`);
  }
});

test('rubric text is identical within each variant group', async () => {
  for (const group of [FULL, SHORT]) {
    const texts = await Promise.all(group.map(async (name) => extractSection(await skillBody(name)).text));
    for (let i = 1; i < texts.length; i++) {
      assert.equal(texts[i], texts[0], `${group[i]}: rubric differs from ${group[0]}`);
    }
  }
});

test('non-target skills carry no rubric section', async () => {
  for (const name of NONE) {
    const body = await skillBody(name);
    assert.ok(!body.includes(HEADING), `${name}: must not contain "${HEADING}"`);
  }
});
