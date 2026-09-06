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
