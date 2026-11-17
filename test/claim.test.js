import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, mkdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { read } from '../src/artifacts/frontmatter.js';
import { claim, release, checkClaim, unclaim, assertClaimBranch, assertAdrAndPlanBranch } from '../src/lifecycle/claim.js';
import { transition } from '../src/lifecycle/move.js';
import { validateAdr } from '../src/lifecycle/validate.js';
import { finalize } from '../src/lifecycle/finalize.js';
import { buildOrder } from '../src/order.js';
import { buildStatus, buildFileStatus } from '../src/status.js';
import { push } from '../src/util/git.js';
import { resolveAutoConfig } from '../src/config/adrConfig.js';
import { mkProject, writeAdr, writePlan } from './helpers.js';

const git = (dir, ...args) => {
  const res = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  assert.equal(res.status, 0, `git ${args.join(' ')}: ${res.stderr}`);
  return res.stdout.trim();
};

/** A project committed on `master` with a bare remote `origin` it tracks. */
async function gitProject({ remote = true } = {}) {
  const dir = await mkProject();
  git(dir, 'init', '-q', '-b', 'master');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'test');
  const adr = await writeAdr(dir, { id: 'adr-x', status: 'accepted', plan: 'plan-x' });
  const plan = await writePlan(dir, { id: 'plan-x', implements: ['adr-x'] });
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');
  let bare = null;
  if (remote) {
    bare = await mkdtemp(path.join(os.tmpdir(), 'adr-bare-'));
    git(bare, 'init', '-q', '--bare', '-b', 'master');
    git(dir, 'remote', 'add', 'origin', bare);
    git(dir, 'push', '-q', '-u', 'origin', 'master');
  }
  return { dir, adr, plan, bare };
}

