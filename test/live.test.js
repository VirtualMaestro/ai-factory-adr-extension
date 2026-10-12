import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, utimes } from 'node:fs/promises';
import YAML from 'yaml';
import path from 'node:path';
import { read } from '../src/artifacts/frontmatter.js';
import { finalize } from '../src/lifecycle/finalize.js';
import { supersede } from '../src/lifecycle/supersede.js';
import { transition } from '../src/lifecycle/move.js';
import { validateAdr } from '../src/lifecycle/validate.js';
import { buildStatus } from '../src/status.js';
import { deltaProblems, findFence, readDelta, markApplied } from '../src/live/delta.js';
import { normaliseRef, resolveRef } from '../src/live/refs.js';
import { applyDelta, parseLive, renderLive, SENTINEL } from '../src/live/state.js';
import { applySource, applyPending, initLive, liveContext, withLiveLock } from '../src/live/apply.js';
import { buildDecisions } from '../src/decisions.js';
import { checkLive } from '../src/live/check.js';
import { hasOpenTask } from '../src/live/plans.js';
import { mkProject, writeAdr, writePlan } from './helpers.js';

const git = (dir, ...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
const LIVE = (dir) => path.join(dir, '.ai-factory', 'LIVE.md');
const HEAD = '---\ntype: live\ntitle: Live state\nsince: 2026-10-01\n---\n\n';

async function gitProject() {
  const dir = await mkProject();
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'test');
  return dir;
}

const commitAll = (dir) => {
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'fixture');
};
const staged = (dir) => git(dir, 'diff', '--cached', '--name-only').stdout.split('\n').filter(Boolean);

/** `LIVE.md` holding the given records, written as the CLI renders them. */
async function writeLive(dir, entries = []) {
  await writeFile(LIVE(dir), renderLive({ prefix: HEAD, entries }), 'utf8');
  return LIVE(dir);
}

const added = (capability, summary = 'The product does one observable thing.', extra = {}) => ({ changes: [{ capability, change: 'added', summary, ...extra }] });

async function fencedPlan(dir, name, delta, { tasks = '- [x] Done', frontmatter = '', suffix = '' } = {}) {
  const file = path.join(dir, name);
  await mkdir(path.dirname(file), { recursive: true });
  const fence = delta == null ? '' : `\n\n\`\`\`adr-live\n${YAML.stringify(delta)}\`\`\``;
  await writeFile(file, `${frontmatter}# Plan${fence}\n\n${tasks}\n${suffix}`, 'utf8');
  return file;
}

test('markApplied updates a pre-existing block contradiction list without losing adjacent YAML or CRLF', async () => {
  const dir = await mkProject();
  const file = path.join(dir, 'plan.md');
  const content = '# Plan\r\n\r\n```adr-live\r\ncontradicts:\r\n- adr-old\r\nchanges:\r\n- capability: cap-a\r\n  change: removed\r\n```\r\n\r\n- [x] Done\r\n';
  await writeFile(file, content);
  const doc = await readDelta(file);
  const after = markApplied(doc, { date: '2026-10-11', contradicts: ['adr-old', 'adr-new'] });
  await writeFile(file, after);
  const updated = await readDelta(file);
  assert.deepEqual(updated.problems, []);
  assert.deepEqual(updated.delta.contradicts, ['adr-old', 'adr-new']);
  assert.deepEqual(updated.delta.changes, doc.delta.changes);
  assert.equal(after.replaceAll('\r\n', '').includes('\n'), false);
  assert.ok(after.endsWith('```\r\n\r\n- [x] Done\r\n'));
});

test('pending falls back to mtime for untracked plans and includes active ADR sources', async () => {
  const dir = await gitProject();
  await writeLive(dir);
  const first = await writeAdr(dir, { id: 'adr-first', status: 'active', live: added('cap-a') });
  const second = await fencedPlan(dir, '.ai-factory/plans/second.md', { changes: [{ capability: 'cap-a', change: 'modified', summary: 'The product does another observable thing.' }] });
  await utimes(first, new Date('2026-01-01'), new Date('2026-01-01'));
  await utimes(second, new Date('2026-02-01'), new Date('2026-02-01'));
  const res = await applyPending({ projectDir: dir });
  assert.deepEqual(res.failures, []);
  assert.deepEqual(res.results.map((r) => r.id), ['adr-first', '.ai-factory/plans/second.md']);
  assert.deepEqual(parseLive(await readFile(LIVE(dir), 'utf8')).entries[0].refs, ['adr-first', 'second']);
});

test('malformed and lexicon-invalid plan deltas fail without writes or staging', async () => {
  const dir = await gitProject();
  await writeLive(dir);
  for (const delta of [{ changes: [] }, added('cap-a', 'The product is faster.'), added('cap-a', 'x'.repeat(251)), added('cap-a', 'Users greet names. They retain order. They pick a separator.')]) {
    const file = await fencedPlan(dir, '.ai-factory/plans/bad.md', delta);
    commitAll(dir);
    const before = await readFile(file, 'utf8');
    const live = await readFile(LIVE(dir), 'utf8');
    await assert.rejects(applySource(file, { projectDir: dir }), /nothing was changed/);
    assert.equal(await readFile(file, 'utf8'), before);
    assert.equal(await readFile(LIVE(dir), 'utf8'), live);
    assert.deepEqual(staged(dir), []);
  }
});

