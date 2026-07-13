import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAudit } from '../src/audit.js';
import { mkProject } from './helpers.js';

test('runAudit invokes ai-factory via an argument array, never a shell string (§28)', async () => {
  const dir = await mkProject();
  let captured;
  const runner = (cmd, args, opts) => {
    captured = { cmd, args, opts };
    return Promise.resolve({ code: 0, stdout: '', stderr: '', spawnError: null });
  };

  const res = await runAudit({ projectDir: dir, strict: true, json: true, runner });

  assert.equal(captured.cmd, 'ai-factory');
  assert.ok(Array.isArray(captured.args));
  assert.deepEqual(captured.args, ['audit-artifacts', 'docs/adr', '.ai-factory', '--strict', '--json']);
  assert.equal(captured.opts.cwd, dir);
  assert.equal(res.code, 0);
});

test('runAudit passes a relocated ADR root explicitly (§22)', async () => {
  const dir = await mkProject();
  const { writeFile } = await import('node:fs/promises');
  await writeFile(`${dir}/.ai-factory/adr-extension.yaml`, 'version: 1\nadr:\n  root: docs/decisions\n', 'utf8');
  let args;
  await runAudit({ projectDir: dir, runner: (_c, a) => { args = a; return Promise.resolve({ code: 0 }); } });
  assert.equal(args[1], 'docs/decisions');
});
