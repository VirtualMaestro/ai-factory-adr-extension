import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildDecisions, renderDecisions } from '../src/decisions.js';
import { serialize } from '../src/artifacts/frontmatter.js';
import { mkProject, writeAdr } from './helpers.js';

const EV = { evidence: 'implemented' };

const body = ({ decision = 'pick one thing', constraints = ['- keep the boundary'], scope = ['- the module', '- excludes: everything else'], rules = ['1. the obligation'] } = {}) => `
# Title

## Decision

decision: ${decision}

constraints:
${constraints.join('\n')}

scope:
${scope.join('\n')}

rules:
${rules.join('\n')}
`;

/** An ADR written where `writeAdr` cannot put it: a foreign root, or a status the file denies. */
async function writeRaw(dir, { root = 'docs/adr', statusDir, id, fm = {}, text }) {
  const file = path.join(dir, root, statusDir, `${id}.md`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text ?? serialize({ id, type: 'adr', ...fm }, body()), 'utf8');
  return file;
}

test('an accepted ADR is reduced to decision, constraints, scope, excludes and rules', async () => {
  const dir = await mkProject();
  await writeAdr(dir, {
    id: 'adr-one',
    status: 'accepted',
    affects: ['cnlp'],
    depends_on: ['adr-zero'],
    code: ['src/a.js#parseBlocks'],
    body: body(),
  });

  const { items, issues } = await buildDecisions({ projectDir: dir });
  assert.deepEqual(issues, [], 'a conformant ADR raises nothing');
  assert.equal(items.length, 1);
  const it = items[0];
  assert.deepEqual(Object.keys(it).sort(), [
    'affects', 'code', 'constraints', 'decision', 'depends_on', 'excludes', 'file', 'id', 'rules', 'scope', 'status',
  ]);
  assert.equal(it.decision, 'pick one thing');
  assert.deepEqual(it.constraints, ['keep the boundary']);
  assert.deepEqual(it.scope, ['the module'], 'the excludes line is not left in scope');
  assert.deepEqual(it.excludes, ['everything else']);
  assert.deepEqual(it.rules, ['the obligation']);
  assert.equal(it.status, 'accepted');
  assert.equal(it.file, 'docs/adr/accepted/adr-one.md', 'forward slashes on every platform');
});

test('code anchors keep their #symbol, and a scalar becomes a one-element array', async () => {
  const dir = await mkProject();
  await writeAdr(dir, { id: 'adr-anchor', status: 'active', ...EV, code: 'src/a.js#doThing', affects: 'cnlp', body: body() });

  const { items } = await buildDecisions({ projectDir: dir });
  assert.deepEqual(items[0].code, ['src/a.js#doThing'], 'the symbol is the reader’s pointer, not a path to match');
  assert.deepEqual(items[0].affects, ['cnlp']);
});

test('only accepted and active ADRs are in the digest', async () => {
  const dir = await mkProject();
  await writeAdr(dir, { id: 'adr-prop', status: 'proposed', body: body() });
  await writeAdr(dir, { id: 'adr-draft', status: 'draft', body: body() });
  await writeAdr(dir, { id: 'adr-acc', status: 'accepted', body: body() });
  await writeAdr(dir, { id: 'adr-act', status: 'active', ...EV, body: body() });
  await writeAdr(dir, { id: 'adr-sup', status: 'superseded', replaced_by: 'adr-act', body: body() });

  const { items } = await buildDecisions({ projectDir: dir });
  assert.deepEqual(items.map((i) => i.id), ['adr-acc', 'adr-act'], 'a draft is not a rule; a superseded one is history');
});

test('items are ordered by id, then by file', async () => {
  const dir = await mkProject();
  await writeAdr(dir, { id: 'adr-c', status: 'accepted', body: body() });
  await writeAdr(dir, { id: 'adr-a', status: 'active', ...EV, body: body() });
  await writeRaw(dir, { statusDir: 'accepted', id: 'adr-a' }); // same id, second file

  const { items } = await buildDecisions({ projectDir: dir });
  assert.deepEqual(items.map((i) => i.id), ['adr-a', 'adr-a', 'adr-c']);
  assert.ok(items[0].file < items[1].file, 'a duplicated id still has a defined order');
});

test('a custom adr.root is honoured', async () => {
  const dir = await mkProject();
  await writeFile(path.join(dir, '.ai-factory', 'adr-extension.yaml'), 'adr:\n  root: decisions/adr\n', 'utf8');
  await writeRaw(dir, { root: 'decisions/adr', statusDir: 'active', id: 'adr-elsewhere', fm: { status: 'active', ...EV } });

  const { items } = await buildDecisions({ projectDir: dir });
  assert.deepEqual(items.map((i) => i.id), ['adr-elsewhere']);
});

test('an empty corpus yields no items and no issues', async () => {
  const dir = await mkProject();
  const res = await buildDecisions({ projectDir: dir });
  assert.deepEqual(res, { items: [], issues: [] });
  assert.deepEqual(renderDecisions(res.items), []);
});

