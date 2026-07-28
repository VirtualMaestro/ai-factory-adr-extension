import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bodyIssues, loadProfile, readProfile, resolveDoc, FORMS } from '../src/artifacts/cnlp.js';

// A profile declares what the checker enforces, so a typo in one silently disables a check.
// These assertions are what stops that.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profiles = (await readdir(path.join(repoRoot, 'profiles'))).map((f) => f.replace(/\.md$/, '')).sort();

test('every profile file conforms to profiles/profile.md', async () => {
  const meta = await loadProfile('profile');
  for (const name of profiles) {
    const raw = await readFile(path.join(repoRoot, 'profiles', `${name}.md`), 'utf8');
    const issues = bodyIssues(raw, meta).map((i) => `${name}:${i.line}: ${i.message}`);
    assert.deepEqual(issues, []);
  }
});

for (const name of profiles) {
  test(`profiles/${name}.md declares a usable profile`, async () => {
    const p = await loadProfile(name);
    // Without this the profile is an orphan: a reader sent here by a skill never reaches the
    // rules the blocks below are shaped by.
    assert.ok(p.format, 'no format declared');
    assert.ok(existsSync(path.join(repoRoot, p.format)), `format ${JSON.stringify(p.format)} does not resolve`);
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

test('a value outside its domain is rejected at load, not read as a default', async () => {
  const raw = await readFile(path.join(repoRoot, 'profiles', 'adr.md'), 'utf8');
  assert.throws(() => readProfile(raw.replace('required: yes', 'required: ye')), /required is "ye"/);
  assert.throws(() => readProfile(raw.replace('form: bullet-list', 'form: bulet-list')), /form is "bulet-list"/);
});

// `ai-factory adr format` is the only way an adopting project reaches these files, and it
// resolves them through this function.
test('every shipped document resolves inside the package', () => {
  for (const name of ['format', ...profiles]) {
    assert.ok(existsSync(resolveDoc(name)), `${name} does not resolve to a file`);
  }
  assert.equal(path.basename(resolveDoc()), 'cnlp-format.md', 'the default is the standard');
});

// The name arrives from a command line. `profiles/${name}.md` with a `..` in it reads any
// markdown file on the machine, so a name that is a path is rejected before it becomes one.
test('a document name that is a path is rejected', () => {
  for (const bad of ['../docs/cnlp-format', '../../../../etc/passwd', 'profiles/adr', 'adr.md', 'a b', '', 'ADR']) {
    assert.throws(() => resolveDoc(bad), /not a CNL-P document name/, `accepted ${JSON.stringify(bad)}`);
  }
});

test('the ADR profile has headings and the skill profile has none', async () => {
  assert.equal((await loadProfile('skill')).headings.length, 0);
  assert.equal((await loadProfile('adr')).headings.length, 4);
});
