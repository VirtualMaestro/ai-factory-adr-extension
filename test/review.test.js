import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as review from '../src/review.js';
import { mkProject, writeAdr } from './helpers.js';

const git = (dir, ...args) => {
  const res = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  assert.equal(res.status, 0, `git ${args.join(' ')}: ${res.stderr}`);
  return res.stdout.trim();
};

async function repo() {
  const dir = await mkProject();
  git(dir, 'init', '-q', '-b', 'master');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'test');
  await writeFile(path.join(dir, '.gitignore'), 'ignored.txt\n', 'utf8');
  await writeFile(path.join(dir, 'a.txt'), 'one\n', 'utf8');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');
  const scratch = await mkdtemp(path.join(os.tmpdir(), 'adr-review-'));
  const prompt = path.join(scratch, 'prompt.md');
  await writeFile(prompt, '# Review task 1\n\nReview `git diff HEAD`.\n', 'utf8');
  return { dir, scratch, prompt };
}

const clean = { findings: [], checked: ['src/a.js'], verdict: 'clean' };

test('the snapshot sees an index change that leaves the worktree diff alone, and untracked files (§12 P1)', async () => {
  const { dir } = await repo();
  const base = review.snapshot(dir);
  assert.equal(review.snapshot(dir), base);

  await writeFile(path.join(dir, 'a.txt'), 'two\n', 'utf8');
  const edited = review.snapshot(dir);
  assert.notEqual(edited, base);
  git(dir, 'add', 'a.txt'); // same worktree, different index
  assert.notEqual(review.snapshot(dir), edited);

  const staged = review.snapshot(dir);
  await writeFile(path.join(dir, 'new.txt'), 'x', 'utf8');
  const untracked = review.snapshot(dir);
  assert.notEqual(untracked, staged);
  await writeFile(path.join(dir, 'new.txt'), 'y', 'utf8');
  assert.notEqual(review.snapshot(dir), untracked, 'the content of an untracked file counts');

  const before = review.snapshot(dir);
  await writeFile(path.join(dir, 'ignored.txt'), 'z', 'utf8');
  assert.equal(review.snapshot(dir), before, 'an ignored file is outside the guarantee');
});

