import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { transition } from '../src/lifecycle/move.js';
import { mkProject, writeAdr } from './helpers.js';

const git = (dir, ...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });

async function gitProject() {
  const dir = await mkProject();
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'test');
  return dir;
}

test('a transition stages the move so git reports a rename (§20)', async () => {
  const dir = await gitProject();
  const src = await writeAdr(dir, { id: 'adr-git', status: 'proposed' });
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');

  const res = await transition(src, 'draft', { projectDir: dir });

  const staged = git(dir, 'diff', '--cached', '-M', '--name-status').stdout;
  assert.match(staged, /^R\d*\t.*proposals\/adr-git\.md\t.*drafts\/adr-git\.md$/m, staged);
  assert.ok(existsSync(res.target));
});

test('a transition outside a git work tree still succeeds (staging is a silent no-op)', async () => {
  const dir = await mkProject();
  const src = await writeAdr(dir, { id: 'adr-nogit', status: 'proposed' });

  const res = await transition(src, 'draft', { projectDir: dir });

  assert.ok(!existsSync(src) && existsSync(res.target));
});
