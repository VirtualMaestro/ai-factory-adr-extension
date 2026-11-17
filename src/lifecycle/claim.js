import path from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { read, serialize } from '../artifacts/frontmatter.js';
import { resolveInside, atomicWrite } from '../util/safe-path.js';
import { git, currentBranch, branchExists, upstreamOf, push } from '../util/git.js';
import { branchPrefix, readAifGit, readAifPaths } from '../config/paths.js';
import { todayUTC } from './archive.js';
import { resolveActivePlan } from '../artifacts/plan.js';

/**
 * The claim marks an ADR or a plan as in work on a branch (proposal-auto-implement-orchestration §4).
 * It is 3 frontmatter keys: `branch`, `base`, `started`. The pushed branch is the lock across clones;
 * the claim is what a reader of the file on the base sees.
 */
export const CLAIM_KEYS = ['branch', 'base', 'started'];

class ClaimError extends Error {}

const fail = (title, { expected, detected, next, files = 'nothing was changed' }) =>
  new ClaimError(`${title}\n  expected: ${expected}\n  detected: ${detected}\n  files:    ${files}\n  next:     ${next}`);

/** The claim of a parsed frontmatter, or null when it has no `branch:`. */
export function readClaim(data) {
  const branch = String(data?.branch ?? '').trim();
  if (!branch) return null;
  return { branch, base: String(data.base ?? '').trim() || null, started: data.started == null ? null : String(data.started) };
}

/** The plan stem: the file name, or the bundle directory of an ultra `index.md`. */
const planStem = (abs) => (path.basename(abs) === 'index.md' ? path.basename(path.dirname(abs)) : path.basename(abs, '.md'));

/** A plan is `done` once archived (`src/lifecycle/archive.js`); a core plan may have no status at all. */
export const planInProgress = (data) => data.status !== 'done' && data.archived == null;

/** The branch a claim of this file names: `<prefix><adr-id>` for an ADR, `change/<plan-stem>` for a plan. */
export async function claimBranch(abs, data, projectDir, kind = data.type) {
  if (kind === 'plan') return `change/${planStem(abs)}`;
  return `${await branchPrefix(projectDir)}${data.id}`;
}