test('apply plan carriers, durable refs, dry-run, byte preservation and staging', async () => {
  for (const [name, ref] of [
    ['.ai-factory/plans/full.md', 'full'],
    ['.ai-factory/plans/ultra/index.md', 'ultra'],
    ['.ai-factory/archive/plans/old.md', 'old'],
    ['.ai-factory/archive/plans/bundle/index.md', 'bundle'],
    ['notes/custom.md', 'notes/custom.md'],
    ['.ai-factory/PLAN.md', 'src/main.js'],
  ]) {
    const dir = await gitProject();
    await writeLive(dir);
    const file = await fencedPlan(dir, name, added('cap-a', undefined, name.endsWith('PLAN.md') ? { refs: 'src/main.js' } : {}));
    const before = await readFile(file, 'utf8');
    commitAll(dir);
    const source = name.includes('bundle/') || name.includes('ultra/') ? path.dirname(file) : file;
    assert.ok((await applySource(source, { projectDir: dir, dryRun: true })).changed);
    assert.equal(await readFile(file, 'utf8'), before);
    assert.deepEqual(staged(dir), []);
    await applySource(source, { projectDir: dir });
    assert.equal((await readDelta(file)).delta.applied, new Date().toISOString().slice(0, 10));
    assert.equal((await readFile(file, 'utf8')).replace(/^applied: .*\n/m, ''), before);
    assert.deepEqual(parseLive(await readFile(LIVE(dir), 'utf8')).entries[0].refs, [ref]);
    assert.deepEqual(staged(dir).sort(), ['.ai-factory/LIVE.md', name].sort());
    await assert.rejects(applySource(source, { projectDir: dir }), /already applied/);
  }
});

test('linked plans skip before validation; fast changes all require refs; none leaves LIVE untouched', async () => {
  const dir = await gitProject();
  await writeLive(dir, [{ id: 'cap-a', summary: 'The product does one observable thing.', refs: ['src/main.js'] }]);
  const linked = await fencedPlan(dir, '.ai-factory/plans/linked.md', null, { frontmatter: '---\nimplements: [adr-one]\n---\n' });
  assert.equal((await applySource(linked, { projectDir: dir })).skipped, 'linked to adr-one');
  for (const change of ['added', 'modified', 'removed']) {
    const file = await fencedPlan(dir, '.ai-factory/PLAN.md', { changes: [{ capability: 'cap-a', change, summary: 'The product does one observable thing.' }] });
    await assert.rejects(applySource(file, { projectDir: dir }), /durable refs/);
  }
  const noop = await fencedPlan(dir, '.ai-factory/plans/noop.md', { none: 'Refactor only.' });
  commitAll(dir);
  const before = await readFile(LIVE(dir), 'utf8');
  assert.equal((await applySource(noop, { projectDir: dir })).skipped, 'nothing changed');
  assert.equal(await readFile(LIVE(dir), 'utf8'), before);
  assert.deepEqual(staged(dir), []);
});

test('plan removal records active ADR debt, both reports clear after supersede', async () => {
  const dir = await gitProject();
  const old = await writeAdr(dir, { id: 'adr-old', status: 'active', live: { none: 'Seeded.' } });
  const next = await writeAdr(dir, { id: 'adr-next', status: 'active', live: { none: 'Replacement.' } });
  await writeLive(dir, [{ id: 'cap-a', summary: 'The product does one observable thing.', refs: ['adr-old'] }]);
  const plan = await fencedPlan(dir, '.ai-factory/plans/remove.md', { changes: [{ capability: 'cap-a', change: 'removed' }], contradicts: ['adr-historic'] });
  commitAll(dir);
  const dry = await applySource(plan, { projectDir: dir, dryRun: true });
  assert.match(dry.warnings.join(' '), /adr-old/);
  assert.equal((await readDelta(plan)).delta.applied, undefined);
  await applySource(plan, { projectDir: dir });
  const doc = await readDelta(plan);
  assert.deepEqual(doc.problems, []);
  assert.deepEqual(doc.delta.contradicts, ['adr-historic', 'adr-old']);
  assert.deepEqual(parseLive(await readFile(LIVE(dir), 'utf8')).entries, []);
  assert.ok((await checkLive({ projectDir: dir })).issues.some((i) => i.code === 'contradicts-active-adr'));
  assert.ok((await buildDecisions({ projectDir: dir })).issues.some((i) => i.code === 'contradicted-by-plan'));
  await supersede(old, next, { projectDir: dir });
  assert.ok(!(await checkLive({ projectDir: dir })).issues.some((i) => i.code === 'contradicts-active-adr'));
  assert.ok(!(await buildDecisions({ projectDir: dir })).issues.some((i) => i.code === 'contradicted-by-plan'));
});

test('plan checks scope missing, unapplied, linked and contradiction issues to entrypoints', async () => {
  const dir = await gitProject();
  await writeLive(dir);
  await writeAdr(dir, { id: 'adr-one', status: 'active', live: { none: 'Seeded.' } });
  await fencedPlan(dir, '.ai-factory/plans/completed.md', null);
  await fencedPlan(dir, '.ai-factory/plans/open.md', null, { tasks: '- [ ] Open' });
  await fencedPlan(dir, '.ai-factory/archive/plans/before.md', null, { frontmatter: '---\narchived: 2026-09-30\n---\n' });
  await fencedPlan(dir, '.ai-factory/archive/plans/after/index.md', null, { suffix: '<!-- aif:archived:2026-10-01 -->\n' });
  await fencedPlan(dir, '.ai-factory/plans/pending/index.md', added('new-cap'));
  await fencedPlan(dir, '.ai-factory/plans/pending/task.md', null);
  await fencedPlan(dir, '.ai-factory/plans/linked.md', { none: 'ADR owns it.' }, { tasks: '- [ ] Open', frontmatter: '---\nimplements: [adr-one]\n---\n' });
  await fencedPlan(dir, '.ai-factory/archive/plans/debt.md', { changes: [{ capability: 'old-cap', change: 'removed' }], applied: '2026-09-01', contradicts: ['adr-one'] });
  const issues = (await checkLive({ projectDir: dir })).issues;
  assert.deepEqual(issues.filter((i) => i.code === 'missing-delta').map((i) => i.target), ['.ai-factory/archive/plans/after/index.md', '.ai-factory/plans/completed.md']);
  assert.deepEqual(issues.filter((i) => i.code === 'unapplied-delta').map((i) => i.target), ['.ai-factory/plans/pending/index.md']);
  assert.equal(issues.filter((i) => i.code === 'delta-on-linked-plan').length, 1);
  assert.equal(issues.filter((i) => i.code === 'contradicts-active-adr').length, 1);
});

