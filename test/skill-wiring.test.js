import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillBody = (name) => readFile(path.join(repoRoot, 'skills', name, 'SKILL.md'), 'utf8');

// The digest exists to be read before a decision is written. Nothing else asserts that the
// skills actually call it: skill-format checks the grammar, skill-rubric the rubric text.
const READERS = ['adr-propose', 'adr-improve', 'adr-plan', 'adr-accept'];

test('every authoring skill reads the decision digest', async () => {
  for (const name of READERS) {
    const body = await skillBody(name);
    assert.match(body, /ai-factory adr decisions/, `${name}: must run \`ai-factory adr decisions\``);
  }
});

test('adr-plan stops on an issue against its own ADR', async () => {
  const body = await skillBody('adr-plan');
  const step = body.split(/\r?\n/).find((l) => /issues:/.test(l) && /this ADR/.test(l));
  assert.ok(step, 'no step names an `issues:` entry for this ADR');
  assert.match(step, /^\d+\. stop when/, 'the step must stop, not warn: a plan on an unparsed decision rests on nothing');
});

test('adr-check-consistency stops on a corpus that reports issues', async () => {
  const body = await skillBody('adr-check-consistency');
  const step = body.split(/\r?\n/).find((l) => /^\d+\. stop/.test(l) && /issues:/.test(l));
  assert.ok(step, 'no workflow step stops on `issues:` — a sweep over a holed corpus reports what it cannot see');
});

test('every skill that reads the digest judges by all 4 required blocks', async () => {
  for (const name of READERS) {
    const body = await skillBody(name);
    const line = body.split(/\r?\n/).find((l) => /open in full/.test(l));
    assert.ok(line, `${name}: no step opens the overlapping ADRs in full`);
    for (const block of ['decision:', 'constraints:', 'scope:', 'rules:']) {
      assert.ok(line.includes(`\`${block}\``), `${name}: the full-read step ignores \`${block}\``);
    }
  }
});

test('adr-migrate scans before it asks the operator', async () => {
  const body = await skillBody('adr-migrate');
  const steps = body.split(/\r?\n/).filter((l) => /^\d+\. /.test(l));
  const scan = steps.findIndex((l) => /^\d+\. scan /.test(l));
  const ask = steps.findIndex((l) => /ask the operator where/.test(l));
  assert.ok(scan >= 0 && ask >= 0, 'both the scan step and the ask step must exist');
  assert.ok(scan < ask, 'asking before looking costs a round trip and splits Claude from Codex');
});

test('adr-migrate treats a non-conformant ADR under the root as legacy', async () => {
  const body = await skillBody('adr-migrate');
  const step = body.split(/\r?\n/).find((l) => /^\d+\. run `ai-factory adr status --check` over the configured root/.test(l));
  assert.ok(step, 'no workflow step checks the configured root for ADRs that are not CNL-P yet');
  assert.doesNotMatch(
    body,
    /skipping the \d+ status directories/,
    'those directories hold the pre-1.6 and pre-CNL-P files both overlays exist for',
  );
});

test('adr-migrate rewrites an in-place ADR without moving or renaming it', async () => {
  const body = await skillBody('adr-migrate');
  assert.match(body, /already sits at `<root>\/<status-dir>\/<id>\.md`/, 'file_shape has no in-place case');
  assert.match(body, /keep the id/, 'an in-place rename breaks depends_on, supersedes and replaced_by');
});

test('adr-migrate carries over by hand and proves it', async () => {
  const body = await skillBody('adr-migrate');
  assert.match(body, /do not write or run a converter over the corpus/, 'the ban lived in `purpose:` as a remark, not as a rule');
  assert.match(body, /do not split prose into items by punctuation/, 'a sentence boundary is not an idea boundary');
  assert.match(body, /adr validate <file> --strict/, 'a warning at draft would otherwise pass for a migrated file');
  assert.match(body, /^18\. state, for each item of the list from step 13/m, 'nothing forces the rewrite to account for what the original said');
});

