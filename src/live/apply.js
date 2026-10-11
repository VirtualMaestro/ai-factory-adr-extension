import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { adrRoot, liveFile, readAifPaths } from '../config/paths.js';
import { indexAdrsById } from '../status.js';
import { resolveInside, atomicWrite, withFileRollback } from '../util/safe-path.js';
import { stageMove } from '../util/git.js';
import { todayUTC } from '../lifecycle/archive.js';
import { readDelta, markApplied } from './delta.js';
import { parseLive, renderLive, liveIssues, applyDelta, SENTINEL } from './state.js';

/** The house error shape (§27): what was expected, what was found, what changed, what to do. */
export function liveError(title, { expected, detected, next, files = 'nothing was changed' }) {
  const list = (v) => (Array.isArray(v) ? v.join('\n            ') : v);
  return new Error(`${title}\n  expected: ${expected}\n  detected: ${list(detected)}\n  files:    ${files}\n  next:     ${next}`);
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

/** Why a delta cannot pass the gate, or null: absent and malformed are both a refusal once `LIVE.md` exists. */
export function gateProblem(delta, problems) {
  if (delta == null) return 'no `live:` delta';
  return problems.length ? `malformed \`live:\`: ${problems.join('; ')}` : null;
}

/** The gate's refusal (§3.6), shared by `transition … accepted` and `finalize`. */
export function gateError(label, problem) {
  return liveError('The ADR has no usable `live:` delta, and this project keeps LIVE.md.', {
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
  if (issues.length) {
    throw liveError(`The delta of ${label} would make LIVE.md fail its profile.`, {
      expected: 'every record passes `ai-factory adr format live` and the lexicon of `ai-factory adr format`',
      detected: issues.map((i) => `LIVE.md line ${i.line}: ${i.message}${i.text ? ` — ${JSON.stringify(i.text)}` : ''}`),
      next: `rewrite the summary in ${label} as the message says, then run again`,
    });
  }
  return { before, after, changed: after !== before, ops: res.ops, warnings: res.warnings, contradicts: res.contradicts };
}

const rel = (ctx, file) => path.relative(ctx.projectDir, file).split(path.sep).join('/');

/**
 * `adr live apply <file>`: apply the delta of 1 source. An ADR applies standalone only when it is
 * active and its delta has no `applied:` — finalize applies it otherwise; `dryRun` takes an ADR of
 * any status and writes nothing. Returns what happened; `skipped` says why nothing could.
 */
export async function applySource(file, { projectDir = process.cwd(), dryRun = false } = {}) {
  const ctx = await liveContext(projectDir);
  const abs = resolveInside(projectDir, file);
  const base = { source: rel(ctx, abs), live: rel(ctx, ctx.livePath), dryRun };
  if (!ctx.exists) return { ...base, skipped: 'no LIVE.md' };
  if (!existsSync(abs)) {
    throw liveError('Source not found.', { expected: 'an existing ADR file', detected: `${file} is missing`, next: 'check the path' });
  }

  const doc = await readDelta(abs);
  if (doc.carrier !== 'adr') {
    throw liveError('Not an ADR.', {
      expected: 'an ADR file (frontmatter `type: adr`)',
      detected: `${base.source} has type ${JSON.stringify(doc.data.type ?? null)}`,
      next: 'pass the ADR whose `live:` delta is to be applied',
    });
  }
  const label = String(doc.data.id ?? base.source);
  const problem = gateProblem(doc.delta, doc.problems);
  if (problem) throw gateError(label, problem);
  if (doc.delta.applied != null) {
    throw liveError(`${label} is already applied on ${doc.delta.applied}.`, {
      expected: 'a delta without `applied:`',
      detected: `live.applied: ${doc.delta.applied}`,
      next: 'nothing to do; a new change to the capability is a new ADR or plan',
    });
  }
  if (!dryRun && doc.data.status !== 'active') {
    throw liveError(`${label} is not active.`, {
      expected: 'an active ADR: `adr finalize` applies the delta of an accepted one',
      detected: `status=${doc.data.status}`,
      next: 'run `ai-factory adr finalize`, or pass --dry-run to preview',
    });
  }

  const changes = doc.delta.changes ?? [];
  const supersedes = [].concat(doc.data.supersedes ?? []).map(String);
  const res = await computeLive(ctx, { changes, kind: 'adr', ref: doc.data.id, supersedes, label });
  const out = { ...base, id: label, ops: res.ops, warnings: res.warnings, changed: res.changed };
  if (!changes.length && !res.changed) return { ...out, skipped: 'nothing changed' };
  if (dryRun) return out;

  const date = todayUTC();
  await withFileRollback([abs, ctx.livePath], async () => {
    if (changes.length) await atomicWrite(abs, markApplied(doc, { date }));
    if (res.changed) await atomicWrite(ctx.livePath, res.after);
    stageMove(changes.length ? abs : null, res.changed ? ctx.livePath : null);
  });
  return { ...out, applied: changes.length ? date : null };
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
  await atomicWrite(ctx.livePath, `---\ntype: live\ntitle: Live state\nsince: ${since}\n---\n\ncapabilities:\n${SENTINEL}\n`);
  const pending = [];
  for (const [id, adr] of ctx.adrs) {
    if (adr.status !== 'accepted') continue;
    const doc = await readDelta(adr.file).catch(() => null);
    if (doc && gateProblem(doc.delta, doc.problems)) pending.push({ id, file: rel(ctx, adr.file) });
  }
  pending.sort((a, b) => a.id.localeCompare(b.id));
  return { live, since, acceptedWithoutDelta: pending };
}