test('pending uses commit dates then change order, continues past failures and rejects both duplicate adds', async () => {
  const dir = await gitProject();
  await writeLive(dir, [{ id: 'cap-a', summary: 'The product does one observable thing.', refs: ['source.md'] }]);
  const add = await fencedPlan(dir, '.ai-factory/plans/a-add.md', added('cap-a'));
  const remove = await fencedPlan(dir, '.ai-factory/plans/z-remove.md', { changes: [{ capability: 'cap-a', change: 'removed' }] });
  const modify = await fencedPlan(dir, '.ai-factory/plans/b-modify.md', { changes: [{ capability: 'cap-a', change: 'modified', summary: 'The product does another observable thing.' }] });
  commitAll(dir);
  await utimes(remove, new Date('2030-01-01'), new Date('2030-01-01'));
  const bad = await fencedPlan(dir, '.ai-factory/plans/c-bad.md', { changes: [{ capability: 'absent', change: 'removed' }] });
  const good = await fencedPlan(dir, '.ai-factory/plans/d-good.md', added('cap-b'));
  for (const file of [bad, good]) await utimes(file, new Date('2031-01-01'), new Date('2031-01-01'));
  const dup1 = await fencedPlan(dir, '.ai-factory/plans/dup1.md', added('collision'));
  const dup2 = await fencedPlan(dir, '.ai-factory/plans/dup2.md', added('collision'));
  const res = await applyPending({ projectDir: dir });
  assert.deepEqual(res.results.map((r) => r.source), [remove, add, modify, good].map((f) => path.relative(dir, f).split(path.sep).join('/')));
  assert.equal(res.failures.length, 3);
  for (const file of [bad, dup1, dup2]) assert.equal((await readDelta(file)).delta.applied, undefined);
  for (const file of [remove, add, modify, good]) assert.ok((await readDelta(file)).delta.applied);
  assert.equal((await applyPending({ projectDir: dir })).results.length, 0);
});

// --- the delta ---

test('deltaProblems accepts both shapes and names what is wrong with a malformed one', () => {
  assert.deepEqual(deltaProblems(added('a-b')), []);
  assert.deepEqual(deltaProblems({ none: 'a constraint on how code is written' }), []);
  assert.deepEqual(deltaProblems({ changes: [{ capability: 'x', change: 'removed' }] }), [], 'a removal needs no summary');

  const bad = [
    [{ changes: added('x').changes, none: 'both' }, /exclude each other/],
    [{}, /neither/],
    ['text', /not a mapping/],
    [{ none: '' }, /reason/],
    [{ changes: [] }, /non-empty/],
    [{ changes: [{ capability: 'Bad_Id', change: 'added', summary: 's' }] }, /kebab-case/],
    [{ changes: [{ capability: 'x', change: 'renamed', summary: 's' }] }, /not one of/],
    [{ changes: [{ capability: 'x', change: 'added' }] }, /summary is required/],
    [{ changes: [{ capability: 'x', change: 'added', summary: 's' }, { capability: 'x', change: 'removed' }] }, /more than 1 time/],
    [{ changes: added('x').changes, extra: 1 }, /unknown key "extra"/],
    [{ none: 'r', applied: '2026-10-01' }, /carries no `applied:`/],
  ];
  for (const [delta, re] of bad) assert.ok(deltaProblems(delta).some((p) => re.test(p)), `${JSON.stringify(delta)} → ${re}`);
});

test('an empty live: key reads as absent, not malformed', async () => {
  const dir = await mkProject();
  const f = await writeAdr(dir, { id: 'adr-empty-live', status: 'draft', live: null });
  const doc = await readDelta(f);
  assert.equal(doc.delta, null);
  assert.deepEqual(doc.problems, []);
});

test('findFence takes the first adr-live fence, ignores one nested in an example, and fails on a second', () => {
  const plan = '# Plan\n\n```adr-live\nnone: "refactor"\n```\n\n````markdown\n```adr-live\nnone: x\n```\n````\n';
  const fence = findFence(plan);
  assert.equal(fence.start, 2);
  assert.equal(fence.yaml, 'none: "refactor"');
  assert.throws(() => findFence('```adr-live\nnone: a\n```\n```adr-live\nnone: b\n```\n'), /more than 1/);
  assert.throws(() => findFence('```adr-live\nnone: a\n'), /never closes/);
  assert.equal(findFence('# Plan\n'), null);
});

// --- the pure apply ---

test('applyDelta adds, modifies and removes, and the sentinel swaps in both directions', () => {
  const ctx = { kind: 'adr', ref: 'adr-one' };
  const start = parseLive(`${HEAD}capabilities:\n${SENTINEL}\n`);
  assert.equal(start.entries.length, 0);

  const one = applyDelta(start.entries, added('cap-a').changes, ctx);
  assert.deepEqual(one.refusals, []);
  assert.deepEqual(one.entries, [{ id: 'cap-a', summary: 'The product does one observable thing.', refs: ['adr-one'] }]);
  const rendered = renderLive({ ...start, entries: one.entries });
  assert.ok(!rendered.includes('- none:'), 'the first added replaces the sentinel');

  const two = applyDelta(one.entries, [{ capability: 'cap-a', change: 'modified', summary: 'It does another thing.' }], { kind: 'adr', ref: 'adr-two' });
  assert.deepEqual(two.entries[0], { id: 'cap-a', summary: 'It does another thing.', refs: ['adr-one', 'adr-two'] });

  const gone = applyDelta(two.entries, [{ capability: 'cap-a', change: 'removed' }], ctx);
  assert.deepEqual(gone.entries, []);
  assert.match(renderLive({ ...start, entries: gone.entries }), new RegExp(`^${SENTINEL}$`, 'm'), 'the last removed restores the sentinel');
});

