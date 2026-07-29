import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillBody = (name) => readFile(path.join(repoRoot, 'skills', name, 'SKILL.md'), 'utf8');

// The digest exists to be read before a decision is written. Nothing else asserts that the
// skills actually call it: skill-format checks the grammar, skill-rubric the rubric text.
const READERS = ['aif-adr-propose', 'aif-adr-refine', 'aif-adr-plan', 'aif-adr-accept'];

test('every authoring skill reads the decision digest', async () => {
  for (const name of READERS) {
    const body = await skillBody(name);
    assert.match(body, /ai-factory adr decisions/, `${name}: must run \`ai-factory adr decisions\``);
  }
});

test('aif-adr-plan stops on an issue against its own ADR', async () => {
  const body = await skillBody('aif-adr-plan');
  const step = body.split(/\r?\n/).find((l) => /issues:/.test(l) && /this ADR/.test(l));
  assert.ok(step, 'no step names an `issues:` entry for this ADR');
  assert.match(step, /^\d+\. stop when/, 'the step must stop, not warn: a plan on an unparsed decision rests on nothing');
});

test('aif-adr-check-consistency stops on a corpus that reports issues', async () => {
  const body = await skillBody('aif-adr-check-consistency');
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

test('aif-adr-migrate scans before it asks the operator', async () => {
  const body = await skillBody('aif-adr-migrate');
  const steps = body.split(/\r?\n/).filter((l) => /^\d+\. /.test(l));
  const scan = steps.findIndex((l) => /^\d+\. scan /.test(l));
  const ask = steps.findIndex((l) => /ask the operator where/.test(l));
  assert.ok(scan >= 0 && ask >= 0, 'both the scan step and the ask step must exist');
  assert.ok(scan < ask, 'asking before looking costs a round trip and splits Claude from Codex');
});

test('aif-adr-migrate treats a non-conformant ADR under the root as legacy', async () => {
  const body = await skillBody('aif-adr-migrate');
  const step = body.split(/\r?\n/).find((l) => /^\d+\. run `ai-factory adr status --check` over the configured root/.test(l));
  assert.ok(step, 'no workflow step checks the configured root for ADRs that are not CNL-P yet');
  assert.doesNotMatch(
    body,
    /skipping the \d+ status directories/,
    'those directories hold the pre-1.6 and pre-CNL-P files both overlays exist for',
  );
});

test('aif-adr-migrate rewrites an in-place ADR without moving or renaming it', async () => {
  const body = await skillBody('aif-adr-migrate');
  assert.match(body, /already sits at `<root>\/<status-dir>\/<id>\.md`/, 'file_shape has no in-place case');
  assert.match(body, /keep the id/, 'an in-place rename breaks depends_on, supersedes and replaced_by');
});

test('aif-adr-migrate carries over by hand and proves it', async () => {
  const body = await skillBody('aif-adr-migrate');
  assert.match(body, /do not write or run a converter over the corpus/, 'the ban lived in `purpose:` as a remark, not as a rule');
  assert.match(body, /do not split prose into items by punctuation/, 'a sentence boundary is not an idea boundary');
  assert.match(body, /adr validate <file> --strict/, 'a warning at draft would otherwise pass for a migrated file');
  assert.match(body, /^19\. state, for each item of the list from step 14/m, 'nothing forces the rewrite to account for what the original said');
});

test('aif-adr-accept checks the conflict precondition against the corpus', async () => {
  const body = await skillBody('aif-adr-accept');
  assert.match(body, /conflicts with active ADRs are resolved/, 'the precondition still stands');
  assert.match(body, /adr decisions.*precondition/s, 'a workflow step must tie the precondition to the digest');
});
