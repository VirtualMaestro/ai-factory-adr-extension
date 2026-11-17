import { spawn as nodeSpawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { git } from './util/git.js';
import { readConfig, resolveAutoConfig, RUNTIMES, SEVERITIES } from './config/adrConfig.js';
import { AifError } from './aif/detect.js';

/**
 * `ai-factory adr review begin | run | end` (proposal-auto-implement-orchestration §2.5): a read-only
 * review bracketed by 2 snapshots of HEAD, the index and the worktree. A Node command cannot start a
 * host subagent, so `begin` prepares the prompt and the snapshot, `run` drives a CLI reviewer, and
 * `end` checks the result and the snapshot. A review that fails `end` does not count.
 */

export const REVIEW_ROLES = ['reviewer_1', 'reviewer_2'];
export const RUBRICS = ['adr', 'plan'];

/** The result schema, also passed to `codex --output-schema` and `claude --json-schema`. */
export const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings', 'checked', 'verdict'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'file', 'line', 'claim', 'evidence', 'verified'],
        properties: {
          severity: { type: 'string', enum: SEVERITIES },
          file: { type: 'string' },
          line: { type: ['integer', 'null'] },
          claim: { type: 'string' },
          evidence: { type: 'string' },
          verified: { type: 'boolean' },
        },
      },
    },
    checked: { type: 'array', items: { type: 'string' } },
    verdict: { type: 'string' },
  },
};

const PACKAGE_ROOT = new URL('..', import.meta.url);
const skillFile = (name) => new URL(`skills/${name}/SKILL.md`, PACKAGE_ROOT);

const fail = (title, { expected, detected, next, files = 'nothing was changed' }) =>
  new AifError(`${title}\n  expected: ${expected}\n  detected: ${detected}\n  files:    ${files}\n  next:     ${next}`);

/** One top-level CNL-P block of a document, from its `name:` line to the next top-level key. */
export function topBlock(text, name) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l === `${name}:`);
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^[a-z_]+:/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n').trimEnd();
}

/** The rubric text of `--rubric`, read from this package's installed skills. */
export async function rubricText(name) {
  if (name === 'adr') {
    const rules = topBlock(await readFile(skillFile('adr-improve'), 'utf8'), 'quality_rules');
    return `Judge the ADR by these rules of adr-improve:\n\n${rules}`;
  }
  if (name === 'plan') {
    const skill = await readFile(skillFile('adr-plan-improve'), 'utf8');
    const tasks = topBlock(skill, 'task_rules');
    const rules = topBlock(skill, 'quality_rules');
    return (
      'Judge the plan by these rules. Also read the installed `aif-improve` skill of AI Factory and apply its checks.\n\n' +
      `${tasks ? `${tasks}\n\n` : ''}${rules}`
    );
  }
  throw fail('Unknown rubric.', { expected: RUBRICS.join(' or '), detected: String(name), next: 'pass --rubric adr or --rubric plan' });
}

const CONTRACT = `
## How to review

- You are a read-only reviewer. Change no file, stage nothing, commit nothing, start nothing that writes.
- Everything above that the writer says about its work is a claim to verify against the code, not a fact.
- Check each finding against the code before you report it. Set \`verified: false\` on a finding you could not check.
- List in \`checked\` what you checked, so a clean verdict says what it covers.
- Severity: critical (data loss, security, a broken build), high (wrong behaviour, a broken requirement or acceptance),
  medium (a gap a test or a rule should catch), low (clarity, naming, small cleanups).
- Answer with JSON only, matching the schema: { "findings": [...], "checked": [...], "verdict": "..." }.
`;

function gitDir(projectDir) {
  const res = git(projectDir, 'rev-parse', '--absolute-git-dir');
  if (res.status !== 0) {
    throw fail('A review needs a git work tree.', { expected: 'a git repository', detected: res.stderr || 'none', next: 'run inside the repository' });
  }
  return res.stdout;
}

/**
 * A hash of HEAD, the index and the worktree, untracked non-ignored files included. `git diff HEAD`
 * alone misses an index change whose worktree diff stays the same (§12 P1).
 */
