import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bodyIssues, loadProfile } from '../src/artifacts/cnlp.js';

// Conformance with docs/cnlp-format.md, skills profile. The grammar lives in
// src/artifacts/cnlp.js and the vocabulary in profiles/skill.md; this file only runs them.
// No skill is exempt: reference material declares `workflow: - none` with its reason.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skills = (await readdir(path.join(repoRoot, 'skills'))).sort();

test('every skill body conforms to profiles/skill.md', async () => {
  const profile = await loadProfile('skill');
  for (const name of skills) {
    const raw = await readFile(path.join(repoRoot, 'skills', name, 'SKILL.md'), 'utf8');
    const issues = bodyIssues(raw, profile).map((i) => `${name}:${i.line}: ${i.message}`);
    assert.deepEqual(issues, []);
  }
});