test('claim writes branch, base and started on an accepted ADR and names the branch', async () => {
  const dir = await mkProject();
  const file = await writeAdr(dir, { id: 'adr-c', status: 'accepted' });
  const res = await claim(file, { base: 'master', projectDir: dir });
  assert.equal(res.branch, 'adr/adr-c');
  const { data } = await read(file);
  assert.equal(data.branch, 'adr/adr-c');
  assert.equal(data.base, 'master');
  assert.match(String(data.started), /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual((await validateAdr(file, { projectDir: dir })).errors, []);
});

test('claim takes the branch prefix from adr.auto.branch.prefix', async () => {
  const dir = await mkProject();
  await writeFile(path.join(dir, '.ai-factory', 'adr-extension.yaml'), 'adr:\n  auto:\n    branch:\n      prefix: work/\n', 'utf8');
  const file = await writeAdr(dir, { id: 'adr-p', status: 'accepted' });
  assert.equal((await claim(file, { base: 'main', projectDir: dir })).branch, 'work/adr-p');
});

test('claim refuses an ADR that is not accepted, a second claim, and a missing base', async () => {
  const dir = await mkProject();
  const draft = await writeAdr(dir, { id: 'adr-d', status: 'draft' });
  await assert.rejects(claim(draft, { base: 'master', projectDir: dir }), /Only an accepted ADR is claimed/);
  const file = await writeAdr(dir, { id: 'adr-twice', status: 'accepted' });
  await assert.rejects(claim(file, { projectDir: dir }), /needs its base/);
  await claim(file, { base: 'master', projectDir: dir });
  await assert.rejects(claim(file, { base: 'master', projectDir: dir }), /Already claimed[\s\S]*adr\/adr-twice/);
});

test('a plan claim names change/<plan-stem> and needs a plan in progress', async () => {
  const dir = await mkProject();
  const plan = await writePlan(dir, { id: 'plan-ch', name: 'fix-login' });
  assert.equal((await claim(plan, { base: 'master', projectDir: dir })).branch, 'change/fix-login');
  const done = await writePlan(dir, { id: 'plan-done', status: 'done' });
  await assert.rejects(claim(done, { base: 'master', projectDir: dir }), /Only a plan in progress/);
});

test('release removes the claim and writes the file; a file without a claim is left alone', async () => {
  const dir = await mkProject();
  const file = await writeAdr(dir, { id: 'adr-r', status: 'accepted' });
  await claim(file, { base: 'master', projectDir: dir });
  const res = await release(file, { projectDir: dir });
  assert.equal(res.released, true);
  assert.equal(res.claim.branch, 'adr/adr-r');
  const { data } = await read(file);
  assert.equal(data.branch, undefined);
  assert.equal(data.base, undefined);
  assert.equal(data.started, undefined);
  assert.equal((await release(file, { projectDir: dir })).released, false);
});

test('validate errors on a claim outside accepted and on a claim without its branch', async () => {
  const dir = await mkProject();
  const active = await writeAdr(dir, { id: 'adr-a', status: 'active', evidence: 'implemented', code: ['x.js'], branch: 'adr/adr-a', base: 'master' });
  assert.ok((await validateAdr(active, { projectDir: dir })).errors.some((e) => /claim \(branch, base\) on a active ADR/.test(e)));
  const partial = await writeAdr(dir, { id: 'adr-part', status: 'accepted', base: 'master' });
  assert.ok((await validateAdr(partial, { projectDir: dir })).errors.some((e) => /claim without `branch:`/.test(e)));
  assert.equal((await release(partial, { projectDir: dir })).released, true);
  assert.deepEqual((await validateAdr(partial, { projectDir: dir })).errors, []);
});

test('finalize removes the claim on the way to active', async () => {
  const dir = await mkProject();
  const adr = await writeAdr(dir, { id: 'adr-fin', status: 'accepted', plan: 'plan-fin', evidence: 'implemented' });
  await writePlan(dir, { id: 'plan-fin', implements: ['adr-fin'] });
  await claim(adr, { base: 'master', projectDir: dir });
  const res = await finalize(adr, { projectDir: dir });
  const { data } = await read(res.active);
  assert.equal(data.status, 'active');
  assert.equal(data.branch, undefined);
  assert.equal(data.base, undefined);
  assert.deepEqual((await validateAdr(res.active, { projectDir: dir })).errors, []);
});

test('order lists a claimed ADR as in work and not as next', async () => {
  const dir = await mkProject();
  const a = await writeAdr(dir, { id: 'adr-o1', status: 'accepted' });
  await writeAdr(dir, { id: 'adr-o2', status: 'accepted' });
  await claim(a, { base: 'master', projectDir: dir });
  const res = await buildOrder({ projectDir: dir });
  assert.deepEqual(res.next, ['adr-o2']);
  assert.deepEqual(res.inWork, [{ id: 'adr-o1', branch: 'adr/adr-o1' }]);
  assert.equal(res.order.find((o) => o.id === 'adr-o1').branch, 'adr/adr-o1');
});

test('checkClaim and the CLI guard pass on the claim branch and refuse elsewhere', async () => {
  const { dir, adr } = await gitProject({ remote: false });
  assert.equal((await checkClaim(adr, { projectDir: dir })).ok, true); // no claim
  await claim(adr, { base: 'master', projectDir: dir });
  const off = await checkClaim(adr, { projectDir: dir });
  assert.equal(off.ok, false);
  assert.equal(off.current, 'master');
  await assert.rejects(assertClaimBranch(adr, { projectDir: dir, command: 'finalize' }), /in work on adr\/adr-x[\s\S]*current branch master/);
  git(dir, 'switch', '-q', '-c', 'adr/adr-x');
  assert.equal((await checkClaim(adr, { projectDir: dir })).ok, true);
  await assertClaimBranch(adr, { projectDir: dir, command: 'finalize' });
});

test('status shows the claim and warns when its branch exists neither locally nor on a remote', async () => {
  const { dir, adr, plan } = await gitProject();
  await claim(adr, { base: 'master', projectDir: dir });
  await claim(plan, { base: 'master', projectDir: dir });
  let report = await buildStatus(dir);
  assert.deepEqual(report.inWork.map((c) => `${c.kind}:${c.id}:${c.branch}`).sort(), ['adr:adr-x:adr/adr-x', 'plan:plan-x:change/plan-x']);
  assert.equal(report.warnings.length, 2, report.warnings.join('\n'));
  assert.equal((await buildFileStatus(adr, dir)).claim.stale, true);

  git(dir, 'branch', 'adr/adr-x'); // local branch: not stale
  git(dir, 'branch', 'change/plan-x');
  git(dir, 'push', '-q', 'origin', 'change/plan-x');
  git(dir, 'branch', '-D', 'change/plan-x'); // remote-tracking only: not stale either
  report = await buildStatus(dir);
  assert.deepEqual(report.warnings, []);
  assert.deepEqual(report.issues, []);
});

test('status --check reports a claim on a plan that is done', async () => {
  const dir = await mkProject();
  const file = path.join(dir, '.ai-factory', 'plans', 'old.md');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, '---\nid: plan-old\ntype: plan\nstatus: done\nimplements: []\nbranch: change/old\n---\n\n# Plan\n', 'utf8');
  const report = await buildStatus(dir);
  assert.ok(report.issues.some((i) => /claim on a done plan/.test(i)), report.issues.join('\n'));
});

