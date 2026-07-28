import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bodyIssues, loadProfile } from '../src/artifacts/cnlp.js';

// Conformance with docs/cnlp-format.md, skills profile. The grammar lives in
// src/artifacts/cnlp.js and the vocabulary in profiles/skill.md; this file only runs them.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skills = (await readdir(path.join(repoRoot, 'skills'))).sort();
// The one reference-material skill: it documents the lifecycle and has no steps to run.
const NO_WORKFLOW = 'aif-adr-overview';

test('every skill body conforms to profiles/skill.md', async () => {
  const profile = await loadProfile('skill');
  for (const name of skills) {
    const raw = await readFile(path.join(repoRoot, 'skills', name, 'SKILL.md'), 'utf8');
    const issues = bodyIssues(raw, profile)
      .filter((i) => !(name === NO_WORKFLOW && /"workflow:"/.test(i.message)))
      .map((i) => `${name}:${i.line}: ${i.message}`);
    assert.deepEqual(issues, []);
  }
});

test('the reference-material skill is the only one without a workflow', async () => {
  const profile = await loadProfile('skill');
  for (const name of skills) {
    if (name === NO_WORKFLOW) continue;
    const raw = await readFile(path.join(repoRoot, 'skills', name, 'SKILL.md'), 'utf8');
    assert.ok(!bodyIssues(raw, profile).some((i) => /missing required block "workflow:"/.test(i.message)), `${name}: missing workflow`);
  }
});