test('applyDelta refuses added on an existing id and modified or removed on a missing one', () => {
  const entries = [{ id: 'cap-a', summary: 'S.', refs: ['adr-x'] }];
  const ctx = { kind: 'adr', ref: 'adr-y' };
  assert.match(applyDelta(entries, added('cap-a').changes, ctx).refusals[0], /already exists.*modified/);
  assert.match(applyDelta(entries, [{ capability: 'cap-b', change: 'modified', summary: 'S.' }], ctx).refusals[0], /does not exist/);
  assert.match(applyDelta(entries, [{ capability: 'cap-b', change: 'removed' }], ctx).refusals[0], /does not exist/);
});

test('render keeps every line before capabilities: byte for byte and sorts the records', () => {
  const prefix = `${HEAD}<!-- maintained by ai-factory adr live -->\r\nnotes: kept\n\n`;
  const raw = `${prefix}capabilities:\n- id: zeta\n  summary: Z.\n  refs: adr-z\n- id: alpha\n  summary: A.\n  refs: adr-a\n`;
  const state = parseLive(raw);
  const out = renderLive(state);
  assert.ok(out.startsWith(prefix), 'prefix survives');
  assert.ok(out.indexOf('- id: alpha') < out.indexOf('- id: zeta'), 'sorted by id');
});

test('parseLive refuses a line after capabilities: that the render would drop', () => {
  assert.throws(() => parseLive(`${HEAD}capabilities:\n- id: a\n  summary: A.\n  refs: x\n\nSome prose.\n`), /not a capability record/);
  assert.throws(() => parseLive(`${HEAD}capabilities:\n- id: a\n  summary: A.\n  refs: x\n  area: y\n`), /not a record key/);
  assert.throws(() => parseLive(`${HEAD}nothing here\n`), /no `capabilities:`/);
});

// --- refs ---

test('resolveRef finds each kind by lookup, normalises the ref, and reports a collision as 2 hits', async () => {
  const dir = await mkProject();
  await writeAdr(dir, { id: 'adr-thing', status: 'active', evidence: 'implemented' });
  await writePlan(dir, { id: 'p1', name: '0014_full-plan' });
  await writePlan(dir, { id: 'p2', name: 'old-plan', subdir: 'archive/plans' });
  await mkdir(path.join(dir, '.ai-factory/plans/ultra-bundle'), { recursive: true });
  await writeFile(path.join(dir, '.ai-factory/plans/ultra-bundle/index.md'), '# Ultra\n');
  await writePlan(dir, { id: 'p3', name: 'adr-thing' }); // a branch named adr-thing gives this stem
  await mkdir(path.join(dir, 'src/lib'), { recursive: true });
  await writeFile(path.join(dir, 'src/lib/a.js'), '');
  const ctx = await liveContext(dir);
  const kinds = (ref) => resolveRef(ref, ctx).map((h) => h.kind);

  assert.deepEqual(kinds('0014_full-plan'), ['plan']);
  assert.deepEqual(kinds('old-plan'), ['plan']);
  assert.deepEqual(kinds('ultra-bundle'), ['plan']);
  assert.deepEqual(kinds('src/lib/a.js'), ['path']);
  assert.deepEqual(kinds('.\\src\\lib\\a.js'), ['path']);
  assert.deepEqual(kinds('src/lib/'), ['path']);
  assert.deepEqual(kinds('adr-thing'), ['adr', 'plan'], 'ambiguous');
  assert.deepEqual(kinds('Src/lib/a.js'), [], 'case must match the name on disk');
  assert.deepEqual(kinds('../outside.js'), [], 'outside the project is broken, not a crash');
  assert.equal(normaliseRef('./a\\b/'), 'a/b');
});

// --- finalize ---

test('finalize applies the delta: entry written, ADR activated with live.applied, all staged', async () => {
  const dir = await gitProject();
  await writeLive(dir);
  const adr = await writeAdr(dir, { id: 'adr-feature', status: 'accepted', plan: 'plan-feature', live: added('feature-x') });
  await writePlan(dir, { id: 'plan-feature', implements: ['adr-feature'] });
  commitAll(dir);

  const res = await finalize(adr, { projectDir: dir });

  const { entries } = parseLive(await readFile(LIVE(dir), 'utf8'));
  assert.deepEqual(entries, [{ id: 'feature-x', summary: 'The product does one observable thing.', refs: ['adr-feature'] }]);
  assert.match((await read(res.active)).data.live.applied, /^\d{4}-\d{2}-\d{2}$/);
  const s = staged(dir);
  for (const f of ['.ai-factory/LIVE.md', 'docs/adr/active/adr-feature.md', '.ai-factory/archive/plans/plan-feature.md']) {
    assert.ok(s.includes(f), `${f} staged: ${s.join(', ')}`);
  }
});

test('finalize writes live.applied for a documentation-only ADR and for authored evidence', async () => {
  const dir = await mkProject();
  await writeLive(dir);
  const doc = await writeAdr(dir, { id: 'adr-doc-live', status: 'accepted', evidence: 'documentation-only', live: added('doc-cap') });
  const authored = await writeAdr(dir, { id: 'adr-authored', status: 'accepted', evidence: 'commit abc', plan: 'p-auth', live: added('auth-cap') });
  await writePlan(dir, { id: 'p-auth', implements: ['adr-authored'] });

  for (const f of [doc, authored]) {
    const res = await finalize(f, { projectDir: dir });
    assert.ok((await read(res.active)).data.live.applied, `${res.id} carries applied`);
  }
  assert.deepEqual(parseLive(await readFile(LIVE(dir), 'utf8')).entries.map((e) => e.id), ['auth-cap', 'doc-cap']);
});