export function snapshot(projectDir) {
  const hash = createHash('sha256');
  const add = (...args) => {
    const res = spawnSync('git', args, { cwd: projectDir, encoding: 'buffer', maxBuffer: 1 << 30 });
    hash.update(`\0${args.join(' ')}\0`);
    hash.update(res.stdout ?? Buffer.alloc(0));
    return res;
  };
  add('rev-parse', 'HEAD');
  add('symbolic-ref', '-q', 'HEAD'); // a switch to another branch at the same commit
  add('for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads', 'refs/tags');
  add('status', '--porcelain', '-uall');
  add('diff', 'HEAD', '--binary');
  add('diff', '--cached', '--binary');
  add('ls-files', '-s');
  // The content of every tracked and untracked file, hashed directly: git's change flags, such as
  // `assume-unchanged`, would otherwise hide a write from `status` and `diff`.
  const tracked = add('ls-files', '-z').stdout.toString('utf8').split('\0').filter(Boolean);
  const untracked = add('ls-files', '-o', '--exclude-standard', '-z').stdout.toString('utf8').split('\0').filter(Boolean);
  // Regular files only: a submodule directory makes `hash-object` fail before the files after it;
  // its commit is in `ls-files -s` above.
  const present = [...tracked, ...untracked].filter((f) => statSync(path.join(projectDir, f), { throwIfNoEntry: false })?.isFile());
  if (present.length) {
    const res = spawnSync('git', ['hash-object', '--no-filters', '--stdin-paths'], {
      cwd: projectDir,
      input: present.join('\n'),
      encoding: 'utf8',
      maxBuffer: 1 << 30,
    });
    if (res.status !== 0) {
      throw fail('The review snapshot could not hash the tree.', {
        expected: 'git hash-object to read every file',
        detected: (res.stderr || String(res.error ?? res.status)).trim(),
        next: 'fix the unreadable file, then begin the review again',
      });
    }
    hash.update(res.stdout ?? '');
  }
  return hash.digest('hex');
}

async function readMeta(projectDir, id) {
  if (!/^[a-z0-9_-]+$/i.test(String(id))) {
    throw fail('Unknown review id.', { expected: 'an id `adr review begin` printed', detected: String(id), next: 'run `adr review begin`' });
  }
  const dir = path.join(gitDir(projectDir), 'adr-auto', id);
  const file = path.join(dir, 'meta.json');
  if (!existsSync(file)) {
    throw fail('Unknown review id.', { expected: 'an id `adr review begin` printed', detected: `${id}: no ${file}`, next: 'run `adr review begin`' });
  }
  return { dir, file, meta: JSON.parse(await readFile(file, 'utf8')) };
}

/** Prepare a review: resolve the role, write prompt and schema under `.git/adr-auto/<id>/`, take the snapshot. */
export async function begin({ role, prompt, files = [], rubric = null, phase = 'implement', runtime = null, projectDir = process.cwd() }) {
  if (!REVIEW_ROLES.includes(role)) {
    throw fail('Unknown review role.', { expected: REVIEW_ROLES.join(' or '), detected: String(role), next: 'pass --role reviewer_1 or --role reviewer_2' });
  }
  if (!['implement', 'plan'].includes(phase)) {
    throw fail('Unknown phase.', { expected: 'implement or plan', detected: String(phase), next: 'pass --phase implement or --phase plan' });
  }
  if (runtime != null && !RUNTIMES.includes(runtime)) {
    throw fail('Unknown runtime.', { expected: RUNTIMES.join(', '), detected: String(runtime), next: 'pass a runtime the config accepts' });
  }
  if (!prompt || !existsSync(path.resolve(projectDir, prompt))) {
    throw fail('The review prompt is missing.', { expected: '--prompt <file>', detected: String(prompt), next: 'write the prompt to a file outside the tree and pass it' });
  }
  for (const f of files) {
    if (!existsSync(path.resolve(projectDir, f))) {
      throw fail('A file under review is missing.', { expected: 'existing files', detected: f, next: 'check the path' });
    }
  }
  const cfg = resolveAutoConfig((await readConfig(projectDir)) ?? {});
  if (cfg.errors.length) {
    throw fail('The adr.auto config has errors.', { expected: 'a clean `ai-factory adr auto config --check`', detected: cfg.errors.join('; '), next: 'fix .ai-factory/adr-extension.yaml' });
  }
  const resolved = { ...cfg.roles[phase][role] };
  if (runtime) {
    resolved.runtime = runtime;
    if (runtime !== 'subagent') resolved.timeout ??= 1800;
  }

  const id = `${role}-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  const dir = path.join(gitDir(projectDir), 'adr-auto', id);
  await mkdir(dir, { recursive: true });

  let text = await readFile(path.resolve(projectDir, prompt), 'utf8');
  if (files.length) text += `\n\n## Files under review\n\n${files.map((f) => `- ${f.replace(/\\/g, '/')}`).join('\n')}\n`;
  if (rubric) text += `\n\n## Rubric\n\n${await rubricText(rubric)}\n`;
  text += CONTRACT;

  const paths = {
    dir,
    prompt: path.join(dir, 'prompt.md'),
    schema: path.join(dir, 'schema.json'),
    result: path.join(dir, 'result.json'),
  };
  await writeFile(paths.prompt, text, 'utf8');
  await writeFile(paths.schema, JSON.stringify(RESULT_SCHEMA, null, 2), 'utf8');
  const meta = { id, role, phase, rubric, files, ...resolved, created: new Date().toISOString(), before: snapshot(projectDir), run: null };
  await writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
  return { id, role, phase, runtime: resolved.runtime, model: resolved.model, effort: resolved.effort, timeout: resolved.timeout ?? null, fallback: resolved.fallback, ...paths };
}

