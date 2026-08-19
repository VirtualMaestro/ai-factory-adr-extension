import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bodyIssues, loadProfile, profileNames, resolveDoc, FORMS } from '../src/artifacts/cnlp.js';

// The checker, the standard and the generic profiles are `cnlp-kit`'s and are tested there. What
// this file asserts is the seam: that `profiles/skill.md` — this repository's own section
// vocabulary — is a profile the packaged checker can read, and that the 2 profiles this extension
// consumes resolve to the right side of that seam.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USED = ['adr', 'skill']; // `adr` comes from the package, `skill` is the local overlay

test('profiles/skill.md conforms to the packaged profiles/profile.md', async () => {
  const meta = await loadProfile('profile');
  const raw = await readFile(path.join(repoRoot, 'profiles', 'skill.md'), 'utf8');
  assert.deepEqual(bodyIssues(raw, meta).map((i) => `skill:${i.line}: ${i.message}`), []);
});

for (const name of USED) {
  test(`profiles/${name}.md declares a usable profile`, async () => {
    const p = await loadProfile(name);
    // Without this the profile is an orphan: a reader sent here by a skill never reaches the
    // rules the blocks below are shaped by.
    assert.ok(p.format, 'no format declared');
    assert.ok(existsSync(resolveDoc('format')), `format ${JSON.stringify(p.format)} does not resolve`);
    assert.ok(p.sections.length > 0, 'no sections declared');
    assert.ok(['imperative', 'declarative'].includes(p.mood), `unknown mood ${JSON.stringify(p.mood)}`);
    assert.ok(p.sections.some((s) => s.required), 'no required section');

    const keys = p.sections.map((s) => s.key);
    assert.deepEqual([...new Set(keys)], keys, 'a section is declared twice');
    for (const s of p.sections) {
      assert.ok(s.key, `a section record has no key: ${JSON.stringify(s)}`);
      assert.ok(FORMS.has(s.form), `${s.key}: unknown form ${JSON.stringify(s.form)}`);
      if (s.form === 'record-list' || s.form === 'keyed-block') {
        assert.ok(s.recordKeys.length > 0, `${s.key}: ${s.form} declares no record_keys`);
      }
      if (s.heading) assert.ok(p.headings.includes(s.heading), `${s.key}: heading ${JSON.stringify(s.heading)} is not declared`);
    }
  });
}

// `bodyIssues` checks block order and heading placement separately, so a block declared after
// one whose heading comes later warns whatever the author does: the profile asks for a body
// nobody can write. This is the rule that makes the 2 checks agree.
test('every profile can be satisfied — block order agrees with heading order', async () => {
  for (const name of USED) {
    const p = await loadProfile(name);
    const rank = p.sections.map((s) => p.headings.indexOf(s.heading)).filter((i) => i >= 0);
    assert.deepEqual(rank, [...rank].sort((a, b) => a - b),
      `profiles/${name}.md declares a block under an earlier heading than the block before it`);
  }
});

// The whole point of the adapter in `src/artifacts/cnlp.js`: the local file wins for `skill`, the
// package supplies everything else. Reversed, the 16 skills get checked against a profile that
// declares none of their sections.
test('the local overlay shadows the package, and only the local overlay', () => {
  assert.equal(resolveDoc('skill'), path.join(repoRoot, 'profiles', 'skill.md'));
  for (const name of ['format', 'adr', 'profile']) {
    assert.ok(resolveDoc(name).includes(`node_modules${path.sep}cnlp-kit`), `${name} did not come from the package`);
  }
  assert.equal(path.basename(resolveDoc()), 'cnlp-format.md', 'the default is the standard');
});

test('every document `adr format` offers resolves to a file', async () => {
  for (const name of ['format', ...(await profileNames())]) {
    assert.ok(existsSync(resolveDoc(name)), `${name} does not resolve to a file`);
  }
});

// The name arrives from a command line. `profiles/${name}.md` with a `..` in it reads any
// markdown file on the machine, so a name that is a path is rejected before it becomes one.
// The adapter forwards to the package, so this asserts the guard survives that hop.
test('a document name that is a path is rejected', () => {
  for (const bad of ['../docs/cnlp-format', '../../../../etc/passwd', 'profiles/adr', 'adr.md', 'a b', '', 'ADR']) {
    assert.throws(() => resolveDoc(bad), /not a CNL-P document name/, `accepted ${JSON.stringify(bad)}`);
  }
});

test('the ADR profile has headings and the skill profile has none', async () => {
  assert.equal((await loadProfile('skill')).headings.length, 0);
  assert.equal((await loadProfile('adr')).headings.length, 4);
});