test('an archive collision after the LIVE.md write restores LIVE.md and the ADR', async () => {
  const dir = await mkProject();
  await writeLive(dir);
  const adr = await writeAdr(dir, { id: 'adr-collide', status: 'accepted', plan: 'plan-collide', live: added('collide-cap') });
  await writePlan(dir, { id: 'plan-collide', implements: ['adr-collide'] });
  await writePlan(dir, { id: 'other', status: 'done', name: 'plan-collide', subdir: 'archive/plans' });
  const before = [await readFile(adr, 'utf8'), await readFile(LIVE(dir), 'utf8')];

  await assert.rejects(() => finalize(adr, { projectDir: dir }), /Archived plan already exists/);

  assert.equal(await readFile(adr, 'utf8'), before[0]);
  assert.equal(await readFile(LIVE(dir), 'utf8'), before[1]);
});

test('finalize without LIVE.md changes nothing and creates no file', async () => {
  const dir = await mkProject();
  const adr = await writeAdr(dir, { id: 'adr-optout', status: 'accepted', evidence: 'documentation-only' });
  const res = await finalize(adr, { projectDir: dir });
  assert.equal(res.live, null);
  assert.ok(!existsSync(LIVE(dir)));
});

test('a delta that fails the lexicon or the line limit is refused, and nothing is written', async () => {
  const dir = await mkProject();
  await writeLive(dir);
  const lexicon = await writeAdr(dir, { id: 'adr-lex', status: 'accepted', evidence: 'documentation-only', live: added('lex-cap', 'It ensures faster pages.') });
  const long = await writeAdr(dir, { id: 'adr-long', status: 'accepted', evidence: 'documentation-only', live: added('long-cap', `${'word '.repeat(47)}word.`) });
  const sentences = await writeAdr(dir, { id: 'adr-sentences', status: 'accepted', evidence: 'documentation-only', live: added('sentence-cap', 'Users read greetings. They retain order. They pick a separator.') });
  const before = await readFile(LIVE(dir), 'utf8');

  await assert.rejects(() => finalize(lexicon, { projectDir: dir }), /deny-list word "ensures"[\s\S]*nothing was changed/);
  // `  summary: ` plus 240 characters is 251 on the rendered line.
  assert.equal(`  summary: ${'word '.repeat(47)}word.`.length, 251);
  await assert.rejects(() => finalize(long, { projectDir: dir }), /251 chars exceeds/);
  await assert.rejects(() => finalize(sentences, { projectDir: dir }), /more than 2 sentences[\s\S]*nothing was changed/);
  assert.equal(await readFile(LIVE(dir), 'utf8'), before);
  assert.ok([lexicon, long, sentences].every(existsSync), 'no ADR moved');
});

// --- the gate ---

test('with LIVE.md present, a missing live: warns at draft, errors at accepted, and is silent at active', async () => {
  const dir = await mkProject();
  await writeLive(dir);
  const draft = await writeAdr(dir, { id: 'adr-g-draft', status: 'draft' });
  const accepted = await writeAdr(dir, { id: 'adr-g-acc', status: 'accepted' });
  const active = await writeAdr(dir, { id: 'adr-g-act', status: 'active', evidence: 'implemented', code: ['x'] });

  assert.ok((await validateAdr(draft, { projectDir: dir })).warnings.some((w) => /^live:/.test(w)));
  assert.ok((await validateAdr(accepted, { projectDir: dir })).errors.some((e) => /^live:/.test(e)));
  const act = await validateAdr(active, { projectDir: dir });
  assert.ok(![...act.errors, ...act.warnings].some((m) => /live/.test(m)));
  assert.ok(!(await buildStatus(dir)).issues.some((i) => i.includes('adr-g-act')), 'an active ADR keeps --check green');
});

test('with LIVE.md present, transition to accepted and finalize refuse an ADR without live:', async () => {
  const dir = await mkProject();
  await writeLive(dir);
  const draft = await writeAdr(dir, { id: 'adr-nolive', status: 'draft' });
  await assert.rejects(() => transition(draft, 'accepted', { projectDir: dir }), /write live: with changes: or none:, see adr-improve/);
  assert.ok(existsSync(draft));

  const accepted = await writeAdr(dir, { id: 'adr-nolive-acc', status: 'accepted', evidence: 'documentation-only' });
  const before = await readFile(LIVE(dir), 'utf8');
  await assert.rejects(() => finalize(accepted, { projectDir: dir }), /no `live:` delta/);
  assert.ok(existsSync(accepted));
  assert.equal(await readFile(LIVE(dir), 'utf8'), before);

  const ok = await writeAdr(dir, { id: 'adr-haslive', status: 'draft', live: { none: 'a constraint, covered by adr decisions' } });
  assert.match((await transition(ok, 'accepted', { projectDir: dir })).target, /accepted/);
});

test('without LIVE.md, adr live apply skips and the gate is off', async () => {
  const dir = await mkProject();
  const active = await writeAdr(dir, { id: 'adr-skip', status: 'active', evidence: 'implemented', live: added('skip-cap') });
  assert.equal((await applySource(active, { projectDir: dir })).skipped, 'no LIVE.md');
  const draft = await writeAdr(dir, { id: 'adr-free', status: 'draft' });
  await transition(draft, 'accepted', { projectDir: dir });
});

// --- supersede ---

