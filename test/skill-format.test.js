import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bodyIssues, loadProfile } from '../src/artifacts/cnlp.js';

// Conformance with the CNL-P standard, skill profile. The grammar comes from `cnlp-kit` and the
// vocabulary from this repository's `profiles/skill.md`; this file only runs them together.
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

// The README is the package page on npm, and the skills are what the package ships. A rename or
// an addition that lands in `skills/` and not in the README leaves that page describing something
// the tarball no longer contains.
test('the README names every skill', async () => {
  const readme = await readFile(path.join(repoRoot, 'README.md'), 'utf8');
  for (const name of skills) {
    // The guards keep `adr-plan-improve` from standing in for `adr-plan`, and the old `aif-adr-*`
    // names in the upgrade notes from standing in for anything.
    const named = new RegExp('(?<![\\w-])' + name + '(?![\\w-])');
    assert.match(readme, named, `README does not name ${name}`);
  }
});

// A skill runs in the adopting project, where the extension lives under .ai-factory/extensions/
// and the standard is deeper still, inside the bundled `cnlp-kit`. A path citation resolves in
// this repository and nowhere else, so the skills name the command instead.
test('no skill cites a shipped document by path', async () => {
  for (const name of skills) {
    const raw = await readFile(path.join(repoRoot, 'skills', name, 'SKILL.md'), 'utf8');
    const hit = raw.match(/((?:docs\/)?cnlp-format\.md|profiles\/[a-z]+\.md)/);
    assert.equal(hit, null, `${name}: cites ${hit?.[0]} by path — use \`ai-factory adr format\``);
  }
});