test('begin writes the prompt, the schema and the meta under .git/adr-auto and resolves the role', async () => {
  const { dir, prompt } = await repo();
  await writeFile(path.join(dir, '.ai-factory', 'adr-extension.yaml'),
    'adr:\n  auto:\n    roles:\n      reviewer_1: { runtime: codex-cli, model: gpt-x, effort: medium, timeout: 600 }\n    plan:\n      roles:\n        reviewer_1: { effort: high }\n', 'utf8');
  const adr = await writeAdr(dir, { id: 'adr-r', status: 'draft' });

  const tree = git(dir, 'status', '--porcelain', '-uall');
  const res = await review.begin({ role: 'reviewer_1', prompt, files: [path.relative(dir, adr)], rubric: 'adr', phase: 'plan', projectDir: dir });
  assert.equal(res.runtime, 'codex-cli');
  assert.equal(res.effort, 'high');
  assert.equal(res.timeout, 600);
  assert.ok(res.dir.replace(/\\/g, '/').includes('.git/adr-auto/'));
  const text = await readFile(res.prompt, 'utf8');
  assert.match(text, /# Review task 1/);
  assert.match(text, /## Files under review\n\n- docs\/adr\/drafts\/adr-r\.md/);
  assert.match(text, /quality_rules:/);
  assert.match(text, /read-only reviewer/);
  assert.deepEqual(JSON.parse(await readFile(res.schema, 'utf8')), review.resultSchema('adr'));
  assert.match(text, /Pick `decision` for the chosen approach itself/);
  assert.equal(git(dir, 'status', '--porcelain', '-uall'), tree, 'begin writes nothing into the tree');

  const sub = await review.begin({ role: 'reviewer_1', prompt, runtime: 'subagent', projectDir: dir });
  assert.equal(sub.runtime, 'subagent');
  await assert.rejects(review.begin({ role: 'critic', prompt, projectDir: dir }), /Unknown review role/);
  await assert.rejects(review.begin({ role: 'reviewer_2', prompt: 'missing.md', projectDir: dir }), /prompt is missing/);
});

test('end counts a clean subagent review and rejects one whose tree changed', async () => {
  const { dir, scratch, prompt } = await repo();
  const result = path.join(scratch, 'r.json');
  await writeFile(result, '```json\n' + JSON.stringify(clean) + '\n```', 'utf8');

  const ok = await review.begin({ role: 'reviewer_2', prompt, projectDir: dir });
  const res = await review.end(ok.id, { result, projectDir: dir });
  assert.equal(res.ok, true, res.reasons.join('; '));
  assert.equal(res.verdict, 'clean');

  const wrote = await review.begin({ role: 'reviewer_2', prompt, projectDir: dir });
  await writeFile(path.join(dir, 'a.txt'), 'changed by the reviewer\n', 'utf8');
  const bad = await review.end(wrote.id, { result, projectDir: dir });
  assert.equal(bad.ok, false);
  assert.match(bad.reasons.join('\n'), /tree changed/);
  assert.deepEqual(bad.findings, []);
});

test('end rejects a missing, empty, non-JSON or off-schema result', async () => {
  const { dir, scratch, prompt } = await repo();
  const b = await review.begin({ role: 'reviewer_1', prompt, projectDir: dir });
  assert.match((await review.end(b.id, { result: path.join(scratch, 'none.json'), projectDir: dir })).reasons.join(), /no result/);
  const f = path.join(scratch, 'r.json');
  await writeFile(f, '', 'utf8');
  assert.match((await review.end(b.id, { result: f, projectDir: dir })).reasons.join(), /empty/);
  await writeFile(f, 'looks fine to me', 'utf8');
  assert.match((await review.end(b.id, { result: f, projectDir: dir })).reasons.join(), /not JSON/);
  await writeFile(f, JSON.stringify({ findings: [{ severity: 'blocker', file: 'a', line: '3', claim: 'x', evidence: 'y' }], checked: [], verdict: '' }), 'utf8');
  const reasons = (await review.end(b.id, { result: f, projectDir: dir })).reasons.join('\n');
  for (const p of [/severity "blocker"/, /`line`/, /`verified`/, /`verdict` is empty/]) assert.match(reasons, p);
  await assert.rejects(review.end('../../etc', { projectDir: dir }), /Unknown review id/);
});

test('run drives a CLI reviewer and end reads its exit, its timeout and its result', async () => {
  const { dir, prompt } = await repo();
  await writeFile(path.join(dir, '.ai-factory', 'adr-extension.yaml'),
    'adr:\n  auto:\n    roles:\n      reviewer_1: { runtime: codex-cli }\n      reviewer_2: { runtime: claude-cli, model: opus }\n', 'utf8');
  const resolve = (bin) => ({ file: bin, prefix: [] });

  const codex = await review.begin({ role: 'reviewer_1', prompt, projectDir: dir });
  let seen;
  const fakeCodex = async (bin, args, opts) => {
    seen = { bin, args, opts };
    await writeFile(args[args.indexOf('-o') + 1], JSON.stringify(clean), 'utf8');
    return { status: 0, stdout: '', stderr: '', timedOut: false, error: null };
  };
  const ran = await review.run(codex.id, { projectDir: dir, exec: fakeCodex, resolve });
  assert.equal(seen.bin, 'codex');
  assert.ok(seen.args.includes('read-only') && seen.args.includes('--output-schema'));
  assert.match(seen.opts.input, /read-only reviewer/);
  assert.equal(seen.opts.timeout, 1800 * 1000);
  assert.equal(ran.exit, 0);

  // A rerun that leaves no result must not pass on the result of the run before it.
  await review.run(codex.id, { projectDir: dir, resolve, exec: async () => ({ status: 0, stdout: 'garbage', stderr: '', timedOut: false, error: null }) });
  assert.match((await review.end(codex.id, { projectDir: dir })).reasons.join(), /no result/);

  // A counted review removes its work directory; the failed one above stays for diagnosis.
  await review.run(codex.id, { projectDir: dir, exec: fakeCodex, resolve });
  const ended = await review.end(codex.id, { projectDir: dir });
  assert.equal(ended.ok, true);
  assert.equal(existsSync(path.join(dir, '.git', 'adr-auto', codex.id)), false);

  const slow = await review.begin({ role: 'reviewer_1', prompt, projectDir: dir });
  await review.run(slow.id, { projectDir: dir, resolve, exec: async () => ({ status: null, stdout: '', stderr: '', timedOut: true, error: null }) });
  assert.match((await review.end(slow.id, { projectDir: dir })).reasons.join(), /timed out after 1800s/);

  const claude = await review.begin({ role: 'reviewer_2', prompt, projectDir: dir });
  const fakeClaude = async (bin, args) => {
    assert.equal(bin, 'claude');
    assert.deepEqual(args.slice(0, 3), ['-p', '--permission-mode', 'plan']);
    assert.ok(args.includes('opus'));
    assert.ok(args.includes('--json-schema'));
    return { status: 0, stdout: JSON.stringify({ result: 'x', structured_output: clean }), stderr: '', timedOut: false, error: null };
  };
  await review.run(claude.id, { projectDir: dir, exec: fakeClaude, resolve });
  assert.equal((await review.end(claude.id, { projectDir: dir })).ok, true);

  const failed = await review.begin({ role: 'reviewer_2', prompt, projectDir: dir });
  await review.run(failed.id, { projectDir: dir, resolve, exec: async () => ({ status: 2, stdout: '', stderr: 'not logged in', timedOut: false, error: null }) });
  assert.match((await review.end(failed.id, { projectDir: dir })).reasons.join(), /exited 2: not logged in/);

  const missing = await review.begin({ role: 'reviewer_2', prompt, projectDir: dir });
  await review.run(missing.id, { projectDir: dir, resolve: () => null });
  assert.match((await review.end(missing.id, { projectDir: dir })).reasons.join(), /did not start: claude not found/);

  const sub = await review.begin({ role: 'reviewer_2', runtime: 'subagent', prompt, projectDir: dir });
  await assert.rejects(review.run(sub.id, { projectDir: dir }), /subagent review has no `run`/);
});

test('execTree kills the whole process tree at its timeout, a grandchild holding the pipes included', async () => {
  const grandchild = "require('child_process').spawn(process.execPath, ['-e', 'setTimeout(() => {}, 20000)'], { stdio: 'inherit' }); setTimeout(() => {}, 20000);";
  const started = Date.now();
  const res = await review.execTree(process.execPath, ['-e', grandchild], { cwd: os.tmpdir(), input: '', timeout: 1500 });
  assert.equal(res.timedOut, true);
  assert.ok(Date.now() - started < 10000, `took ${Date.now() - started} ms`);
});

test('an argument with shell metacharacters reaches the CLI unchanged', async () => {
  const arg = 'a & b ^ c % d | e "f"';
  const res = await review.execTree(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', arg], { cwd: os.tmpdir(), input: '', timeout: 10000 });
  assert.equal(res.stdout, arg);
});

test('resolveBin starts an npm shim through node and an exe directly, without a shell', async () => {
  const scratch = await mkdtemp(path.join(os.tmpdir(), 'adr-shim-'));
  const shim = path.join(scratch, 'codex.cmd');
  await writeFile(shim, '@ECHO off\r\n"%_prog%"  "%dp0%\\node_modules\\@openai\\codex\\bin\\codex.js" %*\r\n', 'utf8');
  const viaShim = review.resolveBin('codex', { platform: 'win32', where: () => `${path.join(scratch, 'codex')}\r\n${shim}\r\n` });
  assert.equal(viaShim.file, process.execPath);
  assert.deepEqual(viaShim.prefix, [path.join(scratch, 'node_modules\\@openai\\codex\\bin\\codex.js')]);
  assert.deepEqual(review.resolveBin('claude', { platform: 'win32', where: () => 'C:\\bin\\claude.exe\r\n' }), { file: 'C:\\bin\\claude.exe', prefix: [] });
  assert.equal(review.resolveBin('nope', { platform: 'win32', where: () => '' }), null);
  assert.deepEqual(review.resolveBin('codex', { platform: 'linux' }), { file: 'codex', prefix: [] });
});

test('the snapshot sees a write to a file git is told to assume unchanged', async () => {
  const { dir } = await repo();
  git(dir, 'update-index', '--assume-unchanged', 'a.txt');
  const before = review.snapshot(dir);
  await writeFile(path.join(dir, 'a.txt'), 'hidden from status\n', 'utf8');
  assert.equal(git(dir, 'status', '--porcelain'), '', 'git status misses it');
  assert.notEqual(review.snapshot(dir), before);
});

test('the schema check refuses unexpected keys and empty claims', () => {
  const problems = review.resultProblems({
    findings: [{ severity: 'low', file: 'a', line: null, claim: ' ', evidence: 'e', verified: true, extra: 1 }],
    checked: [],
    verdict: 'v',
    note: 'x',
  }).join('\n');
  for (const p of [/unexpected key `note`/, /unexpected key `extra`/, /`claim` is empty/]) assert.match(problems, p);
});

test('the rubrics come from the installed skills', async () => {
  assert.match(await review.rubricText('adr'), /^Judge the ADR[\s\S]*quality_rules:\n- /);
  const plan = await review.rubricText('plan');
  assert.match(plan, /aif-improve/);
  assert.match(plan, /task_rules:\n- a task is worth a full implementation cycle/);
  assert.match(plan, /quality_rules:/);
  await assert.rejects(review.rubricText('code'), /Unknown rubric/);
});

test('the snapshot hashes the files after a submodule directory', async () => {
  const { dir } = await repo();
  const head = git(dir, 'rev-parse', 'HEAD');
  git(dir, 'update-index', '--add', '--cacheinfo', `160000,${head},sub`);
  await mkdir(path.join(dir, 'sub'));
  await writeFile(path.join(dir, 'z.txt'), 'one\n', 'utf8');
  const before = review.snapshot(dir);
  await writeFile(path.join(dir, 'z.txt'), 'two\n', 'utf8');
  assert.notEqual(review.snapshot(dir), before);
});

test('the snapshot sees a branch switch, a new branch and a new tag', async () => {
  const { dir } = await repo();
  const base = review.snapshot(dir);
  git(dir, 'branch', 'other');
  const branched = review.snapshot(dir);
  assert.notEqual(branched, base);
  git(dir, 'switch', '-q', 'other');
  assert.notEqual(review.snapshot(dir), branched);
  const switched = review.snapshot(dir);
  git(dir, 'tag', 't1');
  assert.notEqual(review.snapshot(dir), switched);
});

test('the text of end carries the evidence of each finding: a counted review leaves no result.json for triage', () => {
  const text = review.formatFindings({
    findings: [{ severity: 'high', file: 'docs/adr/a.md', line: 12, claim: 'The decision misses the 2-minute bound.', evidence: 'Retries wait\n  up to 1 h.', verified: true }],
    verdict: 'revise',
  });
  assert.match(text, /high\s+docs\/adr\/a\.md:12 {2}The decision misses the 2-minute bound\./);
  assert.match(text, /evidence: Retries wait up to 1 h\./);
  assert.match(text, /1 finding\(s\)\. revise$/);
});

test('--rubric adr asks for a decision on the ADR as a whole, and end returns it', async () => {
  assert.deepEqual(review.resultSchema('plan'), review.RESULT_SCHEMA);
  assert.deepEqual(review.resultSchema('adr').required, ['findings', 'checked', 'verdict', 'decision']);
  assert.deepEqual(review.resultProblems(clean, 'adr'), ['`decision` undefined is not one of sound, revise, rethink, reject, insufficient']);
  assert.deepEqual(review.resultProblems({ ...clean, decision: 'rethink' }, 'adr'), []);
  assert.deepEqual(review.resultProblems({ ...clean, decision: 'rethink' }), ['unexpected key `decision`']);
  assert.match(review.cliCommand({ runtime: 'claude-cli', rubric: 'adr' }, {}).args.join(' '), /"decision"/);

  const { dir, scratch, prompt } = await repo();
  const adr = await writeAdr(dir, { id: 'adr-d', status: 'draft' });
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'adr');
  const result = path.join(scratch, 'd.json');
  await writeFile(result, JSON.stringify({ ...clean, decision: 'reject' }), 'utf8');
  const b = await review.begin({ role: 'reviewer_2', prompt, files: [path.relative(dir, adr)], rubric: 'adr', phase: 'plan', projectDir: dir });
  const res = await review.end(b.id, { result, projectDir: dir });
  assert.equal(res.ok, true, res.reasons.join('; '));
  assert.equal(res.decision, 'reject');
  assert.match(review.formatFindings(res), /0 finding\(s\)\. decision: reject\. clean$/);
});