for (const successor of ['changes', 'none']) {
  test(`superseded refs are rewritten in both orders, for a ${successor}: successor`, async () => {
    for (const order of ['supersede-first', 'finalize-first']) {
      const dir = await mkProject();
      await writeLive(dir, [
        { id: 'cap-old', summary: 'The old behaviour.', refs: ['adr-old'] },
        { id: 'cap-both', summary: 'Both name it.', refs: ['adr-old', 'adr-new'] },
      ]);
      const old = await writeAdr(dir, { id: 'adr-old', status: 'active', evidence: 'implemented', live: { none: 'seeded', } });
      const live = successor === 'changes'
        ? { changes: [{ capability: 'cap-old', change: 'modified', summary: 'The new behaviour.' }] }
        : { none: 'a constraint only' };
      let neu = await writeAdr(dir, { id: 'adr-new', status: 'accepted', evidence: 'documentation-only', live });

      if (order === 'supersede-first') {
        await supersede(old, neu, { projectDir: dir });
        await finalize(neu, { projectDir: dir });
      } else {
        neu = (await finalize(neu, { projectDir: dir })).active;
        const res = await supersede(old, neu, { projectDir: dir });
        assert.deepEqual(res.live.rewritten.sort(), ['cap-both', 'cap-old']);
      }

      const { entries } = parseLive(await readFile(LIVE(dir), 'utf8'));
      for (const e of entries) assert.deepEqual(e.refs, ['adr-new'], `${order}: ${e.id} refs ${e.refs}`);
      if (successor === 'changes') assert.equal(entries.find((e) => e.id === 'cap-old').summary, 'The new behaviour.');
    }
  });
}

test('the superseded-ref rewrite warns about entries the delta does not name', async () => {
  const entries = [{ id: 'kept', summary: 'K.', refs: ['adr-old'] }];
  const res = applyDelta(entries, [], { kind: 'adr', ref: 'adr-new', supersedes: ['adr-old'] });
  assert.deepEqual(res.entries[0].refs, ['adr-new']);
  assert.match(res.warnings[0], /kept ref superseded adr-old.*change: removed/);
});

// --- no-op, init, idempotency ---

test('an apply that changes nothing leaves LIVE.md byte-identical and unstaged', async () => {
  const dir = await gitProject();
  // Hand-edited and unsorted: a render would reorder it.
  await writeFile(LIVE(dir), `${HEAD}capabilities:\n- id: zeta\n  summary: Z.\n  refs: adr-z\n- id: alpha\n  summary: A.\n  refs: adr-a\n`);
  const adr = await writeAdr(dir, { id: 'adr-noop', status: 'accepted', evidence: 'documentation-only', live: { none: 'a constraint only' } });
  commitAll(dir);
  const before = await readFile(LIVE(dir), 'utf8');

  const res = await finalize(adr, { projectDir: dir });

  assert.equal(res.live.changed, false);
  assert.equal(await readFile(LIVE(dir), 'utf8'), before);
  assert.ok(!staged(dir).includes('.ai-factory/LIVE.md'));
});

test('adr live init creates the sentinel file, lists accepted ADRs without live:, and refuses a second run', async () => {
  const dir = await mkProject();
  await writeAdr(dir, { id: 'adr-in-flight', status: 'accepted' });
  await writeAdr(dir, { id: 'adr-ready', status: 'accepted', live: { none: 'r' } });

  const res = await initLive({ projectDir: dir });

  assert.deepEqual(res.acceptedWithoutDelta.map((a) => a.id), ['adr-in-flight']);
  const content = await readFile(LIVE(dir), 'utf8');
  assert.match(content, new RegExp(`^since: ${res.since}$`, 'm'));
  assert.deepEqual((await checkLive({ projectDir: dir })).issues.filter((i) => i.code === 'live-format'), []);
  await assert.rejects(() => initLive({ projectDir: dir }), /already exists/);
});

test('a standalone apply on an active ADR runs once and is refused the second time', async () => {
  const dir = await mkProject();
  await writeLive(dir);
  const adr = await writeAdr(dir, { id: 'adr-imported', status: 'active', evidence: 'implemented', live: added('imported-cap') });

  const dry = await applySource(adr, { projectDir: dir, dryRun: true });
  assert.deepEqual(dry.ops, [{ op: 'added', id: 'imported-cap' }]);
  assert.equal(parseLive(await readFile(LIVE(dir), 'utf8')).entries.length, 0, 'dry run writes nothing');

  const res = await applySource(adr, { projectDir: dir });
  assert.match(res.applied, /^\d{4}-\d{2}-\d{2}$/);
  await assert.rejects(() => applySource(adr, { projectDir: dir }), /already applied on/);

  const accepted = await writeAdr(dir, { id: 'adr-not-yet', status: 'accepted', live: added('later-cap') });
  await assert.rejects(() => applySource(accepted, { projectDir: dir }), /is not active/);
  assert.deepEqual((await applySource(accepted, { projectDir: dir, dryRun: true })).ops, [{ op: 'added', id: 'later-cap' }]);
});

// --- check ---