test('unclaim commits the release on the base, pushes it and deletes the branch', async () => {
  const { dir, adr, bare } = await gitProject();
  await claim(adr, { base: 'master', projectDir: dir });
  git(dir, 'commit', '-qam', 'chore(adr): start adr-x on adr/adr-x');
  git(dir, 'push', '-q', 'origin', 'master');
  git(dir, 'switch', '-q', '-c', 'adr/adr-x');
  git(dir, 'push', '-q', '-u', 'origin', 'adr/adr-x');

  await assert.rejects(unclaim(adr, { projectDir: dir }), /Unclaim runs on the base/);
  git(dir, 'switch', '-q', 'master');
  const res = await unclaim(adr, { projectDir: dir, deleteBranch: true });
  assert.equal(res.pushed, true);
  assert.deepEqual(res.deleted, { local: true, remote: true });
  assert.equal(git(dir, 'log', '-1', '--format=%s'), 'chore(adr): release adr-x');
  assert.equal(git(dir, 'status', '--porcelain'), '');
  assert.equal(git(bare, 'rev-parse', 'master'), git(dir, 'rev-parse', 'master'));
  assert.equal(git(bare, 'branch', '--list', 'adr/adr-x'), '');
  assert.equal((await read(adr)).data.branch, undefined);
});

test('unclaim stays local when the base has no upstream, and refuses a staged index', async () => {
  const { dir, adr } = await gitProject({ remote: false });
  await claim(adr, { base: 'master', projectDir: dir });
  git(dir, 'commit', '-qam', 'claim');
  await writeFile(path.join(dir, 'other.txt'), 'x', 'utf8');
  git(dir, 'add', 'other.txt');
  await assert.rejects(unclaim(adr, { projectDir: dir }), /staged changes/);
  git(dir, 'reset', '-q');
  const res = await unclaim(adr, { projectDir: dir });
  assert.equal(res.pushed, false);
  assert.match(res.local, /no upstream/);
});