/** True when `abs` sits under the plans directory: a core plan carries no `type: plan`. */
async function inPlansDir(abs, projectDir) {
  const { plans } = await readAifPaths(projectDir);
  const rel = path.relative(plans, abs);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

async function load(file, projectDir) {
  let abs = resolveInside(projectDir, file);
  if (existsSync(abs) && statSync(abs).isDirectory()) abs = path.join(abs, 'index.md'); // an ultra bundle
  if (!existsSync(abs)) {
    throw fail('File not found.', { expected: 'an ADR or a plan file', detected: `${file} is missing`, next: 'check the path' });
  }
  const { data, body } = await read(abs);
  const kind = data.type ?? ((await inPlansDir(abs, projectDir)) ? 'plan' : null);
  if (kind !== 'adr' && kind !== 'plan') {
    throw fail('Only an ADR or a plan takes a claim.', {
      expected: 'type: adr or type: plan',
      detected: `type: ${JSON.stringify(data.type)}`,
      next: 'pass the ADR file or its plan',
    });
  }
  return { abs, data, body, kind, id: data.id ?? planStem(abs) };
}

/** Write the claim. Commits nothing: the caller commits the file on the base before it switches. */
export async function claim(file, { base, projectDir = process.cwd() } = {}) {
  const { abs, data, body, kind, id } = await load(file, projectDir);
  if (!String(base ?? '').trim()) {
    throw fail('A claim needs its base.', { expected: '--base <branch>', detected: 'no base', next: 'pass the branch the ADR merges into' });
  }
  if (kind === 'adr' && data.status !== 'accepted') {
    throw fail('Only an accepted ADR is claimed.', {
      expected: 'status=accepted',
      detected: `status=${data.status}`,
      next: 'accept the ADR and write its plan first',
    });
  }
  if (kind === 'plan' && !planInProgress(data)) {
    throw fail('Only a plan in progress is claimed.', {
      expected: 'a plan that is not done or archived',
      detected: `status=${data.status}`,
      next: 'claim a plan that is not archived',
    });
  }
  if (git(projectDir, 'rev-parse', '--is-inside-work-tree').stdout === 'true' && currentBranch(projectDir) !== base.trim()) {
    throw fail('A claim is written on its base.', {
      expected: `the checkout of ${base.trim()}`,
      detected: `current branch ${currentBranch(projectDir) ?? '(none)'}`,
      next: `switch to ${base.trim()}, or pass the current branch as --base`,
    });
  }
  const existing = readClaim(data);
  if (existing) {
    throw fail('Already claimed.', {
      expected: 'no `branch:` in the frontmatter',
      detected: `branch: ${existing.branch} (base ${existing.base ?? '?'}, started ${existing.started ?? '?'})`,
      next: `resume on ${existing.branch}, or release it with \`ai-factory adr unclaim ${file}\``,
    });
  }
  const branch = await claimBranch(abs, data, projectDir, kind);
  const claimed = { ...data, branch, base: base.trim(), started: todayUTC() };
  await atomicWrite(abs, serialize(claimed, body));
  return { id, file: abs, kind, branch, base: claimed.base, started: claimed.started };
}

/** Remove the claim and write the file, without committing. Returns { released, claim }. */
export async function release(file, { projectDir = process.cwd() } = {}) {
  const { abs, data, body, id } = await load(file, projectDir);
  const existing = readClaim(data);
  const present = CLAIM_KEYS.filter((key) => data[key] != null);
  for (const key of present) delete data[key];
  if (present.length) await atomicWrite(abs, serialize(data, body)); // a partial claim, too
  return { id, file: abs, released: present.length > 0, claim: existing };
}

/** Ok when the file has no claim, or the checked-out branch is the claim's branch. */
export async function checkClaim(file, { projectDir = process.cwd() } = {}) {
  const { abs, data, id } = await load(file, projectDir);
  const existing = readClaim(data);
  const current = currentBranch(projectDir);
  return { id, file: abs, claim: existing, current, ok: !existing || existing.branch === current };
}

/** Throw unless `checkClaim` passes: the CLI guard of §4.6 for commands that change a claimed file. */
export async function assertClaimBranch(file, { projectDir = process.cwd(), command } = {}) {
  if (!file) return;
  let abs = resolveInside(projectDir, file);
  if (!existsSync(abs)) return; // the command reports its own missing file
  // A bundle directory carries its claim on its index; a file without `branch:`, such as the fast
  // `.ai-factory/PLAN.md`, is in work nowhere.
  if (statSync(abs).isDirectory()) abs = path.join(abs, 'index.md');
  if (!existsSync(abs) || (await read(abs)).data.branch == null) return;
  const res = await checkClaim(abs, { projectDir });
  if (res.ok) return;
  throw fail(`${res.id} is in work on ${res.claim.branch}.`, {
    expected: `the checkout of ${res.claim.branch} for \`adr ${command}\``,
    detected: `current branch ${res.current ?? '(none)'}`,
    next: `switch to ${res.claim.branch}, or release the claim with \`ai-factory adr unclaim ${file}\``,
  });
}

/**
 * The guard for a command that also archives or rewrites the ADR's plan, such as `finalize` and
 * `supersede`: the plan can carry a claim of its own (§4.7) even when the ADR has none.
 */
export async function assertAdrAndPlanBranch(file, { projectDir = process.cwd(), command } = {}) {
  await assertClaimBranch(file, { projectDir, command });
  if (!file || !existsSync(resolveInside(projectDir, file))) return;
  const { data } = await read(resolveInside(projectDir, file));
  if (data.type !== 'adr' || data.id == null) return;
  let plan = null;
  try {
    plan = await resolveActivePlan(data.id, { projectDir });
  } catch {
    return; // more than 1 plan: the command reports it
  }
  if (plan) await assertClaimBranch(plan.file, { projectDir, command });
}

/**
 * The remote policy of §3.1: remote operations run only when git is enabled, pushes are not
 * skipped, and the base has an upstream. Returns { remote: string|null, reason }.
 */
export async function remotePolicy(projectDir, base) {
  const cfg = await readAifGit(projectDir);
  if (!cfg.enabled) return { remote: null, reason: 'git.enabled is false' };
  if (cfg.skipPush) return { remote: null, reason: 'git.skip_push_after_commit is true' };
  if (!upstreamOf(projectDir, base)) return { remote: null, reason: `${base} has no upstream` };
  // The upstream's own remote and branch: a local `master` may track `origin/main`.
  const remote = git(projectDir, 'config', `branch.${base}.remote`).stdout;
  const merge = git(projectDir, 'config', `branch.${base}.merge`).stdout;
  return { remote, refspec: `${base}:${merge || `refs/heads/${base}`}`, reason: null };
}

/**
 * Release a claim on its base, commit `chore(adr): release <id>` and push the base under §3.1.
 * With `deleteBranch`, also delete the claim's branch locally and on the remote.
 */
export async function unclaim(file, { projectDir = process.cwd(), deleteBranch = false } = {}) {
  const { abs, data, id, kind } = await load(file, projectDir);
  const existing = readClaim(data);
  if (!existing) {
    throw fail('No claim to release.', { expected: '`branch:` in the frontmatter', detected: 'none', next: 'nothing to do' });
  }
  const current = currentBranch(projectDir);
  const base = existing.base ?? current;
  if (current !== base) {
    throw fail('Unclaim runs on the base.', {
      expected: `the checkout of ${base}`,
      detected: `current branch ${current ?? '(none)'}`,
      next: `switch to ${base} and run it again`,
    });
  }
  const rel = path.relative(projectDir, abs);
  const edited = git(projectDir, 'status', '--porcelain', '--', rel).stdout;
  if (edited) {
    throw fail('The claimed file has uncommitted changes.', {
      expected: 'a committed file, so the release commit carries only the claim',
      detected: edited,
      next: 'commit or discard those changes first',
    });
  }
  const staged = git(projectDir, 'diff', '--cached', '--name-only');
  if (staged.stdout) {
    throw fail('The index holds staged changes.', {
      expected: 'an empty index, so the release commit carries only the claim',
      detected: staged.stdout.split('\n').join(', '),
      next: 'commit or unstage them first',
    });
  }

  await release(abs, { projectDir });
  const add = git(projectDir, 'add', '--', rel);
  const commit = add.status === 0 ? git(projectDir, 'commit', '-q', '-m', `chore(${kind === 'plan' ? 'plan' : 'adr'}): release ${id}`, '--', rel) : add;
  if (commit.status !== 0) {
    throw fail('The release commit failed.', {
      expected: 'git add and git commit to succeed',
      detected: commit.stderr || commit.stdout,
      files: `${rel} has the claim removed and is not committed`,
      next: 'commit it by hand',
    });
  }
  const sha = git(projectDir, 'rev-parse', '--short', 'HEAD').stdout;

  const policy = await remotePolicy(projectDir, base);
  const result = { id, file: abs, released: existing, commit: sha, pushed: false, local: policy.reason, deleted: { local: false, remote: false } };
  if (policy.remote) {
    const res = push(projectDir, policy.remote, policy.refspec);
    result.pushed = res.ok;
    if (!res.ok) result.pushError = { rejected: res.rejected, output: res.output };
  }

  // With the release unpushed, the remote base still shows the claim: deleting the branch now would
  // leave every other clone a claim whose work is gone.
  if (deleteBranch && result.pushError) result.deleteSkipped = 'the release push failed; the branch stays';
  else if (deleteBranch) {
    const where = branchExists(projectDir, existing.branch);
    if (where.local) result.deleted.local = git(projectDir, 'branch', '-D', existing.branch).status === 0;
    if (where.remote && policy.remote) result.deleted.remote = push(projectDir, policy.remote, '--delete', existing.branch).ok;
  }
  return result;
}

/** A claim whose branch exists neither locally nor under a remote-tracking ref (§4.3 `stale`). */
export function isStale(projectDir, claimed) {
  if (git(projectDir, 'rev-parse', '--is-inside-work-tree').stdout !== 'true') return false; // no git, no refs to judge by
  const where = branchExists(projectDir, claimed.branch);
  return !where.local && !where.remote;
}
