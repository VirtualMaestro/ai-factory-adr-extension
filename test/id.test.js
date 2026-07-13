import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugToId, isValidId, stemMatchesId } from '../src/artifacts/id.js';

test('slugToId derives a stable adr- id from free text', () => {
  assert.equal(slugToId('Separate game logic from BabylonJS presentation'), 'adr-separate-game-logic-from-babylonjs-presentation');
  assert.equal(slugToId('  Logic/View  Boundary!! '), 'adr-logic-view-boundary');
});

test('slugToId does not double the adr- prefix', () => {
  assert.equal(slugToId('adr-logic-view-boundary'), 'adr-logic-view-boundary');
});

test('slugToId throws when nothing slug-able remains', () => {
  assert.throws(() => slugToId('!!!'), /Cannot derive/);
});

test('isValidId accepts canonical ids and rejects malformed ones', () => {
  assert.ok(isValidId('adr-logic-view-boundary'));
  assert.ok(!isValidId('logic-view'));       // no adr- prefix
  assert.ok(!isValidId('adr-Logic'));        // uppercase
  assert.ok(!isValidId('adr--x'));           // empty segment
  assert.ok(!isValidId(undefined));
});

test('stemMatchesId compares the filename stem to the id (inv 3)', () => {
  assert.ok(stemMatchesId('docs/adr/drafts/adr-x.md', 'adr-x'));
  assert.ok(!stemMatchesId('docs/adr/drafts/adr-y.md', 'adr-x'));
});
