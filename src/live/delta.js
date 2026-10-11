import { readFile } from 'node:fs/promises';
import YAML from 'yaml';
import { parse, serialize } from '../artifacts/frontmatter.js';

export const CHANGES = ['added', 'modified', 'removed'];
export const CAPABILITY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TOP_KEYS = new Set(['changes', 'none', 'applied', 'contradicts']);
const CHANGE_KEYS = new Set(['capability', 'change', 'summary', 'refs']);

const isMapping = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const text = (v) => (typeof v === 'string' ? v.trim() : '');

/** A ref value as authored — 1 string separated by `,`, or a YAML list — as a list. */
export function splitRefs(refs) {
  if (refs == null) return [];
  const list = Array.isArray(refs) ? refs.map(String) : String(refs).split(',');
  return list.map((r) => r.trim()).filter(Boolean);
}

/**
 * What is wrong with a delta mapping, as 1 line each; [] when it is well-formed. `null` is
 * absent, not malformed — `live:` with no value parses to it, as `plan:` does — so the caller
 * asks `delta == null` first.
 */
export function deltaProblems(delta) {
  if (!isMapping(delta)) return ['the delta is not a mapping: write `changes:` or `none:`'];
  const out = [];
  for (const key of Object.keys(delta)) {
    if (!TOP_KEYS.has(key)) out.push(`unknown key "${key}": the delta holds changes, none, applied, contradicts`);
  }
  const hasChanges = delta.changes != null;
  const hasNone = delta.none != null;
  if (hasChanges && hasNone) out.push('`changes:` and `none:` exclude each other');
  if (!hasChanges && !hasNone) out.push('the delta has neither `changes:` nor `none:`');
  if (hasNone && !text(delta.none)) out.push('`none:` states the reason as a string');
  if (hasNone && delta.applied != null) out.push('a `none:` delta is complete as written and carries no `applied:`');
  if (delta.applied != null && !DATE_RE.test(String(delta.applied))) out.push(`\`applied:\` is a YYYY-MM-DD date, got ${JSON.stringify(delta.applied)}`);
  if (delta.contradicts != null && !(Array.isArray(delta.contradicts) && delta.contradicts.every((c) => typeof c === 'string'))) {
    out.push('`contradicts:` is a list of ADR ids');
  }
  if (!hasChanges || hasNone) return out;

  if (!Array.isArray(delta.changes) || delta.changes.length === 0) {
    out.push('`changes:` is a non-empty list');
    return out;
  }
  const seen = new Set();
  delta.changes.forEach((c, i) => {
    const at = `changes[${i + 1}]`;
    if (!isMapping(c)) return out.push(`${at} is not a mapping`);
    for (const key of Object.keys(c)) {
      if (!CHANGE_KEYS.has(key)) out.push(`${at}: unknown key "${key}": a change holds capability, change, summary, refs`);
    }
    const id = text(c.capability);
    if (!CAPABILITY_RE.test(id)) out.push(`${at}: capability ${JSON.stringify(c.capability ?? null)} is not a kebab-case id`);
    else if (seen.has(id)) out.push(`${at}: capability "${id}" appears more than 1 time in this delta`);
    seen.add(id);
    if (!CHANGES.includes(c.change)) out.push(`${at}: change ${JSON.stringify(c.change ?? null)} is not one of ${CHANGES.join(', ')}`);
    if (c.change !== 'removed' && !text(c.summary)) out.push(`${at}: summary is required for change "${c.change}"`);
    if (c.summary != null && (typeof c.summary !== 'string' || /\n/.test(c.summary))) out.push(`${at}: summary is 1 line of text`);
    if (c.refs != null) {
      const ok = typeof c.refs === 'string' || (Array.isArray(c.refs) && c.refs.every((r) => typeof r === 'string'));
      if (!ok || splitRefs(c.refs).some((r) => /\n/.test(r))) out.push(`${at}: refs is 1 line separated by ", ", or a list of strings`);
    }
  });
  return out;
}

/**
 * The first ```` ```adr-live ```` fence outside any other fence, as line indexes. A fence the
 * author nested inside an example (a ```` ````markdown ```` block) is the example's data.
 * Throws on a second `adr-live` fence or one that never closes.
 */