// A test written after its fix never saw the bug: it passes on the fixed code and proves nothing.
test('adr-auto-implement sees a test fail before it fixes a finding', async () => {
  const body = await skillBody('adr-auto-implement');
  const steps = body.split(/\r?\n/).filter((l) => /^\d+\. /.test(l));
  const red = steps.findIndex((l) => /^\d+\. write a test that reproduces/.test(l) && /see it fail/.test(l));
  const fix = steps.findIndex((l) => /^\d+\. fix every listed finding/.test(l));
  assert.ok(red >= 0 && fix >= 0, 'both the failing-test step and the fix step must exist');
  assert.ok(red < fix, 'the failing test must come before the fix');
});

test('adr-auto-implement fixes no anomaly that no test reproduces', async () => {
  const body = await skillBody('adr-auto-implement');
  const step = body.split(/\r?\n/).find((l) => /^\d+\. record an anomaly no test reproduces/.test(l));
  assert.ok(step, 'no step records an anomaly no test reproduces');
  assert.match(step, /do not fix it/, 'an observation of a non-deterministic agent would drive a fix');
});

test('adr-accept checks the conflict precondition against the corpus', async () => {
  const body = await skillBody('adr-accept');
  assert.match(body, /resolves .*every conflict with an active ADR/, 'the precondition still stands');
  assert.match(body, /adr decisions.*precondition/s, 'a workflow step must tie the precondition to the digest');
});

// run_modes names steps by number, so a renumbered workflow silently moves a mode onto the wrong steps.
// Each step is classified by its own text; every step must be taken by exactly the modes expected.
test('adr-auto-change modes take exactly the steps of their phase', async () => {
  const lines = (await skillBody('adr-auto-change')).split(/\r?\n/);
  const steps = lines.filter((l) => /^\d+\. /.test(l));
  const at = (re) => {
    const i = steps.findIndex((l) => re.test(l));
    assert.ok(i >= 0, `no step matches ${re}`);
    return i;
  };
  const ALL = ['plan', 'implement', 'full'];
  const BUILD = ['implement', 'full'];
  const IMPROVE = ['plan', 'full'];
  const expected = new Array(steps.length);
  const span = (from, to, modes) => { for (let i = at(from); i <= at(to); i++) expected[i] = modes; };
  span(/^\d+\. read the mode/, /^\d+\. read the mode/, ALL);
  span(/^\d+\. stop on an `implement` input/, /^\d+\. stop on an `implement` input/, ['implement']);
  span(/^\d+\. read `\.ai-factory\/config\.yaml`/, /^\d+\. record the exact pre-existing/, ALL);
  span(/^\d+\. run `adr\.acceptance\.command` once/, /^\d+\. stop when `adr\.acceptance\.exploratory/, BUILD);
  span(/^\d+\. read `ai-factory adr live`/, /^\d+\. read `ai-factory adr format`/, ALL);
  span(/^\d+\. apply `aif-improve`/, /^\d+\. stop improvement after/, IMPROVE);
  span(/^\d+\. ask the operator each principled question/, /^\d+\. ask the operator each principled question/, ['plan']);
  span(/^\d+\. stop on a principled question/, /^\d+\. stop on a principled question/, ['full']);
  span(/--dry-run` before the plan commit or implementation/, /--dry-run` before the plan commit or implementation/, ALL);
  span(/^\d+\. stage by name the plan entrypoint/, /^\d+\. push the plan commit/, ['plan']);
  span(/^\d+\. apply `aif-implement`/, /^\d+\. skip step \d+ when `git\.skip_push_after_commit`/, BUILD);
  span(/^\d+\. record 1 row per stage/, /^\d+\. report the status footer/, ALL);
  const taken = (name) => {
    const line = lines.find((l) => l.startsWith(`- ${name}: run steps `));
    assert.ok(line, `run_modes has no line for ${name}`);
    const set = new Set();
    for (const [, a, b] of line.split(':')[1].matchAll(/(\d+)(?: to (\d+))?/g)) {
      for (let n = Number(a); n <= Number(b ?? a); n++) set.add(n);
    }
    return set;
  };
  const modes = { plan: taken('`plan`'), implement: taken('`implement`'), full: taken('no mode word') };
  steps.forEach((l, i) => {
    assert.ok(expected[i], `step ${i + 1} belongs to no phase of this test: ${l}`);
    for (const m of ALL) assert.equal(modes[m].has(i + 1), expected[i].includes(m), `${m} and step ${l}`);
  });
  for (const m of ALL) assert.ok(Math.max(...modes[m]) <= steps.length, `${m} names a missing step`);
});