test('the rendered digest is one header line per ADR plus its blocks', async () => {
  const dir = await mkProject();
  await writeAdr(dir, { id: 'adr-render', status: 'accepted', affects: ['x'], body: body() });

  const { items } = await buildDecisions({ projectDir: dir });
  const lines = renderDecisions(items);
  assert.match(lines[0], /^adr-render {2}\[accepted] {2}docs/);
  assert.equal(lines.filter((l) => l.startsWith('  decision: ')).length, 1);
  assert.ok(lines.includes('    excludes: everything else'));
  assert.ok(lines.includes('    1. the obligation'), 'rules are renumbered from the extracted text');
  assert.equal(lines.at(-1), '  affects: x', 'the tail line carries only the non-empty fields');
});

test('unreadable frontmatter is an issue, and the sweep continues', async () => {
  const dir = await mkProject();
  await writeRaw(dir, { statusDir: 'accepted', id: 'adr-broken', text: '---\nid: [unclosed\n---\n\ndecision: x\n' });
  await writeAdr(dir, { id: 'adr-fine', status: 'accepted', body: body() });

  const { items, issues } = await buildDecisions({ projectDir: dir });
  assert.deepEqual(items.map((i) => i.id), ['adr-fine'], 'one bad file does not hide the rest');
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'unreadable');
  assert.match(issues[0].file, /adr-broken\.md$/);
});

test('a malformed id is an issue', async () => {
  const dir = await mkProject();
  await writeRaw(dir, { statusDir: 'accepted', id: 'BADID', fm: { status: 'accepted' } });

  const { issues } = await buildDecisions({ projectDir: dir });
  assert.deepEqual(issues.map((i) => i.code), ['invalid-id']);
});

test('a duplicated id raises one issue per file, each naming the other', async () => {
  const dir = await mkProject();
  await writeAdr(dir, { id: 'adr-twin', status: 'accepted', body: body() });
  await writeRaw(dir, { statusDir: 'active', id: 'adr-twin', fm: { status: 'active', ...EV } });

  const { issues } = await buildDecisions({ projectDir: dir });
  const dupes = issues.filter((i) => i.code === 'duplicate-id');
  assert.equal(dupes.length, 2, 'the report counts ADRs, so every participating file is named');
  assert.match(dupes[0].message, /adr-twin/);
  assert.notEqual(dupes[0].file, dupes[1].file);
});

test('frontmatter status against its directory is an issue', async () => {
  const dir = await mkProject();
  await writeRaw(dir, { statusDir: 'accepted', id: 'adr-lying', fm: { status: 'draft' } });

  const { issues, items } = await buildDecisions({ projectDir: dir });
  assert.ok(issues.some((i) => i.code === 'status-mismatch'));
  assert.equal(items[0].status, 'accepted', 'the directory decides, as everywhere else');
});

test('an empty required block is an issue', async () => {
  const dir = await mkProject();
  await writeRaw(dir, {
    statusDir: 'accepted',
    id: 'adr-hollow',
    text: serialize({ id: 'adr-hollow', type: 'adr', status: 'accepted' }, '\ndecision: something\n\nconstraints:\n- a\n\nscope:\n- b\n'),
  });

  const { issues } = await buildDecisions({ projectDir: dir });
  assert.deepEqual(issues.map((i) => i.code), ['empty-block']);
  assert.match(issues[0].message, /"rules:"/);
});

test('a list block written with an inline value keeps both parts and is an issue', async () => {
  const dir = await mkProject();
  await writeRaw(dir, {
    statusDir: 'accepted',
    id: 'adr-mixed',
    text: serialize({ id: 'adr-mixed', type: 'adr', status: 'accepted' }, body({ constraints: [] }).replace('constraints:\n', 'constraints: first\n- second\n')),
  });

  const { items, issues } = await buildDecisions({ projectDir: dir });
  assert.deepEqual(issues.map((i) => i.code), ['invalid-block']);
  assert.match(issues[0].message, /not the bullet-list/);
  assert.deepEqual(items[0].constraints, ['first', 'second'], 'the malformed block is reported, never halved');
});

test('a scalar block written as a list is an issue', async () => {
  const dir = await mkProject();
  await writeRaw(dir, {
    statusDir: 'accepted',
    id: 'adr-listy',
    text: serialize({ id: 'adr-listy', type: 'adr', status: 'accepted' }, body().replace('decision: pick one thing', 'decision:\n- pick one thing')),
  });

  const { items, issues } = await buildDecisions({ projectDir: dir });
  assert.deepEqual(issues.map((i) => i.code), ['invalid-block']);
  assert.match(issues[0].message, /not the scalar/);
  assert.equal(items[0].decision, 'pick one thing', 'the content still reaches the digest');
});

test('a required block stated twice is an issue, not a silent truncation', async () => {
  const dir = await mkProject();
  await writeRaw(dir, {
    statusDir: 'accepted',
    id: 'adr-twice',
    text: serialize({ id: 'adr-twice', type: 'adr', status: 'accepted' }, body({ constraints: ['- first'] }) + '\nconstraints:\n- second\n'),
  });

  const { issues } = await buildDecisions({ projectDir: dir });
  assert.deepEqual(issues.map((i) => i.code), ['invalid-block']);
  assert.match(issues[0].message, /"constraints:"/);
});
