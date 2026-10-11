import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bodyIssues, loadProfile } from '../src/artifacts/cnlp.js';

const profile = await loadProfile('plan');
const raw = await readFile(new URL('./fixtures/cnlp-plan.md', import.meta.url), 'utf8');

test('plan checkboxes survive progress updates without losing CNL-P structure', () => {
  assert.deepEqual(bodyIssues(raw, profile), []);
  assert.deepEqual(bodyIssues(raw.replaceAll('- [ ]', '- [x]'), profile), []);
});

test('plan profile rejects prose and missing task acceptance criteria', () => {
  assert.ok(bodyIssues('# Legacy plan\n\n- [ ] Add the example\n', profile).length > 0);
  const missing = raw.replace('  acceptance: prevent a missing or incorrect exported value\n', '');
  assert.ok(bodyIssues(missing, profile).some((i) => /missing "acceptance:"/.test(i.message)));
});
