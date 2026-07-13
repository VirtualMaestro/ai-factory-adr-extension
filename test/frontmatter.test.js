import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, serialize } from '../src/artifacts/frontmatter.js';

test('parse splits frontmatter and body, preserving the body verbatim', () => {
  const body = '\n# Title\n\nSome **markdown** with `---` inside a code span.\n';
  const src = `---\nid: adr-x\ntype: adr\nstatus: draft\n---${body}`;
  const { data, body: got, hasFrontmatter } = parse(src);
  assert.equal(hasFrontmatter, true);
  assert.deepEqual(data, { id: 'adr-x', type: 'adr', status: 'draft' });
  assert.equal(got, body.replace(/^\n/, '')); // one newline after `---` is the delimiter
});

test('serialize round-trips a parsed document body byte-for-byte', () => {
  const src = '---\nid: adr-x\nstatus: draft\n---\n\n# Title\n\nBody line.\n';
  const { data, body } = parse(src);
  data.status = 'accepted';
  const out = serialize(data, body);
  const reparsed = parse(out);
  assert.equal(reparsed.body, body);
  assert.equal(reparsed.data.status, 'accepted');
});

test('parse returns whole content as body when no frontmatter present', () => {
  const src = '# No frontmatter\n';
  const { hasFrontmatter, body } = parse(src);
  assert.equal(hasFrontmatter, false);
  assert.equal(body, src);
});

test('parse throws on malformed YAML frontmatter', () => {
  assert.throws(() => parse('---\nid: [unclosed\n---\nbody\n'), /could not be parsed/);
});
