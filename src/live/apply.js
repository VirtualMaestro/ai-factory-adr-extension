import { existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { adrRoot, liveFile, readAifPaths } from '../config/paths.js';
import { indexAdrsById } from '../status.js';
import { resolveInside, atomicWrite, withFileRollback } from '../util/safe-path.js';
import { stageMove, gitIgnored } from '../util/git.js';
import { todayUTC } from '../lifecycle/archive.js';
import { readDelta, markApplied, splitRefs } from './delta.js';
import { linkedAdrs, planRef } from './plans.js';
import { checkLive } from './check.js';
import { parseLive, renderLive, liveIssues, applyDelta, SENTINEL } from './state.js';

/** The house error shape (§27): what was expected, what was found, what to do. Every refusal changes nothing. */
export function liveError(title, { expected, detected, next }) {
  const list = (v) => (Array.isArray(v) ? v.join('\n            ') : v);
  return new Error(`${title}\n  expected: ${expected}\n  detected: ${list(detected)}\n  files:    nothing was changed\n  next:     ${next}`);
}

/** Every project keeps LIVE.md (5.0): a command that needs it refuses without it. `where` is { projectDir, livePath }. */
export function liveMissing(where) {
  return liveError('LIVE.md not found.', {
    expected: `${rel(where, where.livePath)}: every project keeps LIVE.md`,
    detected: 'it is missing',
    next: 'run adr-live-seed when the project has an active ADR; otherwise run `ai-factory adr live init`',
  });
}

/** The content of a new LIVE.md: no capability recorded yet. */
export const liveTemplate = (since) => `---\ntype: live\ntitle: Live state\nsince: ${since}\n---\n\ncapabilities:\n${SENTINEL}\n`;

/**
 * Run `action` holding `LIVE.md.lock`. 2 writers that read the same LIVE.md would otherwise both
 * succeed: the later write, or the rollback of a failed one, drops the other's records while its
 * source already reads as applied. A second writer fails at once instead of waiting.
 */
export async function withLiveLock(ctx, action) {
  const lock = `${ctx.livePath}.lock`;
  let handle;
  try {
    handle = await open(lock, 'wx');
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    throw liveError('Another command is writing LIVE.md.', {
      expected: `no ${rel(ctx, lock)}`,
      detected: `${rel(ctx, lock)} exists`,
      next: `run the command again; delete ${rel(ctx, lock)} only when no \`ai-factory adr\` command is running`,
    });
  }
  try {
    return await action();
  } finally {
    await handle.close();
    await unlink(lock).catch(() => {});
  }
}

/** A warning per written file that git ignores: `stageMove` skips it, and no commit carries it. */
export function ignoredWarnings(ctx, files) {
  return files.filter((f) => f && gitIgnored(f)).map((f) => `${rel(ctx, f)} is ignored by git: it is written but not staged, so no commit carries it`);
}

/** Everything an apply or a check reads once: where `LIVE.md` is, whether it exists, the ADR index, the plan dirs. */
export async function liveContext(projectDir = process.cwd()) {
  const livePath = await liveFile(projectDir);
  const { plans, archivePlans, plan } = await readAifPaths(projectDir);
  return {
    projectDir,
    livePath,
    exists: existsSync(livePath),
    adrs: await indexAdrsById(await adrRoot(projectDir)),
    plansDir: plans,
    archivePlansDir: archivePlans,
    fastPlan: plan,
  };
}

/**
 * Why a delta cannot pass the gate, or null: absent and malformed are both a refusal once
 * every project keeps `LIVE.md`. `unapplied` also refuses an `applied:` before finalize, which would refuse it.
 */
export function gateProblem(delta, problems, { unapplied = false } = {}) {
  if (problems.length) return `malformed \`live:\`: ${problems.join('; ')}`;
  if (delta == null) return 'no `live:` delta';
  return unapplied && delta.applied != null ? '`applied:` is written by finalize: remove it' : null;
}

/** The gate's refusal (§3.6), shared by `transition … accepted` and `finalize`. */
export function gateError(label, problem) {
  return liveError('The ADR has no usable `live:` delta.', {
    expected: '`live:` with `changes:` or `none:` in frontmatter',
    detected: `${label}: ${problem}`,
    next: 'write live: with changes: or none:, see adr-improve',
  });
}

/**
 * The new `LIVE.md` for one delta, checked against `profiles/live.md` before anything is
 * written. Throws in the house shape on a refusal or a profile issue; returns
 * { before, after, changed, ops, warnings, contradicts } otherwise. Writes nothing.
 */
export async function computeLive(ctx, { changes, kind, ref, supersedes = [], label }) {
  const before = await readFile(ctx.livePath, 'utf8');
  let state;
  try {
    state = parseLive(before);
  } catch (err) {
    throw liveError('LIVE.md cannot be read.', {
      expected: 'a `capabilities:` block of records, as `ai-factory adr format live` declares',
      detected: err.message,
      next: 'fix LIVE.md by hand, then run `ai-factory adr live check`',
    });
  }
  const res = applyDelta(state.entries, changes, { kind, ref, supersedes, adrs: ctx.adrs });
  if (res.refusals.length) {
    throw liveError(`The delta of ${label} cannot be applied to LIVE.md.`, {
      expected: '`added` for a new id, `modified` or `removed` for an existing one',
      detected: res.refusals,
      next: `correct the delta in ${label}, then run again`,
    });
  }
  // No op, no render: a render would reorder a hand-edited file and stage it for nothing.
  if (!res.ops.length) return { before, after: before, changed: false, ops: [], warnings: res.warnings, contradicts: [] };
  const after = renderLive({ ...state, entries: res.entries });
  const issues = await liveIssues(after);
  const lines = (list) => list.map((i) => `LIVE.md line ${i.line}: ${i.message}${i.text ? ` — ${JSON.stringify(i.text)}` : ''}`);
  // A hand edit that already fails the profile is not the delta's fault: name the file instead.
  const prior = issues.length ? await liveIssues(before) : [];
  if (prior.length) {
    throw liveError('LIVE.md fails its profile before the delta is applied.', {
      expected: 'every record passes `ai-factory adr format live` and the lexicon of `ai-factory adr format`',
      detected: lines(prior),
      next: `fix LIVE.md by hand until \`ai-factory adr live check\` reports no live-format issue, then apply ${label} again`,
    });
  }
  if (issues.length) {
    throw liveError(`The delta of ${label} would make LIVE.md fail its profile.`, {
      expected: 'every record passes `ai-factory adr format live` and the lexicon of `ai-factory adr format`',
      detected: lines(issues),
      next: `rewrite the summary in ${label} as the message says, then run again`,
    });
  }
  return { before, after, changed: after !== before, ops: res.ops, warnings: res.warnings, contradicts: res.contradicts };
}

const rel = (ctx, file) => path.relative(ctx.projectDir, file).split(path.sep).join('/');
// `adr live check` finds active ADRs by the index, so apply reads the same files as ADRs.
const indexedAdr = (ctx, file) => [...ctx.adrs.values()].some((a) => path.resolve(a.file) === path.resolve(file));

/**
 * `adr live apply <file>`: apply an ADR or plan entrypoint (a directory resolves to index.md).
 * An ADR applies standalone only when it is
 * active and its delta has no `applied:` — finalize applies it otherwise; `dryRun` takes an ADR of
 * any status and writes nothing. Returns what happened; `skipped` says why nothing could.
 */
export async function applySource(file, { projectDir = process.cwd(), dryRun = false } = {}) {
  const ctx = await liveContext(projectDir);
  let abs = resolveInside(projectDir, file);
  if (existsSync(abs) && statSync(abs).isDirectory()) abs = resolveInside(projectDir, path.join(abs, 'index.md'));
  const base = { source: rel(ctx, abs), live: rel(ctx, ctx.livePath), dryRun };
  if (!existsSync(abs)) {
    throw liveError('Source not found.', { expected: 'an existing ADR or plan entrypoint', detected: `${file} is missing`, next: 'check the path' });
  }
  // Still a skip, not a refusal: the aif-implement injection runs this in a project not yet seeded,
  // and `adr status --check` is what reports the missing file.
  if (!ctx.exists) return { ...base, skipped: 'no LIVE.md' };

  const doc = await readDelta(abs, { adr: indexedAdr(ctx, abs) });
  const isAdr = doc.carrier === 'adr';
  const linked = linkedAdrs(doc);
  if (!isAdr && linked.length) return { ...base, skipped: `linked to ${linked.join(', ')}` };
  const label = String(doc.data.id ?? base.source);
  const problem = gateProblem(doc.delta, doc.problems);
  if (problem) {
    if (isAdr) throw gateError(label, problem);
    throw liveError('The plan has no usable `adr-live` delta.', {
      expected: '1 `adr-live` fence with `changes:` or `none:`',
      detected: doc.problems.length ? doc.problems : `${base.source}: no fence`,
      next: `write or correct the fence in ${base.source}, then run again`,
    });
  }
  if (doc.delta.applied != null) {
    throw liveError(`${label} is already applied on ${doc.delta.applied}.`, {
      expected: 'a delta without `applied:`',
      detected: `live.applied: ${doc.delta.applied}`,
      next: 'nothing to do; a new change to the capability is a new ADR or plan',
    });
  }
  if (isAdr && !dryRun && doc.data.status !== 'active') {
    throw liveError(`${label} is not active.`, {
      expected: 'an active ADR: `adr finalize` applies the delta of an accepted one',
      detected: `status=${doc.data.status}`,
      next: 'run `ai-factory adr finalize`, or pass --dry-run to preview',
    });
  }

  const changes = doc.delta.changes ?? [];
  const ref = isAdr ? doc.data.id : planRef(abs, ctx);
  if (!isAdr && ref == null && changes.some((c) => !splitRefs(c.refs).length)) {
    throw liveError('A fast plan needs durable refs on every change.', {
      expected: '`refs:` on every record, including modified and removed',
      detected: base.source,
      next: 'name repository files or ADRs in refs:, then run again',
    });
  }
  const supersedes = isAdr ? [].concat(doc.data.supersedes ?? []).map(String) : [];
  const apply = async () => {
    const res = await computeLive(ctx, { changes, kind: doc.carrier, ref, supersedes, label });
    const out = { ...base, id: label, ops: res.ops, warnings: res.warnings, changed: res.changed };
    if (!changes.length && !res.changed) return { ...out, skipped: 'nothing changed' };
    if (dryRun) return out;

    const date = todayUTC();
    const written = [changes.length ? abs : null, res.changed ? ctx.livePath : null];
    await withFileRollback([abs, ctx.livePath], async () => {
      if (changes.length) await atomicWrite(abs, markApplied(doc, { date, contradicts: [...new Set([...splitRefs(doc.delta.contradicts), ...res.contradicts])] }));
      if (res.changed) await atomicWrite(ctx.livePath, res.after);
      stageMove(...written);
    });
    return { ...out, warnings: [...out.warnings, ...ignoredWarnings(ctx, written)], applied: changes.length ? date : null };
  };
  return dryRun ? apply() : withLiveLock(ctx, apply);
}

/** Apply the checker's pending sources in completion order; failures leave successes intact. */
export async function applyPending({ projectDir = process.cwd() } = {}) {
  const report = await checkLive({ projectDir });
  if (!report.exists) return { skipped: 'no LIVE.md', results: [], failures: [] };
  const ctx = await liveContext(projectDir);
  const sources = [];
  const additions = new Map();
  const rank = { removed: 0, added: 1, modified: 2 };
  const results = [], failures = [];
  for (const issue of report.issues.filter((i) => i.code === 'unapplied-delta')) {
    try {
      const file = resolveInside(projectDir, issue.source);
      const doc = await readDelta(file, { adr: indexedAdr(ctx, file) });
      if (!doc.delta?.changes) throw new Error(doc.problems.join('; ') || 'the source no longer carries `changes:`');
      const log = spawnSync('git', ['log', '-1', '--format=%cI', '--', file], { cwd: projectDir, encoding: 'utf8' });
      const date = Date.parse(log.status === 0 ? log.stdout.trim() : '');
      sources.push({ file, source: issue.source, date: Number.isFinite(date) ? date : statSync(file).mtimeMs,
        rank: Math.min(...doc.delta.changes.map((c) => rank[c.change])) });
      for (const c of doc.delta.changes.filter((c) => c.change === 'added')) {
        additions.set(c.capability, [...(additions.get(c.capability) ?? []), issue.source]);
      }
    } catch (err) {
      failures.push({ source: issue.source, error: err.message });
    }
  }
  sources.sort((a, b) => a.date - b.date || a.rank - b.rank || a.source.localeCompare(b.source));
  for (const { file, source } of sources) {
    try {
      const conflicts = [...additions].filter(([, files]) => files.length > 1 && files.includes(source));
      if (conflicts.length) throw new Error(`Pending added collision: ${conflicts.map(([id, files]) => `${id}: ${files.join(', ')}`).join('; ')}`);
      results.push(await applySource(file, { projectDir }));
    } catch (err) {
      failures.push({ source, error: err.message });
    }
  }
  return { results, failures };
}

/**
 * `adr live init`: create `LIVE.md` with the sentinel, and list the accepted ADRs that now fail
 * the gate — they are the ones that would reach finalize with no delta (§3.6).
 */
export async function initLive({ projectDir = process.cwd() } = {}) {
  const ctx = await liveContext(projectDir);
  const live = rel(ctx, ctx.livePath);
  if (ctx.exists) {
    throw liveError('LIVE.md already exists.', {
      expected: `no file at ${live}`,
      detected: 'it exists',
      next: 'run `ai-factory adr live check`',
    });
  }
  const since = todayUTC();
  await atomicWrite(ctx.livePath, liveTemplate(since));
  const pending = [];
  for (const [id, adr] of ctx.adrs) {
    if (adr.status !== 'accepted') continue;
    const doc = await readDelta(adr.file, { adr: true }).catch(() => null);
    if (doc && gateProblem(doc.delta, doc.problems, { unapplied: true })) pending.push({ id, file: rel(ctx, adr.file) });
  }
  pending.sort((a, b) => a.id.localeCompare(b.id));
  return { live, since, acceptedWithoutDelta: pending };
}