test('adr live check reports every code on a fixture', async () => {
  const dir = await mkProject();
  await writeAdr(dir, { id: 'adr-live-ok', status: 'active', evidence: 'implemented', live: { none: 'seeded' } });
  await writeAdr(dir, { id: 'adr-no-live', status: 'active', evidence: 'implemented' });
  await writeAdr(dir, { id: 'adr-unapplied', status: 'active', evidence: 'implemented', live: added('u') });
  await writeAdr(dir, { id: 'adr-draft-ref', status: 'draft' });
  await writeAdr(dir, { id: 'adr-gone', status: 'superseded', replaced_by: 'adr-live-ok' });
  await writeAdr(dir, { id: 'adr-twice', status: 'active', evidence: 'implemented', live: { none: 'seeded' } });
  await writePlan(dir, { id: 'p', name: 'adr-twice' });
  await writeFile(path.join(dir, '.ai-factory/plans/open-plan.md'), '# Plan\n\n- [ ] the last task\n');
  await writeFile(LIVE(dir), [
    `${HEAD}capabilities:`,
    '- id: a-broken', '  summary: A.', '  refs: no-such-thing',
    '- id: b-ambiguous', '  summary: B.', '  refs: adr-twice',
    '- id: c-stale', '  summary: C.', '  refs: adr-gone',
    '- id: d-unfinished', '  summary: D.', '  refs: adr-draft-ref, open-plan',
    '- id: e-norefs', '  summary: E.', '  refs:',
    '- id: f-creep', '  summary: F.', '  refs: adr-live-ok, adr-twice, adr-gone, adr-no-live',
    '- id: g-long', '  summary: One. Two. Three.', '  refs: adr-live-ok',
    '- id: h-format', '  summary: It ensures things.', '  refs: adr-live-ok',
    '- id: i-quoted', '  summary: "It does things."', '  refs: adr-live-ok',
    '',
  ].join('\n'));

  const { issues } = await checkLive({ projectDir: dir });
  const has = (code, target) => issues.some((i) => i.code === code && (!target || i.target === target));

  assert.ok(has('live-format'), 'live-format');
  assert.ok(issues.some((i) => i.code === 'live-format' && /quoted/.test(i.message)), 'a quoted summary is live-format');
  assert.ok(has('broken-ref', 'a-broken'));
  assert.ok(has('ambiguous-ref', 'b-ambiguous'));
  assert.ok(has('stale-superseded-ref', 'c-stale'));
  assert.equal(issues.filter((i) => i.code === 'ref-to-unfinished' && i.target === 'd-unfinished').length, 2, 'the draft ADR and the open plan');
  assert.ok(has('no-refs', 'e-norefs'));
  assert.ok(has('ref-creep', 'f-creep'));
  assert.ok(has('summary-too-long', 'g-long'));
  assert.ok(has('missing-delta', 'adr-no-live'));
  assert.ok(has('unapplied-delta', 'adr-unapplied'));
  assert.ok(!has('missing-delta', 'adr-live-ok') && !has('unapplied-delta', 'adr-live-ok'));
});

test('adr live check without LIVE.md reports nothing', async () => {
  const dir = await mkProject();
  await writeAdr(dir, { id: 'adr-x', status: 'active', evidence: 'implemented' });
  const res = await checkLive({ projectDir: dir });
  assert.equal(res.exists, false);
  assert.deepEqual(res.issues, []);
});

// --- audit regressions ---

test('a plan with broken frontmatter is a missing-delta issue, not a crash of check, pending or decisions', async () => {
  const dir = await mkProject();
  await writeLive(dir);
  const broken = path.join(dir, '.ai-factory/plans/broken.md');
  await mkdir(path.dirname(broken), { recursive: true });
  await writeFile(broken, '---\nid: [unclosed\n---\n# Plan\n', 'utf8');
  const issue = (await checkLive({ projectDir: dir })).issues.find((i) => i.target.endsWith('broken.md'));
  assert.equal(issue?.code, 'missing-delta');
  assert.match(issue.message, /could not be parsed/);
  assert.deepEqual((await applyPending({ projectDir: dir })).failures, []);
  await buildDecisions({ projectDir: dir });
});

test('empty CLI-written keys, comma refs in a list and contradicts: on an ADR are malformed', () => {
  const change = { capability: 'cap-a', change: 'removed' };
  assert.match(deltaProblems({ applied: null, changes: [change] }).join(), /`applied:` is empty/);
  assert.match(deltaProblems({ contradicts: null, changes: [change] }).join(), /`contradicts:` is empty/);
  assert.match(deltaProblems({ changes: [{ ...change, refs: ['src/a.js, src/b.js'] }] }).join(), /without ","/);
  assert.deepEqual(deltaProblems({ changes: [{ ...change, refs: ['src/a.js', 'src/b.js'] }] }), []);
  assert.deepEqual(deltaProblems({ contradicts: ['adr-x'], changes: [change] }), []);
  assert.match(deltaProblems({ contradicts: ['adr-x'], changes: [change] }, { adr: true }).join(), /belongs to a plan fence/);
});

test('a LIVE.md that already fails its profile is named as the cause, not the delta', async () => {
  const dir = await mkProject();
  await writeLive(dir, [{ id: 'cap-old', summary: 'It ensures things.', refs: ['src/a.js'] }]);
  const plan = await fencedPlan(dir, '.ai-factory/plans/new.md', added('cap-new'));
  await assert.rejects(() => applySource(plan, { projectDir: dir }), /LIVE\.md fails its profile before the delta[\s\S]*ensures[\s\S]*fix LIVE\.md by hand/);
});

test('an indexed active ADR without type: adr applies as an ADR, alone and in a pending batch', async () => {
  for (const pending of [false, true]) {
    const dir = await mkProject();
    await writeLive(dir);
    const file = await writeAdr(dir, { id: 'adr-legacy', status: 'active', type: 'decision', live: added('cap-legacy') });
    assert.ok((await checkLive({ projectDir: dir })).issues.some((i) => i.code === 'unapplied-delta' && i.target === 'adr-legacy'));
    if (pending) assert.deepEqual((await applyPending({ projectDir: dir })).failures, []);
    else await applySource(file, { projectDir: dir });
    assert.equal(parseLive(await readFile(LIVE(dir), 'utf8')).entries[0].refs[0], 'adr-legacy');
  }
});

test('an applied: written before finalize fails the accepted gate and validate', async () => {
  const dir = await mkProject();
  await writeLive(dir);
  const live = { ...added('cap-early'), applied: '2026-01-01' };
  const draft = await writeAdr(dir, { id: 'adr-early', status: 'draft', live });
  assert.match((await validateAdr(draft, { projectDir: dir })).warnings.join(), /`applied:` is written by finalize/);
  await assert.rejects(() => transition(draft, 'accepted', { projectDir: dir }), /`applied:` is written by finalize/);
  const accepted = await writeAdr(dir, { id: 'adr-early-acc', status: 'accepted', live });
  assert.match((await validateAdr(accepted, { projectDir: dir })).errors.join(), /`applied:` is written by finalize/);
  assert.deepEqual((await initLive({ projectDir: await mkProject() })).acceptedWithoutDelta, []);
});

