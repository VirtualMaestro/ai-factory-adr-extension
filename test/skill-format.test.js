import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBlocks, DENY, SPELLED_THRESHOLD, HARD_LIMIT } from '../src/artifacts/cnlp.js';

// Mechanical conformance with docs/cnlp-format.md §2-§6, skills profile. The grammar itself
// lives in src/artifacts/cnlp.js, shared with `adr validate`; this file only asserts on it.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skills = (await readdir(path.join(repoRoot, 'skills'))).sort();

const REQUIRED = ['mode', 'purpose', 'inputs', 'invocation'];
const KNOWN = new Set([
  // §5, in order
  'mode', 'purpose', 'inputs', 'preconditions', 'scope', 'forbidden_behaviors', 'outputs',
  'quality_rules', 'workflow', 'transitions', 'status_footer', 'invocation',
  // §6 custom sections
  'command_behaviour', 'documentation_only_adrs', 'documentation_only_overlay',
  'expected_warnings', 'file_shape', 'follow_up', 'improving_the_plan', 'instruction_pointer',
  'lenses', 'lifecycle_flow', 'linear_flow_skills', 'off_flow_skills', 'order_fields',
  'plan_disposition', 'plan_frontmatter', 'pre_cnlp_overlay', 'report_format', 'retrieval_order_afterwards',
  'rules_that_always_hold', 'status_directories', 'status_mapping', 'targeting_rationale',
  'verdicts', 'when_to_supersede_instead_of_editing'
]);
const ORDER = ['mode', 'purpose', 'inputs', 'preconditions', 'scope', 'forbidden_behaviors',
  'outputs', 'quality_rules', 'workflow', 'transitions', 'status_footer', 'invocation'];
const REFERENCE_ONLY = new Set(['aif-adr-overview']); // §5: the one skill with no workflow

async function parse(name) {
  return parseBlocks(await readFile(path.join(repoRoot, 'skills', name, 'SKILL.md'), 'utf8'));
}

test('every skill declares the required sections', async () => {
  for (const name of skills) {
    const { sections } = await parse(name);
    const keys = sections.map((s) => s.key);
    for (const req of REQUIRED) assert.ok(keys.includes(req), `${name}: missing "${req}:"`);
    if (!REFERENCE_ONLY.has(name)) assert.ok(keys.includes('workflow'), `${name}: missing "workflow:"`);
  }
});

test('no section name outside the known vocabulary', async () => {
  for (const name of skills) {
    const { sections } = await parse(name);
    for (const { key, line } of sections) {
      assert.ok(KNOWN.has(key), `${name}:${line}: unknown section "${key}:" — add it to docs/cnlp-format.md §6 or reuse a listed name`);
    }
  }
});

test('the standard sections keep their declared order', async () => {
  for (const name of skills) {
    const { sections } = await parse(name);
    const seen = sections.map((s) => s.key).filter((k) => ORDER.includes(k));
    const sorted = [...seen].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    assert.deepEqual(seen, sorted, `${name}: sections out of order`);
  }
});

test('status_footer sub-keys are indented under it', async () => {
  for (const name of skills) {
    const { lines } = await parse(name);
    const at = lines.indexOf('status_footer:');
    if (at < 0) continue;
    const next = lines.slice(at + 1).find((l) => l.trim() !== '');
    assert.ok(/^ {2}\S/.test(next ?? ''), `${name}: "status_footer:" must be followed by indented format:/source: (§3 keyed-block), got ${JSON.stringify(next)}`);
  }
});

test('prohibition is written "do not", never "never"', async () => {
  for (const name of skills) {
    const { lines } = await parse(name);
    lines.forEach((l, i) => {
      assert.ok(!/^- never\b/.test(l), `${name}:${i + 1}: bullet opens with "never" — §8 uses "do not"`);
    });
  }
});

test('no deny-list word appears in a body', async () => {
  for (const name of skills) {
    const { lines } = await parse(name);
    lines.forEach((l, i) => {
      const hit = l.match(DENY);
      assert.ok(!hit, `${name}:${i + 1}: deny-list word "${hit?.[0]}" — see docs/cnlp-format.md §8`);
    });
  }
});

test('a quantified threshold is written as a digit', async () => {
  for (const name of skills) {
    const { lines } = await parse(name);
    lines.forEach((l, i) => {
      const hit = l.match(SPELLED_THRESHOLD);
      assert.ok(!hit, `${name}:${i + 1}: "${hit?.[0]}" — a threshold is a digit, see docs/cnlp-format.md §8`);
    });
  }
});

test('no bullet or step exceeds the hard length limit', async () => {
  for (const name of skills) {
    const { lines } = await parse(name);
    lines.forEach((l, i) => {
      if (!/^(-|\d+\.) /.test(l)) return;
      assert.ok(l.length <= HARD_LIMIT, `${name}:${i + 1}: ${l.length} chars exceeds ${HARD_LIMIT} — it is holding more than one idea`);
    });
  }
});