test('push tells a moved remote from a refusing policy', async () => {
  const { dir, bare } = await gitProject();
  const other = await mkdtemp(path.join(os.tmpdir(), 'adr-clone-'));
  git(other, 'clone', '-q', bare, '.');
  git(other, 'config', 'user.email', 'test@example.com');
  git(other, 'config', 'user.name', 'test');
  git(other, 'commit', '-q', '--allow-empty', '-m', 'moved');
  git(other, 'push', '-q', 'origin', 'master');

  git(dir, 'commit', '-q', '--allow-empty', '-m', 'local');
  const moved = push(dir, 'origin', 'master');
  assert.equal(moved.ok, false);
  assert.equal(moved.rejected, 'moved', moved.output);

  await writeFile(path.join(bare, 'hooks', 'pre-receive'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  git(dir, 'switch', '-q', '-c', 'side');
  const policy = push(dir, 'origin', 'side');
  assert.equal(policy.rejected, 'policy', policy.output);
});

test('auto config resolves defaults, overrides and errors', () => {
  const empty = resolveAutoConfig({});
  assert.deepEqual(empty.errors, []);
  assert.equal(empty.auto.max_rounds, 3);
  assert.equal(empty.auto.escalate_at, 'high');
  assert.deepEqual(empty.roles.implement.coder, { runtime: 'subagent', model: null, effort: null, fallback: ['subagent', 'inline'] });

  const cfg = resolveAutoConfig({
    adr: {
      auto: {
        roles: { coder: { runtime: 'subagent', model: 'opus' }, reviewer_1: { runtime: 'codex-cli', model: 'gpt-x', effort: 'medium' } },
        plan: { roles: { reviewer_1: { effort: 'high' } } },
      },
      acceptance: { command: 'npm run e2e', exploratory: { instructions: 'docs/x.md' } },
    },
  });
  assert.deepEqual(cfg.errors, []);
  assert.equal(cfg.roles.implement.reviewer_1.timeout, 1800);
  assert.deepEqual(cfg.roles.implement.reviewer_1.fallback, ['codex-cli', 'subagent', 'inline']);
  assert.equal(cfg.roles.plan.reviewer_1.effort, 'high');
  assert.equal(cfg.roles.plan.reviewer_1.model, 'gpt-x');
  assert.equal(cfg.roles.plan.author.model, 'opus'); // the author falls back to the coder
  assert.deepEqual(cfg.acceptance.exploratory, { instructions: 'docs/x.md', rounds: 1 });

  const bad = resolveAutoConfig({
    adr: {
      auto: { roles: { coder: { runtime: 'gpt' }, critic: {} }, escalate_at: 'urgent', checks: { task: 'npm test' }, branch: { prefix: 'a b' }, extra: 1 },
      acceptance: { exploratory: {} },
    },
  });
  for (const pattern of [/coder\.runtime/, /critic: unknown role/, /escalate_at/, /checks\.task/, /branch\.prefix/, /adr\.auto\.extra/, /exploratory\.instructions/]) {
    assert.ok(bad.errors.some((e) => pattern.test(e)), `${pattern} in ${bad.errors.join('; ')}`);
  }
});

test('a core plan without frontmatter is claimed as a plan, and its release adds no type', async () => {
  const dir = await mkProject();
  const full = path.join(dir, '.ai-factory', 'plans', 'add-search.md');
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, '# Add search\n\n## Tasks\n\n- [ ] 1. index\n', 'utf8');
  const res = await claim(full, { base: 'main', projectDir: dir });
  assert.equal(res.branch, 'change/add-search');
  assert.equal(res.kind, 'plan');
  assert.equal(res.id, 'add-search');
  await release(full, { projectDir: dir });
  const { data } = await read(full);
  assert.equal(data.type, undefined);
  assert.equal(data.branch, undefined);

  const ultra = path.join(dir, '.ai-factory', 'plans', 'big-change', 'index.md');
  await mkdir(path.dirname(ultra), { recursive: true });
  await writeFile(ultra, '<!-- aif:plan-mode:ultra -->\n# Big change\n', 'utf8');
  assert.equal((await claim(ultra, { base: 'main', projectDir: dir })).branch, 'change/big-change');
  assert.deepEqual((await buildStatus(dir)).inWork.map((c) => c.branch), ['change/big-change']);

  const outside = path.join(dir, 'notes.md');
  await writeFile(outside, '# Notes\n', 'utf8');
  await assert.rejects(claim(outside, { base: 'main', projectDir: dir }), /Only an ADR or a plan takes a claim/);
});

test('unclaim pushes to the upstream branch, even when its name differs from the base', async () => {
  const { dir, adr, bare } = await gitProject();
  git(dir, 'push', '-q', 'origin', 'master:main');
  git(dir, 'branch', '-q', '--set-upstream-to=origin/main', 'master');
  await claim(adr, { base: 'master', projectDir: dir });
  git(dir, 'commit', '-qam', 'claim');
  git(dir, 'push', '-q', 'origin', 'master:main');
  const res = await unclaim(adr, { projectDir: dir });
  assert.equal(res.pushed, true, JSON.stringify(res.pushError));
  assert.equal(git(bare, 'log', '-1', '--format=%s', 'main'), 'chore(adr): release adr-x');
});

test('unclaim keeps the branch when the release push fails, and refuses other edits to the file', async () => {
  const { dir, adr, bare } = await gitProject();
  await claim(adr, { base: 'master', projectDir: dir });
  git(dir, 'commit', '-qam', 'claim');
  git(dir, 'push', '-q', 'origin', 'master');
  git(dir, 'branch', 'adr/adr-x');
  git(dir, 'push', '-q', 'origin', 'adr/adr-x');

  const other = await mkdtemp(path.join(os.tmpdir(), 'adr-clone-'));
  git(other, 'clone', '-q', bare, '.');
  git(other, 'config', 'user.email', 'test@example.com');
  git(other, 'config', 'user.name', 'test');
  git(other, 'commit', '-q', '--allow-empty', '-m', 'moved');
  git(other, 'push', '-q', 'origin', 'master');

  await writeFile(adr, (await readFile(adr, 'utf8')) + '\nan unrelated edit\n', 'utf8');
  await assert.rejects(unclaim(adr, { projectDir: dir, deleteBranch: true }), /uncommitted changes/);
  git(dir, 'checkout', '--', '.');

  const res = await unclaim(adr, { projectDir: dir, deleteBranch: true });
  assert.equal(res.pushed, false);
  assert.equal(res.pushError.rejected, 'moved');
  assert.match(res.deleteSkipped, /push failed/);
  assert.equal(git(dir, 'branch', '--list', 'adr/adr-x'), 'adr/adr-x');
  assert.equal(git(bare, 'branch', '--list', 'adr/adr-x'), 'adr/adr-x');
});

test('claim is written on its base: another checkout is refused', async () => {
  const { dir, adr } = await gitProject({ remote: false });
  await assert.rejects(claim(adr, { base: 'main', projectDir: dir }), /written on its base[\s\S]*current branch master/);
});

test('the finalize guard also covers a plan claimed on another branch', async () => {
  const { dir, adr, plan } = await gitProject({ remote: false });
  await claim(plan, { base: 'master', projectDir: dir });
  await assertClaimBranch(adr, { projectDir: dir, command: 'finalize' }); // the ADR itself is unclaimed
  await assert.rejects(assertAdrAndPlanBranch(adr, { projectDir: dir, command: 'finalize' }), /in work on change\/plan-x/);
});

test('leaving accepted removes the claim, and a broken cnlp.config.json stops an accept before any move', async () => {
  const dir = await mkProject();
  const adr = await writeAdr(dir, { id: 'adr-back', status: 'accepted' });
  await claim(adr, { base: 'master', projectDir: dir });
  const res = await transition(adr, 'draft', { projectDir: dir });
  assert.equal((await read(res.target)).data.branch, undefined);

  await writeFile(path.join(dir, 'cnlp.config.json'), '{ not json', 'utf8');
  await assert.rejects(transition(res.target, 'accepted', { projectDir: dir }), /cnlp\.config\.json is not valid JSON/);
  assert.equal((await read(res.target)).data.status, 'draft', 'the ADR did not move');
});

test('auto config refuses a checks, branch or release block that is not a mapping', () => {
  const bad = resolveAutoConfig({ adr: { auto: { checks: 'npm test', branch: 'adr/', release: 'npm publish' } } });
  for (const k of ['checks', 'branch', 'release']) assert.ok(bad.errors.includes(`adr.auto.${k}: expected a mapping`), bad.errors.join('; '));
});

test('an accept whose corpus sync fails rolls the move back', async () => {
  const dir = await mkProject();
  const accepted = await writeAdr(dir, { id: 'adr-corpus', status: 'accepted' });
  const adr = (await transition(accepted, 'draft', { projectDir: dir })).target;
  await writeFile(path.join(dir, 'cnlp.config.json'), '{"corpus":{}}', 'utf8');
  await assert.rejects(transition(adr, 'accepted', { projectDir: dir }), /could not take the ADR corpus entry/);
  assert.equal((await read(adr)).data.status, 'draft', 'the draft is back in place');
  assert.equal(existsSync(accepted), false, "no accepted copy is left");
});

test('the claim guard lets a fast plan and a bundle directory through, and reads a bundle claim on its index', async () => {
  const { dir } = await gitProject({ remote: false });
  const fast = path.join(dir, '.ai-factory', 'PLAN.md');
  await writeFile(fast, '# Fast plan\n\n- [ ] one\n', 'utf8');
  await assertClaimBranch(fast, { projectDir: dir, command: 'live apply' });

  const bundle = path.join(dir, 'bundle');
  await mkdir(bundle);
  await assertClaimBranch(bundle, { projectDir: dir, command: 'live apply' }); // no index.md
  const index = ['---', 'type: plan', 'branch: change/bundle', 'base: master', 'started: 2026-11-17', '---', '# Bundle', ''];
  await writeFile(path.join(bundle, 'index.md'), index.join('\n'), 'utf8');
  await assert.rejects(assertClaimBranch(bundle, { projectDir: dir, command: 'live apply' }), /in work on change\/bundle/);
  assert.equal((await checkClaim(bundle, { projectDir: dir })).claim.branch, 'change/bundle', 'the commands the guard names take the directory too');
});
