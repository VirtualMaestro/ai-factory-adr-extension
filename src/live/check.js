import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { read } from '../artifacts/frontmatter.js';
import { liveContext } from './apply.js';
import { deltaProblems } from './delta.js';
import { resolveRef } from './refs.js';
import { parseLive, liveIssues } from './state.js';

const UNFINISHED = new Set(['proposed', 'draft', 'accepted']);
const MAX_REFS = 3;
const MAX_SENTENCES = 2;

// shortcut: a sentence ends at . ! ? before a capital, so "e.g. Foo" counts 2; a real tokenizer if that ever matters.
const sentences = (s) => s.trim().split(/(?<=[.!?])\s+(?=\p{Lu})/u).filter(Boolean).length;

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
    if (e.refs.length > MAX_REFS) add('ref-creep', e.id, `${e.refs.length} refs, more than ${MAX_REFS}: the capability is 2 capabilities, or its refs name history`);
    if (sentences(e.summary) > MAX_SENTENCES) add('summary-too-long', e.id, `the summary has more than ${MAX_SENTENCES} sentences`);
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
      } else if (hit.kind === 'plan' && /^\s*- \[ \]/m.test(await readFile(hit.file, 'utf8'))) {
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
    const problems = delta == null ? [] : deltaProblems(delta);
    if (delta == null) add('missing-delta', id, 'the active ADR has no `live:`: write `changes:` with `applied:`, or `none:` with the reason');
    else if (problems.length) add('missing-delta', id, `\`live:\` is malformed: ${problems.join('; ')}`);
    else if (delta.changes && delta.applied == null) add('unapplied-delta', id, `the delta never reached LIVE.md: run \`ai-factory adr live apply ${rel(adr.file)}\``);
  }

  issues.sort((a, b) => a.code.localeCompare(b.code) || a.target.localeCompare(b.target));
  return { live, exists: true, issues };
}
