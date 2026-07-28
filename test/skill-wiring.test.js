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

test('aif-adr-accept checks the conflict precondition against the corpus', async () => {
  const body = await skillBody('aif-adr-accept');
  assert.match(body, /conflicts with active ADRs are resolved/, 'the precondition still stands');
  assert.match(body, /adr decisions.*precondition/s, 'a workflow step must tie the precondition to the digest');
});