/** The argv of a CLI reviewer. The prompt goes to stdin, so no argument carries user text. */
export function cliCommand(meta, paths) {
  if (meta.runtime === 'codex-cli') {
    const args = ['exec', '-s', 'read-only', '--skip-git-repo-check', '--output-schema', paths.schema, '-o', paths.result];
    if (meta.model) args.push('-m', meta.model);
    if (meta.effort) args.push('-c', `model_reasoning_effort=${meta.effort}`);
    args.push('-');
    return { bin: 'codex', args };
  }
  if (meta.runtime === 'claude-cli') {
    const args = ['-p', '--permission-mode', 'plan', '--output-format', 'json', '--no-session-persistence', '--json-schema', JSON.stringify(RESULT_SCHEMA)];
    if (meta.model) args.push('--model', meta.model);
    if (meta.effort) args.push('--effort', meta.effort);
    return { bin: 'claude', args };
  }
  return null;
}

/**
 * The executable to start for `bin`, without a shell. On Windows an npm shim (`codex.cmd`) runs
 * `node <script>`, so the script is started with this Node instead: a shell would split an argument
 * holding `&` or `^`, and a timeout would kill the shell and not the CLI under it.
 */
export function resolveBin(bin, { platform = process.platform, where = (b) => spawnSync('where', [b], { encoding: 'utf8' }).stdout ?? '' } = {}) {
  if (platform !== 'win32') return { file: bin, prefix: [] };
  const found = where(bin).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const exe = found.find((f) => /\.exe$/i.test(f));
  if (exe) return { file: exe, prefix: [] };
  const cmd = found.find((f) => /\.cmd$/i.test(f));
  if (cmd) {
    const text = spawnSync(process.execPath, ['-e', 'process.stdout.write(require("fs").readFileSync(process.argv[1],"utf8"))', cmd], { encoding: 'utf8' }).stdout ?? '';
    const script = text.match(/"%dp0%\\([^"]+\.(?:js|cjs|mjs))"/i);
    if (script) return { file: process.execPath, prefix: [path.join(path.dirname(cmd), script[1])] };
  }
  return null;
}

/** Start `file` with `args`, feed `input`, and kill the whole process tree after `timeout` ms. */
export function execTree(file, args, { cwd, input, timeout }) {
  return new Promise((resolve) => {
    const child = nodeSpawn(file, args, { cwd, windowsHide: true, detached: process.platform !== 'win32' });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      }
    }, timeout);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ status: null, stdout, stderr, timedOut, error });
    });
    child.on('close', (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr, timedOut, error: null });
    });
    child.stdin.on('error', () => {}); // a CLI that exits before reading its prompt
    child.stdin.end(input);
  });
}

/** Run a CLI reviewer with the role's timeout and write its result. Not for `subagent`. */
export async function run(id, { projectDir = process.cwd(), exec = execTree, resolve = resolveBin } = {}) {
  const { dir, file, meta } = await readMeta(projectDir, id);
  const paths = { schema: path.join(dir, 'schema.json'), result: path.join(dir, 'result.json') };
  const cmd = cliCommand(meta, paths);
  if (!cmd) {
    throw fail('A subagent review has no `run`.', {
      expected: 'runtime codex-cli or claude-cli',
      detected: `runtime ${meta.runtime}`,
      next: `start the subagent with ${path.join(dir, 'prompt.md')}, write its answer to a file, then \`adr review end ${id} --result <file>\``,
    });
  }
  // A result of an earlier run would otherwise pass `end` for this one.
  await rm(paths.result, { force: true });
  await rm(path.join(dir, 'stdout.txt'), { force: true });
  const prompt = await readFile(path.join(dir, 'prompt.md'), 'utf8');
  const started = Date.now();
  const target = resolve(cmd.bin);
  const res = target
    ? await exec(target.file, [...target.prefix, ...cmd.args], { cwd: projectDir, input: prompt, timeout: (meta.timeout ?? 1800) * 1000 })
    : { status: null, stdout: '', stderr: '', timedOut: false, error: new Error(`${cmd.bin} not found on PATH`) };
  const timedOut = Boolean(res.timedOut);
  if (meta.runtime === 'claude-cli' && res.stdout && !timedOut) {
    try {
      const outer = JSON.parse(res.stdout);
      const result = outer.structured_output ?? JSON.parse(outer.result);
      await writeFile(paths.result, JSON.stringify(result, null, 2), 'utf8');
    } catch {
      await writeFile(path.join(dir, 'stdout.txt'), res.stdout, 'utf8');
    }
  }
  meta.run = {
    bin: cmd.bin,
    exit: res.status,
    timedOut,
    error: res.error && !timedOut ? res.error.message : null,
    seconds: Math.round((Date.now() - started) / 1000),
    stderr: String(res.stderr ?? '').slice(-2000),
  };
  await writeFile(file, JSON.stringify(meta, null, 2), 'utf8');
  return { id, runtime: meta.runtime, ...meta.run, result: existsSync(paths.result) ? paths.result : null };
}