test('check reports broken LIVE.md frontmatter and a missing since: without crashing or flagging old plans', async () => {
  const dir = await mkProject();
  const body = 'capabilities:\n- id: cap-a\n  summary: Users export a file.\n  refs: src/a.js\n';
  await writeFile(LIVE(dir), `---\ntype: live\nsince: [bad\n---\n\n${body}`, 'utf8');
  assert.ok((await checkLive({ projectDir: dir })).issues.some((i) => i.code === 'live-format' && /could not be parsed/.test(i.message)));

  await writeFile(LIVE(dir), `---\ntype: live\ntitle: Live state\n---\n\n${body}`, 'utf8');
  await fencedPlan(dir, '.ai-factory/archive/plans/old.md', null, { frontmatter: '---\narchived: 2020-01-01\n---\n' });
  const { issues } = await checkLive({ projectDir: dir });
  assert.ok(issues.some((i) => i.code === 'live-format' && /`since:`/.test(i.message)));
  assert.ok(!issues.some((i) => i.code === 'missing-delta'));
});

test('fences hide their content: an adr-live or a task inside a tilde or backtick example is data', () => {
  const example = '~~~markdown\n```adr-live\nnone: "example"\n```\n- [ ] example task\n~~~\n';
  const fence = findFence(`# Plan\n\n\`\`\`adr-live\nnone: "real"\n\`\`\`\n\n${example}`);
  assert.equal(YAML.parse(fence.yaml).none, 'real');
  assert.equal(hasOpenTask(`- [x] Done\n\n${example}`), false);
  assert.equal(hasOpenTask('- [x] Done\n  ```\n  code\n  ```\n- [ ] Open\n'), true);
});

test('supersede reports the warnings of the ref rewrite', async () => {
  const dir = await mkProject();
  await writeLive(dir, [{ id: 'kept', summary: 'The kept behaviour.', refs: ['adr-old'] }]);
  const old = await writeAdr(dir, { id: 'adr-old', status: 'active', evidence: 'implemented', live: { none: 'seeded' } });
  const neu = await writeAdr(dir, { id: 'adr-new', status: 'active', evidence: 'implemented', live: { none: 'a constraint only' } });
  const res = await supersede(old, neu, { projectDir: dir });
  assert.match(res.live.warnings.join(), /kept ref superseded adr-old.*change: removed/);
});

test('a writer holding LIVE.md.lock makes apply and finalize fail without writes; the lock goes away', async () => {
  const dir = await mkProject();
  await writeLive(dir);
  const plan = await fencedPlan(dir, '.ai-factory/plans/locked.md', added('cap-locked'));
  const adr = await writeAdr(dir, { id: 'adr-locked', status: 'accepted', evidence: 'documentation-only', live: added('cap-adr') });
  const [planBefore, liveBefore] = [await readFile(plan, 'utf8'), await readFile(LIVE(dir), 'utf8')];
  await withLiveLock(await liveContext(dir), async () => {
    await assert.rejects(() => applySource(plan, { projectDir: dir }), /Another command is writing LIVE\.md[\s\S]*LIVE\.md\.lock/);
    await assert.rejects(() => finalize(adr, { projectDir: dir }), /Another command is writing LIVE\.md/);
  });
  assert.equal(await readFile(plan, 'utf8'), planBefore);
  assert.equal(await readFile(LIVE(dir), 'utf8'), liveBefore);
  assert.ok(existsSync(adr), 'the ADR did not move');
  assert.equal(existsSync(`${LIVE(dir)}.lock`), false);
  await applySource(plan, { projectDir: dir });
});

test('concurrent applies never lose a record: each source reads as applied only when LIVE.md holds it', async () => {
  const dir = await mkProject();
  await writeLive(dir);
  const plans = [await fencedPlan(dir, '.ai-factory/plans/a.md', added('cap-a')), await fencedPlan(dir, '.ai-factory/plans/b.md', added('cap-b'))];
  const settled = await Promise.allSettled(plans.map((p) => applySource(p, { projectDir: dir })));
  const ids = parseLive(await readFile(LIVE(dir), 'utf8')).entries.map((e) => e.id);
  for (const [i, cap] of ['cap-a', 'cap-b'].entries()) {
    const applied = (await readDelta(plans[i])).delta.applied != null;
    assert.equal(applied, settled[i].status === 'fulfilled');
    assert.equal(ids.includes(cap), applied, `${cap}: in LIVE.md exactly when its plan reads as applied`);
  }
});

test('a git-ignored LIVE.md and plan are written with a warning that no commit carries them', async () => {
  const dir = await gitProject();
  await writeFile(path.join(dir, '.gitignore'), '.ai-factory/\n', 'utf8');
  await writeLive(dir);
  const plan = await fencedPlan(dir, '.ai-factory/plans/ignored.md', added('cap-ignored'));
  const res = await applySource(plan, { projectDir: dir });
  assert.equal(res.warnings.filter((w) => /is ignored by git/.test(w)).length, 2);
  const adr = await writeAdr(dir, { id: 'adr-ignored', status: 'accepted', evidence: 'documentation-only', live: added('cap-adr-ignored') });
  const fin = await finalize(adr, { projectDir: dir });
  assert.match(fin.live.warnings.join(), /\.ai-factory\/LIVE\.md is ignored by git/);
  assert.deepEqual(staged(dir).filter((f) => f.startsWith('.ai-factory/')), []);
});
