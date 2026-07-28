import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adrBodyIssues } from '../src/artifacts/cnlp.js';
import { validateAdr } from '../src/lifecycle/validate.js';
import { mkProject, writeAdr } from './helpers.js';

// inv 12: the ADR body is CNL-P (docs/cnlp-format.md §7-§8).

const PROSE = `
# Legacy decision

## Context

We need a session store, and the current one is not good enough.

## Decision

We will use Redis for no more than 2 services because it is faster.
`;

/** The §7 body with one block swapped for the argument. */
function bodyWith(replacement) {
  return `
# Title

## Context

problem:
- the project has no recorded decision on this topic

constraints:
- the decision stays inside this test project

decision_drivers:
- the smallest content that validates clean

## Decision

decision: use option A

scope:
- covers this test project

rules:
1. record the decision before a plan is written

## Alternatives considered

alternatives:
- id: option-b
  description: the second option
  rejected_because: it needs a second service

## Consequences

positive:
- the decision is recorded

negative:
- option B stays unavailable

risks:
- none: the test project ships nothing
${replacement}`;
}

const messages = (body) => adrBodyIssues(body).map((i) => i.message).join('\n');

test('a conformant body reports nothing', () => {
  assert.deepEqual(adrBodyIssues(bodyWith('')), []);
});

test('a prose body warns at draft and fails at accepted', async () => {
  const dir = await mkProject();
  const draft = await writeAdr(dir, { id: 'adr-prose-draft', status: 'draft', body: PROSE });
  const asDraft = await validateAdr(draft, { projectDir: dir });
  assert.deepEqual(asDraft.errors, []);
  assert.ok(asDraft.warnings.some((w) => /missing required block "problem:"/.test(w)));

  const accepted = await writeAdr(dir, { id: 'adr-prose-accepted', status: 'accepted', body: PROSE });
  const asAccepted = await validateAdr(accepted, { projectDir: dir });
  assert.ok(asAccepted.errors.some((e) => /body line \d+: .*missing|missing required block/.test(e)));
  assert.ok(asAccepted.errors.some((e) => /missing heading "## Consequences"/.test(e)));
});

test('a limit stated in prose is reported, an operator form is not (§8)', () => {
  assert.match(messages(bodyWith('\nblast_radius:\n- no more than 2 open connections per client\n')),
    /a limit is written as a comparison/);
  assert.deepEqual(adrBodyIssues(bodyWith('\nblast_radius:\n- <= 2 open connections per client\n')), []);
});

test('an unquantified comparative is reported (§8)', () => {
  assert.match(messages(bodyWith('\nblast_radius:\n- the new store is faster\n')),
    /unquantified comparative "faster"/);
});

test('a machine field in the body is reported (§7)', () => {
  assert.match(messages(bodyWith('\ncode:\n- src/store.js\n')),
    /"code:" is a frontmatter field/);
});

test('alternatives records carry the declared key set (§7)', () => {
  const missing = bodyWith('').replace('  rejected_because: it needs a second service\n', '');
  assert.match(messages(missing), /alternative is missing "rejected_because:"/);

  const stray = bodyWith('').replace('  description: the second option',
    '  description: the second option\n  reversibility: high');
  assert.match(messages(stray), /"reversibility" is not an alternative key/);
});

test('block form and emptiness are checked (§3, §7)', () => {
  const unnumbered = bodyWith('').replace('1. record the decision', '- record the decision');
  assert.match(messages(unnumbered), /"rules:" is a numbered-list/);

  const empty = bodyWith('').replace('- the decision is recorded\n', '');
  assert.match(messages(empty), /"positive:" is empty/);

  const scalar = bodyWith('').replace('decision: use option A', 'decision:');
  assert.match(messages(scalar), /"decision:" is a scalar/);
});
