import { spawnSync } from 'node:child_process';
import path from 'node:path';

/**
 * Stage a lifecycle relocation so git reports it as a rename rather than a delete plus an
 * untracked file: git derives the rename from content once both sides sit in the index
 * (§20). Silent no-op outside a work tree or when git is missing — the file operation has
 * already succeeded and must not be undone by a staging failure. Like `git mv`, this also
 * stages an unstaged edit the operator had in these files.
 */
export function stageMove(...files) {
  const paths = files.filter(Boolean);
  let staged = false;
  // One `git add` per path: a single unmatched pathspec (an untracked file that was removed)
  // aborts the whole batch, taking the paths that would have staged fine with it.
  for (const file of paths) {
    const res = spawnSync('git', ['add', '--', file], { cwd: path.dirname(file), stdio: 'ignore' });
    if (res.status === 0) staged = true;
  }
  return staged;
}

/** True when git ignores an untracked `file`: `stageMove` cannot stage it, so no commit carries it. */
export function gitIgnored(file) {
  return spawnSync('git', ['check-ignore', '-q', '--', file], { cwd: path.dirname(file), stdio: 'ignore' }).status === 0;
}

/** Run git in `cwd`; returns { status, stdout, stderr } with trimmed output. */
export function git(cwd, ...args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return { status: res.status ?? 1, stdout: (res.stdout ?? '').trim(), stderr: (res.stderr ?? '').trim() };
}

/** The checked-out branch, or null outside git, on a detached HEAD, or when git is missing. */
export function currentBranch(cwd) {
  const res = git(cwd, 'symbolic-ref', '--short', '-q', 'HEAD');
  return res.status === 0 && res.stdout ? res.stdout : null;
}

/** Where `name` exists: locally, and under any remote-tracking ref. Reads refs only, so it needs no network. */
export function branchExists(cwd, name) {
  const local = git(cwd, 'show-ref', '--verify', '--quiet', `refs/heads/${name}`).status === 0;
  const remote = git(cwd, 'for-each-ref', '--format=%(refname)', 'refs/remotes/')
    .stdout.split('\n').some((ref) => ref.replace(/^refs\/remotes\/[^/]+\//, '') === name && ref.startsWith('refs/remotes/'));
  return { local, remote };
}

/** The upstream of `branch`, such as `origin/master`, or null. */
export function upstreamOf(cwd, branch) {
  const res = git(cwd, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', `${branch}@{upstream}`);
  return res.status === 0 && res.stdout ? res.stdout : null;
}

/**
 * `git push --porcelain` with its rejection read: `[rejected]` means the remote moved and
 * `[remote rejected]` means a policy, such as a protected branch or a hook, refused it.
 * Returns { ok, rejected: null | 'moved' | 'policy' | 'other', output }.
 */
export function push(cwd, ...args) {
  const res = git(cwd, 'push', '--porcelain', ...args);
  const output = `${res.stdout}\n${res.stderr}`.trim();
  if (res.status === 0) return { ok: true, rejected: null, output };
  const rejected = /\[remote rejected\]/.test(output) ? 'policy' : /\[rejected\]/.test(output) ? 'moved' : 'other';
  return { ok: false, rejected, output };
}
