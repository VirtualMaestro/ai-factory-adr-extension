import { execFile } from 'node:child_process';
import path from 'node:path';
import { adrRoot } from './config/paths.js';

/**
 * Default runner: invoke via an argument array (§28 — never a shell string, no interpolation).
 * Resolves to { code, stdout, stderr, spawnError } instead of rejecting, so callers branch on code.
 */
function defaultRunner(cmd, args, opts) {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, ...opts }, (err, stdout, stderr) => {
      if (err && typeof err.code !== 'number') {
        resolve({ code: null, stdout: stdout || '', stderr: stderr || '', spawnError: err });
      } else {
        resolve({ code: err?.code ?? 0, stdout: stdout || '', stderr: stderr || '', spawnError: null });
      }
    });
  });
}

/**
 * Run `ai-factory audit-artifacts <adr-root> .ai-factory [--strict] [--json]` (§22).
 * The ADR root is always passed explicitly so a relocated root outside default discovery is covered.
 * `runner` is injectable for unit tests. Returns the runner result.
 */
export async function runAudit({ projectDir = process.cwd(), strict = false, json = false, runner = defaultRunner } = {}) {
  const root = (path.relative(projectDir, await adrRoot(projectDir)) || '.').split(path.sep).join('/');
  const args = ['audit-artifacts', root, '.ai-factory'];
  if (strict) args.push('--strict');
  if (json) args.push('--json');
  return runner('ai-factory', args, { cwd: projectDir });
}
