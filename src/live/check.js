import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse, read } from '../artifacts/frontmatter.js';
import { liveContext } from './apply.js';
import { deltaProblems, splitRefs, summaryProblem } from './delta.js';
import { readPlans, linkedAdrs, hasOpenTask } from './plans.js';
import { normaliseRef, resolveRef } from './refs.js';
import { parseLive, liveIssues } from './state.js';

const UNFINISHED = new Set(['proposed', 'draft', 'accepted']);
const MAX_REFS = 3;

/** The active ADR a superseded id's `replaced_by` chain ends in, or null. */
function activeSuccessor(id, adrs) {
  const seen = new Set();
  let at = adrs.get(id);
  while (at?.replaced_by && !seen.has(at.replaced_by)) {
    seen.add(at.replaced_by);
    const next = adrs.get(at.replaced_by);
    if (next?.status === 'active') return at.replaced_by;
    at = next;
  }
  return null;
}

/**
 * `adr live check` (§3.7): what `LIVE.md` gets wrong and which deltas never reached it. Returns
 * { live, exists, issues: [{ code, target, message }] }. Never a reason to fail on its own — the
 * caller decides, as with `adr decisions`.
 */
export async function checkLive({ projectDir = process.cwd() } = {}) {
  const ctx = await liveContext(projectDir);
  const rel = (f) => path.relative(projectDir, f).split(path.sep).join('/');
  const live = rel(ctx.livePath);
  if (!ctx.exists) return { live, exists: false, issues: [] };

  const issues = [];
  const add = (code, target, message) => issues.push({ code, target, message });
  const content = await readFile(ctx.livePath, 'utf8');

  for (const i of await liveIssues(content)) add('live-format', i.line ? `${live}:${i.line}` : live, i.message);
  let entries = [];
  try {
    ({ entries } = parseLive(content));
  } catch (err) {
    add('live-format', live, err.message);
  }

  for (const e of entries) {
    if (!e.refs.length) add('no-refs', e.id, 'the entry has no ref: name the ADR, plan or path that describes it');
    // An active ADR ref is current by construction (supersede rewrites it), so a capability names every
    // active ADR that shapes it; plan, path and non-active ADR refs count toward the limit.
    const other = e.refs.filter((r) => ctx.adrs.get(normaliseRef(r))?.status !== 'active');
    if (other.length > MAX_REFS) add('ref-creep', e.id, `${other.length} refs that name no active ADR, more than ${MAX_REFS}: the capability is 2 capabilities, or its refs name history`);
    const summaryIssue = summaryProblem(e.summary);
    if (summaryIssue) add('summary-too-long', e.id, summaryIssue);
    for (const ref of e.refs) {
      const hits = resolveRef(ref, ctx);
      if (!hits.length) {
        add('broken-ref', e.id, `"${ref}" names no ADR, plan or file in the project`);
        continue;
      }
      if (hits.length > 1) {
        add('ambiguous-ref', e.id, `"${ref}" names ${hits.length} things: ${hits.map((h) => (h.kind === 'adr' ? `ADR ${h.id}` : `${h.kind} ${rel(h.file)}`)).join(', ')}`);
        continue;
      }
      const [hit] = hits;
      if (hit.kind === 'adr') {
        const { status } = ctx.adrs.get(hit.id);
        if (UNFINISHED.has(status)) add('ref-to-unfinished', e.id, `"${ref}" is ${status}, so the behaviour it describes is not built yet`);
        const successor = status === 'superseded' ? activeSuccessor(hit.id, ctx.adrs) : null;
        if (successor) add('stale-superseded-ref', e.id, `"${ref}" is superseded, and ${successor} is active: the ref names ${successor} now`);
      } else if (hit.kind === 'plan' && hasOpenTask(await readFile(hit.file, 'utf8'))) {
        add('ref-to-unfinished', e.id, `"${ref}" is a plan with an open task`);
      }
    }
  }

  for (const [id, adr] of ctx.adrs) {
    if (adr.status !== 'active') continue;
    let data;
    try {
      ({ data } = await read(adr.file));
    } catch {
      continue; // unreadable ADRs are `adr status --check`'s to report
    }
    const delta = data.live ?? null;
    const problems = delta == null ? [] : deltaProblems(delta, { adr: true });
    if (delta == null) add('missing-delta', id, 'the active ADR has no `live:`: write `changes:` with `applied:`, or `none:` with the reason');
    else if (problems.length) add('missing-delta', id, `\`live:\` is malformed: ${problems.join('; ')}`);
    else if (delta.changes && delta.applied == null) issues.push({ code: 'unapplied-delta', target: id, source: rel(adr.file), message: `the delta never reached LIVE.md: run \`ai-factory adr live apply ${rel(adr.file)}\`` });
  }

  // Without the opt-in date, every archived plan would read as one that missed its delta.
  let since = '';
  try {
    since = String(parse(content).data.since ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) {
      add('live-format', live, 'frontmatter `since:` is not a YYYY-MM-DD date: archived plans are not checked until it is');
      since = '';
    }
  } catch (err) {
    add('live-format', live, err.message.split('\n')[0]);
  }
  for (const { file, doc, archived, completed, date } of await readPlans(ctx)) {
    const target = rel(file);
    const linked = linkedAdrs(doc).length > 0;
    if (linked && (doc.fence || doc.problems.length)) add('delta-on-linked-plan', target, 'the linked ADR carries the delta: remove the plan fence');
    if (!archived && !completed) continue;
    for (const id of splitRefs(doc.delta?.contradicts)) {
      if (ctx.adrs.get(id)?.status === 'active') add('contradicts-active-adr', target, `the plan removed a capability established by ${id}; next: adr-auto-plan to supersede it`);
    }
    if (linked) continue;
    if (doc.delta == null || doc.problems.length) {
      if (!archived || (since && date && date >= since)) add('missing-delta', target, doc.problems.join('; ') || 'the completed plan has no `adr-live` fence');
    } else if (doc.delta.changes && doc.delta.applied == null) {
      issues.push({ code: 'unapplied-delta', target, source: target, message: `run \`ai-factory adr live apply ${target}\`` });
    }
  }

  issues.sort((a, b) => a.code.localeCompare(b.code) || a.target.localeCompare(b.target));
  return { live, exists: true, issues };
}
