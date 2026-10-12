import { bodyIssues, loadProfile, readRecords } from '../artifacts/cnlp.js';
import { normaliseRef } from './refs.js';
import { splitRefs } from './delta.js';

export const SENTINEL = '- none: no capability recorded yet';
const FM_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;
const RECORD_KEYS = new Set(['id', 'summary', 'refs']);

/**
 * `LIVE.md` split into what the CLI keeps byte for byte (`prefix`: the frontmatter and every
 * line before `capabilities:`) and the records it rewrites. Throws on anything after the key
 * that is not a record or the sentinel: the render rewrites to the end of the file, so that
 * line would be dropped without a word.
 */
export function parseLive(content) {
  const fmEnd = content.match(FM_RE)?.[0].length ?? 0;
  const key = /^capabilities:[ \t]*\r?$/m.exec(content.slice(fmEnd));
  if (!key) throw new Error('LIVE.md has no `capabilities:` block');
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const prefix = content.slice(0, fmEnd + key.index);
  const startLine = prefix.split(/\r?\n/).length; // 1-based line of `capabilities:`
  const items = content
    .slice(fmEnd + key.index + key[0].length)
    .split(/\r?\n/)
    .map((text, i) => ({ text, line: startLine + i }))
    .filter((i) => i.text.trim() !== '');

  const { records, stray, repeated } = readRecords(items.filter((i) => !/^- none\b/.test(i.text)));
  const bad = stray[0] ?? repeated[0];
  if (bad) throw new Error(`LIVE.md line ${bad.line} is not a capability record, and the CLI rewrites every line after \`capabilities:\``);

  const ids = new Set();
  const entries = records.map((r) => {
    const unknown = r.keys.find((k) => !RECORD_KEYS.has(k));
    if (unknown) throw new Error(`LIVE.md line ${r.line}: "${unknown}" is not a record key (id, summary, refs)`);
    const id = r.values.id ?? '';
    if (ids.has(id)) throw new Error(`LIVE.md line ${r.line}: capability "${id}" appears more than 1 time`);
    ids.add(id);
    return { id, summary: r.values.summary ?? '', refs: splitRefs(r.values.refs).map(normaliseRef) };
  });
  return { prefix, eol, entries };
}

/** The file again: `prefix` untouched, then the records sorted by id, or the sentinel when there are none. */
export function renderLive({ prefix, eol = '\n', entries }) {
  const lines = ['capabilities:'];
  if (!entries.length) lines.push(SENTINEL);
  for (const e of [...entries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    lines.push(`- id: ${e.id}`, `  summary: ${e.summary}`, e.refs.length ? `  refs: ${e.refs.join(', ')}` : '  refs:');
  }
  return prefix + lines.join(eol) + eol;
}

/**
 * CNL-P issues of `LIVE.md` against `profiles/live.md`, [{ line, message, text }]. The checker
 * numbers lines from the end of the frontmatter; these are lines of the file, so the operator
 * can go to them. `line` 0 is about the file as a whole.
 */
export async function liveIssues(content) {
  const offset = (content.match(FM_RE)?.[0] ?? '').split('\n').length - 1;
  const lines = content.split(/\r?\n/);
  const issues = bodyIssues(content, await loadProfile('live')).map((i) => ({
    line: i.line ? i.line + offset : 0,
    message: i.message,
    text: i.line ? lines[i.line + offset - 1] : '',
  }));
  // The checker reads quoted text as data and skips it, so a quoted summary passes the lexicon
  // unchecked, and the next render keeps the quotes as part of the value.
  lines.forEach((text, i) => {
    if (/^ {2}summary: (["']).*\1\s*$/.test(text)) {
      issues.push({ line: i + 1, message: 'the summary is quoted: LIVE.md is not YAML, and the lexicon skips quoted text', text });
    }
  });
  return issues.sort((a, b) => a.line - b.line);
}

const withRef = (refs, ref) => (ref && !refs.includes(ref) ? [...refs, ref] : refs);

/**
 * Replace every ref to a superseded id with its successor, deduplicated. Returns the new entries
 * and the ids of the entries it touched.
 */
export function rewriteSuperseded(entries, oldIds, newId) {
  const old = new Set(oldIds);
  const touched = [];
  const out = entries.map((e) => {
    if (!e.refs.some((r) => old.has(r))) return e;
    touched.push(e.id);
    return { ...e, refs: e.refs.reduce((acc, r) => withRef(acc, old.has(r) ? newId : r), []) };
  });
  return { entries: out, touched };
}

/**
 * The pure apply (§3.4): entries + changes → new entries, with what it did, what it warns about
 * and what it refuses. Nothing here reads or writes a file.
 *
 * `source` = { kind: 'adr' | 'plan', ref, supersedes, adrs } — `ref` is the ADR id or plan stem
 * appended to every entry the delta touches (null for a fast plan, whose records carry their
 * own); `adrs` is the id index, read for the active-ADR guard.
 */
export function applyDelta(entries, changes, { kind, ref = null, supersedes = [], adrs = new Map() }) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const ops = [];
  const warnings = [];
  const refusals = [];
  const contradicts = [];
  const activeAdrs = (entry) => entry.refs.filter((r) => adrs.get(r)?.status === 'active');

  for (const c of changes) {
    const id = c.capability.trim();
    const refs = splitRefs(c.refs).map(normaliseRef).reduce(withRef, ref ? [ref] : []);
    const existing = byId.get(id);
    if (c.change === 'added') {
      if (existing) {
        refusals.push(`capability "${id}" already exists: write \`change: modified\` to replace its summary`);
        continue;
      }
      if (!refs.length) {
        refusals.push(`capability "${id}" has no ref: a fast plan names the files in \`refs:\``);
        continue;
      }
      byId.set(id, { id, summary: c.summary.trim(), refs });
      ops.push({ op: 'added', id });
      continue;
    }
    if (!existing) {
      refusals.push(`capability "${id}" does not exist, so it cannot be ${c.change}: write \`change: added\`, or reuse an id from LIVE.md`);
      continue;
    }
    const guarded = kind === 'plan' ? activeAdrs(existing) : [];
    if (c.change === 'removed') {
      byId.delete(id);
      ops.push({ op: 'removed', id });
      if (guarded.length) {
        contradicts.push(...guarded.filter((a) => !contradicts.includes(a)));
        warnings.push(`removes "${id}", which active ${guarded.join(', ')} established; the plan records the contradiction; next: adr-auto-plan to supersede it`);
      }
      continue;
    }
    byId.set(id, { id, summary: c.summary.trim(), refs: refs.reduce(withRef, existing.refs) });
    ops.push({ op: 'modified', id });
    if (guarded.length) warnings.push(`modifies "${id}", which active ${guarded.join(', ')} established`);
  }

  let out = [...byId.values()];
  const old = supersedes.filter(Boolean);
  if (kind === 'adr' && ref && old.length) {
    const named = new Set(changes.map((c) => c.capability.trim()));
    const { entries: rewritten, touched } = rewriteSuperseded(out, old, ref);
    out = rewritten;
    if (touched.length) ops.push({ op: 'rewrote', ids: touched });
    const unnamed = touched.filter((id) => !named.has(id));
    if (unnamed.length) {
      warnings.push(`${unnamed.join(', ')} ref superseded ${old.join(', ')}; the refs now name ${ref}: a capability the successor dropped needs \`change: removed\``);
    }
  }
  return { entries: out, ops, warnings, refusals, contradicts };
}
