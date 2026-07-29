import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bodyIssues, loadProfile } from '../src/artifacts/cnlp.js';
import { validateAdr } from '../src/lifecycle/validate.js';
import { mkProject, writeAdr } from './helpers.js';

// inv 12: the ADR body is CNL-P, shaped by profiles/adr.md.

const profile = await loadProfile('adr');
const adrBodyIssues = (raw) => bodyIssues(raw, profile);

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

test('a limit whose bound is open is reported, the canonical form is not', () => {
  assert.match(messages(bodyWith('\nblast_radius:\n- no more than 2 open connections per client\n')),
    /leaves its bound open/);
  assert.deepEqual(adrBodyIssues(bodyWith('\nblast_radius:\n- open connections per client <= 2\n')), []);
});

test('an unquantified comparative is reported, quoted text is not', () => {
  assert.match(messages(bodyWith('\nblast_radius:\n- the new store is faster\n')),
    /unquantified comparative "faster"/);
  // A claim named in order to reject it is data, not a claim the document makes.
  assert.deepEqual(adrBodyIssues(bodyWith('\nblast_radius:\n- do not accept "faster to write" as a reason\n')), []);
});

test('a machine field in the body is reported', () => {
  assert.match(messages(bodyWith('\ncode:\n- src/store.js\n')),
    /"code:" is a frontmatter field/);
});

test('alternatives records carry the declared key set', () => {
  const missing = bodyWith('').replace('  rejected_because: it needs a second service\n', '');
  assert.match(messages(missing), /record is missing "rejected_because:"/);

  const stray = bodyWith('').replace('  description: the second option',
    '  description: the second option\n  reversibility: high');
  assert.match(messages(stray), /"reversibility" is not a "alternatives:" key/);
});

test('a block placed under the wrong heading is reported', () => {
  const moved = bodyWith('').replace('risks:\n- none: the test project ships nothing',
    '')
    .replace('problem:', 'risks:\n- none: the test project ships nothing\n\nproblem:');
  assert.match(messages(moved), /"risks:" belongs under "## Consequences", found under "## Context"/);
});

test('a structurally ambiguous body is reported', () => {
  const twice = bodyWith('\nrisks:\n- a second copy\n');
  assert.match(messages(twice), /block "risks:" appears more than 1 time/);

  const strayHeading = bodyWith('\n## Notes\n');
  assert.match(messages(strayHeading), /unknown heading "## Notes"/);

  const twiceHeading = bodyWith('\n## Context\n');
  assert.match(messages(twiceHeading), /heading "## Context" appears more than 1 time/);

  const dupKey = bodyWith('').replace('  description: the second option',
    '  description: the second option\n  description: and again');
  assert.match(messages(dupKey), /record carries "description:" more than 1 time/);

  const misnumbered = bodyWith('').replace('1. record the decision before a plan is written',
    '1. record the decision before a plan is written\n3. then plan');
  assert.match(messages(misnumbered), /step 3 is out of sequence/);
});

test('a required block says it has nothing the same way in every form', () => {
  const none = bodyWith('').replace(/alternatives:\n[\s\S]*?rejected_because: it needs a second service/,
    'alternatives:\n- none: no other approach was viable at this size');
  assert.deepEqual(adrBodyIssues(none), []);

  const bare = none.replace('- none: no other approach was viable at this size', '- none');
  assert.match(messages(bare), /states "- none" without the reason/);

  // The sentinel says the block is empty, so anything beside it says it is not.
  const alongside = bodyWith('').replace('- the decision is recorded',
    '- none: nothing improves\n- the decision is recorded');
  assert.match(messages(alongside), /states "- none" alongside other items/);

  // An optional block with nothing to say is deleted, not marked.
  const optional = bodyWith('\nblast_radius:\n- none: no code changes\n');
  assert.match(messages(optional), /is optional and has nothing to say — delete the block/);
});

test('the hard length limit covers a scalar, not only a bullet', () => {
  const long = bodyWith('').replace('decision: use option A', `decision: ${'A'.repeat(260)}`);
  assert.match(messages(long), /exceeds the 250 hard limit/);
});

// What a mechanical conversion of a legacy ADR leaves behind: an ordinal read as a sentence,
// and a line cut to fit the hard limit. Neither is catchable as prose, both are catchable here.
test('an item with no word, and a line cut mid-span, are reported', () => {
  const ordinal = bodyWith('').replace('1. record the decision before a plan is written', '1. 4');
  assert.match(messages(ordinal), /carries no word — it states no claim/);

  const backtick = bodyWith('').replace('- the decision is recorded', '- the decision is recorded in `docs');
  assert.match(messages(backtick), /unclosed backtick/);

  const paren = bodyWith('').replace('- the decision is recorded', '- the decision is recorded (with evidence');
  assert.match(messages(paren), /unclosed parenthesis/);

  // A whole item and a balanced span stay silent: these checks fire on damage, not on style.
  assert.deepEqual(adrBodyIssues(bodyWith('')), []);
});

test('block form and emptiness are checked (§3, §7)', () => {
  const unnumbered = bodyWith('').replace('1. record the decision', '- record the decision');
  assert.match(messages(unnumbered), /"rules:" is a numbered-list/);

  const empty = bodyWith('').replace('- the decision is recorded\n', '');
  assert.match(messages(empty), /"positive:" is empty/);

  const scalar = bodyWith('').replace('decision: use option A', 'decision:');
  assert.match(messages(scalar), /"decision:" is a scalar/);
});