export function findFence(content) {
  const lines = content.split('\n');
  let outer = null; // the backtick run of the fence we are inside, if any
  let found = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].replace(/\r$/, '');
    const open = line.match(/^(`{3,})(.*)$/);
    if (outer) {
      if (open && open[1].length >= outer.ticks && !open[2].trim()) {
        if (outer.live) found.end = i;
        outer = null;
      }
      continue;
    }
    if (!open) continue;
    const live = open[1].length === 3 && open[2].trim() === 'adr-live';
    if (live && found) {
      throw new Error(`more than 1 \`adr-live\` fence: line ${found.start + 1} and line ${i + 1}`);
    }
    if (live) found = { start: i, end: null };
    outer = { ticks: open[1].length, live };
  }
  if (found && found.end == null) throw new Error(`the \`adr-live\` fence at line ${found.start + 1} never closes`);
  return found && { ...found, lines, yaml: lines.slice(found.start + 1, found.end).map((line) => line.replace(/\r$/, '')).join('\n') };
}

/**
 * The delta a source carries, and where. An ADR (frontmatter `type: adr`) carries it in
 * frontmatter `live:`; anything else is a plan and carries it in its first `adr-live` fence.
 * Returns { carrier, content, data, body, fence, delta, problems } — `delta` is null when absent.
 */
export async function readDelta(file) {
  const content = await readFile(file, 'utf8');
  const { data, body } = parse(content);
  if (data.type === 'adr') {
    const delta = data.live ?? null;
    return { carrier: 'adr', content, data, body, fence: null, delta, problems: delta == null ? [] : deltaProblems(delta) };
  }
  let fence;
  try {
    fence = findFence(content);
  } catch (err) {
    return { carrier: 'plan', content, data, body, fence: null, delta: null, problems: [err.message] };
  }
  if (!fence) return { carrier: 'plan', content, data, body, fence: null, delta: null, problems: [] };
  let delta;
  try {
    delta = YAML.parse(fence.yaml) ?? null;
  } catch (err) {
    return { carrier: 'plan', content, data, body, fence, delta: null, problems: [`the \`adr-live\` fence YAML could not be parsed: ${err.message.split('\n')[0]}`] };
  }
  const problems = delta == null ? ['the `adr-live` fence is empty: write `changes:` or `none:`'] : deltaProblems(delta);
  return { carrier: 'plan', content, data, body, fence, delta, problems };
}

/**
 * The source's content with `applied:` (and, for a plan, `contradicts:`) written into the carrier
 * it was read from. A fence gains lines before its close; an existing contradiction list
 * merges in place, leaving every other authored field and the surrounding plan untouched.
 */
export function markApplied(doc, { date, contradicts = [] }) {
  if (doc.carrier === 'adr') {
    const data = { ...doc.data, live: { ...doc.data.live, applied: date } };
    return serialize(data, doc.body);
  }
  const eol = doc.fence.lines[doc.fence.start].endsWith('\r') ? '\r' : '';
  const added = [`applied: ${date}${eol}`];
  if (contradicts.length && doc.delta.contradicts == null) added.push(`contradicts: [${contradicts.join(', ')}]${eol}`);
  const lines = [...doc.fence.lines];
  if (contradicts.length && doc.delta.contradicts != null) {
    // YAML's value range also covers a block list, without touching adjacent fields.
    const value = YAML.parseDocument(doc.fence.yaml).get('contradicts', true);
    const [start, end] = value.range;
    const column = start - (doc.fence.yaml.lastIndexOf('\n', start - 1) + 1);
    const indent = doc.fence.yaml[start] === '-' ? ' '.repeat(Math.max(0, 2 - column)) : '';
    const replacement = `${indent}[${contradicts.join(', ')}]${doc.fence.yaml[end - 1] === '\n' ? '\n' : ''}`;
    const yaml = doc.fence.yaml.slice(0, start) + replacement + doc.fence.yaml.slice(end);
    return [...lines.slice(0, doc.fence.start + 1), ...yaml.split('\n').map((line) => line + eol), ...added, ...lines.slice(doc.fence.end)].join('\n');
  }
  lines.splice(doc.fence.end, 0, ...added);
  return lines.join('\n');
}
