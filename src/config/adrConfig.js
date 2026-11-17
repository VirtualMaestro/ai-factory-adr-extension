import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export const CONFIG_VERSION = 1;

export const DEFAULT_CONFIG = {
  version: CONFIG_VERSION,
  adr: {
    root: 'docs/adr',
    lifecycle: {
      requireAlternatives: true,
      requireNegativeConsequences: true,
      allowDocumentationOnly: true,
    },
    memory: { provider: 'none' },
    codeIntelligence: { provider: 'none' },
  },
};

export function configPath(projectDir = process.cwd()) {
  return path.join(projectDir, '.ai-factory', 'adr-extension.yaml');
}

/**
 * Create the extension config with defaults iff absent (§26 — never overwrites an existing file).
 * Returns { created: boolean, path }.
 */
export async function ensureConfig(projectDir = process.cwd()) {
  const file = configPath(projectDir);
  if (existsSync(file)) return { created: false, path: file };
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, YAML.stringify(DEFAULT_CONFIG), 'utf8');
  return { created: true, path: file };
}

export async function readConfig(projectDir = process.cwd()) {
  const file = configPath(projectDir);
  if (!existsSync(file)) return null;
  return YAML.parse(await readFile(file, 'utf8'));
}

export const RUNTIMES = ['subagent', 'codex-cli', 'claude-cli'];
export const SEVERITIES = ['critical', 'high', 'medium', 'low'];
export const ROLES = ['coder', 'author', 'reviewer_1', 'reviewer_2'];

/** Defaults of `adr.auto` (proposal-auto-implement-orchestration §6). */
export const AUTO_DEFAULTS = {
  roles: {
    coder: { runtime: 'subagent' },
    reviewer_1: { runtime: 'subagent' },
    reviewer_2: { runtime: 'subagent' },
  },
  escalate_at: 'high',
  max_rounds: 3,
  checks: { task: [], full: [] },
  branch: { prefix: 'adr/', delete_after_merge: true },
  release: { command: null },
  plan: { roles: {} },
};
const DEFAULT_TIMEOUT = 1800;

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

/** A runtime that cannot run degrades along this chain; the run reports each step it takes. */
export function fallbackChain(runtime) {
  return runtime === 'subagent' ? ['subagent', 'inline'] : [runtime, 'subagent', 'inline'];
}

function checkRole(where, role, errors) {
  if (!isObj(role)) return errors.push(`${where}: expected a mapping such as { runtime: subagent }`);
  for (const key of Object.keys(role)) {
    if (!['runtime', 'model', 'effort', 'timeout'].includes(key)) errors.push(`${where}.${key}: unknown key`);
  }
  if (role.runtime !== undefined && !RUNTIMES.includes(role.runtime)) {
    errors.push(`${where}.runtime: expected one of ${RUNTIMES.join(', ')}, got ${JSON.stringify(role.runtime)}`);
  }
  for (const key of ['model', 'effort']) {
    if (role[key] != null && !isStr(role[key])) errors.push(`${where}.${key}: expected a non-empty string`);
  }
  if (role.timeout != null && !isInt(role.timeout, 1, 86400)) errors.push(`${where}.timeout: expected seconds, 1 to 86400`);
}

function checkCommands(where, list, errors) {
  if (!Array.isArray(list) || list.some((c) => !isStr(c))) errors.push(`${where}: expected a list of commands`);
}

/** Resolve one role: an explicit entry wins; `author` falls back to `coder`; plan overrides win in planning. */
function resolveRole(name, roles, planRoles) {
  const base = roles[name] ?? (name === 'author' ? roles.coder : undefined) ?? AUTO_DEFAULTS.roles[name] ?? { runtime: 'subagent' };
  const merged = { ...base, ...(planRoles?.[name] ?? {}) };
  const runtime = merged.runtime ?? 'subagent';
  const role = { runtime, model: merged.model ?? null, effort: merged.effort ?? null, fallback: fallbackChain(runtime) };
  if (runtime !== 'subagent') role.timeout = merged.timeout ?? DEFAULT_TIMEOUT;
  return role;
}

/**
 * `adr.auto` and `adr.acceptance` with defaults, checked. Pure: the caller reads the file.
 * Returns { auto, acceptance, roles: { implement, plan }, errors }.
 */
