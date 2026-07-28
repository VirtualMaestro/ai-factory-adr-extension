import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bodyIssues, loadProfile } from '../src/artifacts/cnlp.js';

// Conformance with docs/cnlp-format.md, skills profile. The grammar lives in
// src/artifacts/cnlp.js and the vocabulary in profiles/skill.md; this file only runs them.
// No skill is exempt: reference material declares `workflow: - none` with its reason.

const SKILLS_DIR = 'skills'; // where this repository keeps skills, relative to its root

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skills = (await readdir(path.join(repoRoot, SKILLS_DIR))).sort();

test('every skill body conforms to profiles/skill.md', async () => {
  const profile = await loadProfile('skill');
  for (const name of skills) {
    const raw = await readFile(path.join(repoRoot, SKILLS_DIR, name, 'SKILL.md'), 'utf8');
    const issues = bodyIssues(raw, profile).map((i) => `${name}:${i.line}: ${i.message}`);
    assert.deepEqual(issues, []);
  }
});

// cnlp-kit:strip-start — this guard is about shipping skills inside a package; a repository
// that keeps its skills and its standard side by side cites them by path on purpose, so
// cnlp-kit/export.mjs drops this block on the way out.
//
// A skill runs in the adopting project, where the extension lives under
// .ai-factory/extensions/ and neither `profiles/` nor `docs/` is at the root. A path citation
// resolves in this repository and nowhere else, so the skills name the command instead.
test('no skill cites a shipped document by path', async () => {
  for (const name of skills) {
    const raw = await readFile(path.join(repoRoot, 'skills', name, 'SKILL.md'), 'utf8');
    const hit = raw.match(/(docs\/cnlp-format\.md|profiles\/[a-z]+\.md)/);
    assert.equal(hit, null, `${name}: cites ${hit?.[0]} by path — use \`ai-factory adr format\``);
  }
});
// cnlp-kit:strip-end