/** Problems of a parsed result against RESULT_SCHEMA; [] when it conforms. */
export function resultProblems(r) {
  const p = [];
  if (r == null || typeof r !== 'object' || Array.isArray(r)) return ['the result is not a JSON object'];
  const extra = (obj, schema) => Object.keys(obj).filter((k) => !Object.hasOwn(schema.properties, k));
  for (const k of extra(r, RESULT_SCHEMA)) p.push(`unexpected key \`${k}\``);
  if (!Array.isArray(r.findings)) p.push('`findings` is not a list');
  if (!Array.isArray(r.checked) || r.checked.some((c) => typeof c !== 'string')) p.push('`checked` is not a list of strings');
  if (typeof r.verdict !== 'string' || !r.verdict.trim()) p.push('`verdict` is empty');
  (Array.isArray(r.findings) ? r.findings : []).forEach((f, i) => {
    if (f == null || typeof f !== 'object') return p.push(`finding ${i + 1}: not an object`);
    if (!SEVERITIES.includes(f.severity)) p.push(`finding ${i + 1}: severity ${JSON.stringify(f.severity)} is not one of ${SEVERITIES.join(', ')}`);
    for (const k of extra(f, RESULT_SCHEMA.properties.findings.items)) p.push(`finding ${i + 1}: unexpected key \`${k}\``);
    if (typeof f.file !== 'string') p.push(`finding ${i + 1}: \`file\` is not a string`);
    for (const k of ['claim', 'evidence']) if (typeof f[k] !== 'string' || !f[k].trim()) p.push(`finding ${i + 1}: \`${k}\` is empty`);
    if (!(f.line === null || Number.isInteger(f.line))) p.push(`finding ${i + 1}: \`line\` is not an integer or null`);
    if (typeof f.verified !== 'boolean') p.push(`finding ${i + 1}: \`verified\` is not true or false`);
  });
  return p;
}

/** Strip a Markdown code fence a subagent may wrap its JSON in. */
const unfence = (text) => text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, '$1');

/**
 * Close a review: take the snapshot again and check the run and the result. Returns
 * { ok, reasons, findings, checked, verdict, ... }; a review with reasons does not count.
 */
export async function end(id, { result = null, projectDir = process.cwd() } = {}) {
  const { dir, meta } = await readMeta(projectDir, id);
  const reasons = [];
  const after = snapshot(projectDir);
  if (after !== meta.before) reasons.push('the tree changed during the review (HEAD, index, worktree or untracked files): a reviewer wrote');

  if (meta.runtime !== 'subagent') {
    if (!meta.run) reasons.push('`adr review run` did not run');
    else if (meta.run.timedOut) reasons.push(`the reviewer timed out after ${meta.timeout}s`);
    else if (meta.run.error) reasons.push(`the reviewer did not start: ${meta.run.error}`);
    else if (meta.run.exit !== 0) reasons.push(`the reviewer exited ${meta.run.exit}: ${meta.run.stderr.split('\n').slice(-3).join(' ')}`);
  }

  const file = result ? path.resolve(projectDir, result) : path.join(dir, 'result.json');
  let parsed = null;
  if (!existsSync(file)) reasons.push(`no result at ${file}`);
  else {
    const text = await readFile(file, 'utf8');
    if (!text.trim()) reasons.push('the result is empty');
    else {
      try {
        parsed = JSON.parse(unfence(text));
        for (const p of resultProblems(parsed)) reasons.push(`schema: ${p}`);
      } catch (err) {
        reasons.push(`the result is not JSON: ${err.message}`);
      }
    }
  }
  const ok = reasons.length === 0;
  return {
    id,
    role: meta.role,
    runtime: meta.runtime,
    model: meta.model ?? null,
    ok,
    reasons,
    snapshot: { before: meta.before, after },
    findings: ok ? parsed.findings : [],
    checked: ok ? parsed.checked : [],
    verdict: ok ? parsed.verdict : null,
  };
}
