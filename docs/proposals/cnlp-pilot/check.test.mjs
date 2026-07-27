// Mutation tests for check.mjs: every check must actually fire.
// A linter that only ever passes is indistinguishable from no linter.
//   node --test docs/proposals/cnlp-pilot/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check } from './check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const good = readFileSync(path.join(here, 'aif-adr-migrate.SKILL.md'), 'utf8');
const BASELINE = 8384; // bytes of skills/aif-adr-migrate/SKILL.md

const fires = (name, mutate, needle) =>
  test(name, () => {
    const { problems } = check(mutate(good), { baseline: BASELINE });
    assert.ok(
      problems.some((p) => p.includes(needle)),
      `expected a finding containing "${needle}", got: ${problems.join(' | ') || '(none)'}`
    );
  });

test('the unmutated rewrite passes', () => {
  const r = check(good, { baseline: BASELINE });
  assert.deepEqual(r.problems, []);
  assert.ok(r.ids > 60, `expected the full id set, got ${r.ids}`);
});

fires('duplicate id', (t) => t.replace('F2 MUST NOT move', 'F1 MUST NOT move'), 'duplicate id');
fires('missing modal', (t) => t.replace('W6 MUST read every', 'W6 read every'), 'no leading modal');
fires('two modals on one line', (t) => t.replace('W6 MUST read every legacy file found.', 'W6 MUST read every legacy file found and MUST note its format.'), 'modals');
fires('two modals across a continuation line', (t) => t.replace('W6 MUST read every legacy file found.', 'W6 MUST read every legacy file found\n  and MUST note its format.'), 'modals');
fires('wrong prefix for the section', (t) => t.replace('\nW6 MUST read every', '\nR6 MUST read every'), 'expects "W"');
fires('unknown prefix', (t) => t.replace('\nW6 MUST read every', '\nX6 MUST read every'), 'unknown id prefix');
fires('orphan sub-id', (t) => t.replace('\nC9 the decision is documentation-only', '\nC99 the decision is documentation-only'), 'orphan');
fires('unresolved single reference', (t) => t.replace('under A4.', 'under A9.'), 'unresolved reference A9');
fires('range with a hole', (t) => t.replace('\nC4 the legacy status', '\nC44 the legacy status'), 'C1–C5: C4 is not defined');
fires('range with mixed prefixes', (t) => t.replace('the one matching case of C1–C5', 'the one matching case of C1–W5'), 'mixed prefixes');
fires('obligation with no id', (t) => t.replace('\nW6 MUST read every legacy file found.', '\nMUST read every legacy file found.'), 'obligation with no id');
fires('over budget', (t) => t + '\n<!-- ' + 'x'.repeat(2500) + ' -->', 'exceeds the +20% budget');

test('a reference inside a code fence is data, not a reference', () => {
  const withFence = good.replace('## Invocation', '## Invocation\n\n```text\nW99 O99\n```\n');
  assert.deepEqual(check(withFence, { baseline: BASELINE }).problems, []);
});

test('a case label needs no modal, but a case obligation does', () => {
  assert.deepEqual(check(good).problems, []);
  const { problems } = check(good.replace('C9.1 MUST set `evidence:', 'C9.1 set `evidence:'), {});
  assert.ok(problems.some((p) => p.includes('no leading modal')));
});