export function resolveAutoConfig(cfg) {
  const errors = [];
  const adr = isObj(cfg?.adr) ? cfg.adr : {};
  const raw = adr.auto ?? {};
  if (!isObj(raw)) errors.push('adr.auto: expected a mapping');
  const src = isObj(raw) ? raw : {};
  for (const key of Object.keys(src)) {
    if (!Object.hasOwn(AUTO_DEFAULTS, key)) errors.push(`adr.auto.${key}: unknown key`);
  }

  const roles = isObj(src.roles) ? src.roles : {};
  if (src.roles != null && !isObj(src.roles)) errors.push('adr.auto.roles: expected a mapping');
  const planRoles = isObj(src.plan?.roles) ? src.plan.roles : {};
  if (src.plan != null && !isObj(src.plan)) errors.push('adr.auto.plan: expected a mapping');
  if (src.plan?.roles != null && !isObj(src.plan.roles)) errors.push('adr.auto.plan.roles: expected a mapping');
  for (const [where, map] of [['adr.auto.roles', roles], ['adr.auto.plan.roles', planRoles]]) {
    for (const [name, role] of Object.entries(map)) {
      if (!ROLES.includes(name)) errors.push(`${where}.${name}: unknown role; expected one of ${ROLES.join(', ')}`);
      else checkRole(`${where}.${name}`, role, errors);
    }
  }

  const auto = {
    escalate_at: src.escalate_at ?? AUTO_DEFAULTS.escalate_at,
    max_rounds: src.max_rounds ?? AUTO_DEFAULTS.max_rounds,
    checks: { ...AUTO_DEFAULTS.checks, ...(isObj(src.checks) ? src.checks : {}) },
    branch: { ...AUTO_DEFAULTS.branch, ...(isObj(src.branch) ? src.branch : {}) },
    release: { ...AUTO_DEFAULTS.release, ...(isObj(src.release) ? src.release : {}) },
  };
  for (const key of ['checks', 'branch', 'release']) {
    if (src[key] != null && !isObj(src[key])) errors.push(`adr.auto.${key}: expected a mapping`);
  }
  if (!SEVERITIES.includes(auto.escalate_at)) errors.push(`adr.auto.escalate_at: expected one of ${SEVERITIES.join(', ')}`);
  if (!isInt(auto.max_rounds, 1, 10)) errors.push('adr.auto.max_rounds: expected an integer, 1 to 10');
  checkCommands('adr.auto.checks.task', auto.checks.task, errors);
  checkCommands('adr.auto.checks.full', auto.checks.full, errors);
  // A ref component git accepts: no space, `..`, `~^:?*[\`, and no leading `-` or `/`.
  if (!isStr(auto.branch.prefix) || /[\s~^:?*[\\]|\.\.|^[-/]|@\{/.test(auto.branch.prefix)) {
    errors.push('adr.auto.branch.prefix: expected a git ref prefix such as "adr/"');
  }
  if (typeof auto.branch.delete_after_merge !== 'boolean') errors.push('adr.auto.branch.delete_after_merge: expected true or false');
  if (auto.release.command != null && !isStr(auto.release.command)) errors.push('adr.auto.release.command: expected a command or null');

  const acc = adr.acceptance ?? {};
  const acceptance = { command: null, exploratory: null };
  if (!isObj(acc)) errors.push('adr.acceptance: expected a mapping');
  else {
    if (acc.command != null && !isStr(acc.command)) errors.push('adr.acceptance.command: expected a command or null');
    acceptance.command = acc.command ?? null;
    if (acc.exploratory != null) {
      const ex = acc.exploratory;
      if (!isObj(ex) || !isStr(ex.instructions)) errors.push('adr.acceptance.exploratory.instructions: expected a file path');
      else {
        if (ex.rounds != null && !isInt(ex.rounds, 1, 10)) errors.push('adr.acceptance.exploratory.rounds: expected an integer, 1 to 10');
        acceptance.exploratory = { instructions: ex.instructions, rounds: ex.rounds ?? 1 };
      }
    }
  }

  const resolved = {
    implement: Object.fromEntries(['coder', 'reviewer_1', 'reviewer_2'].map((n) => [n, resolveRole(n, roles)])),
    plan: Object.fromEntries(['author', 'reviewer_1', 'reviewer_2'].map((n) => [n, resolveRole(n, roles, planRoles)])),
  };
  return { auto, acceptance, roles: resolved, errors };
}
