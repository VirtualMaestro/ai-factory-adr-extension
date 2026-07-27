// Linter for the CNL-P skill contract (proposal §4.2). Pilot artifact.
//   node check.mjs <SKILL.md> [--baseline=<bytes>] [--max-delta=<percent>]
// Exits non-zero on any finding. Import `check(text, opts)` to test it.
import { readFileSync } from 'node:fs';

// Section -> id prefix. Sections absent here hold no normative lines.
const PREFIX_BY_SECTION = {
  Scope: 'S',
  Forbidden: 'F',
  Preconditions: 'P',
  'Decision rules': 'R',
  Workflow: 'W',
  Cases: 'C',
  'Abort conditions': 'A',
  Output: 'O'
};
const KNOWN_PREFIXES = new Set([...Object.values(PREFIX_BY_SECTION), 'T', 'L']);

const ID = /^([A-Z])(\d+)(?:\.(\d+))?$/;
const ID_LINE = /^(\s*)([A-Z]\d+(?:\.\d+)?)\s+(.*)$/;
const T_ROW = /^\|\s*(T\d+)\s*\|/;
const MODAL_LEAD = /^(MUST NOT|MUST|MAY)\s/;
const MODAL_ANY = /\b(MUST NOT|MUST|MAY)\b/g;
const CASE_LABEL = /^C\d+$/; // a case label is a discriminator, not an obligation
const TOKEN = /\b([A-Z])(\d+(?:\.\d+)?)\b/g;
const RANGE = /\b([A-Z])(\d+)\s*[–-]\s*([A-Z]?)(\d+)\b/g;

/** Split into logical lines (§4.2): an id line plus any indented continuation. */
function logicalLines(lines) {
  const out = [];
  let fence = null;
  let current = null;
  const flush = () => {
    if (current) out.push(current);
    current = null;
  };
  lines.forEach((raw, i) => {
    const fenceMark = raw.match(/^\s*(`{3,})/);
    if (fenceMark) {
      if (fence && raw.trim().startsWith(fence)) fence = null;
      else if (!fence) fence = fenceMark[1];
      flush();
      return;
    }
    if (fence) return;
    if (/^#{1,6}\s/.test(raw) || raw.trim() === '') return flush();
    const t = raw.match(T_ROW);
    if (t) {
      flush();
      out.push({ id: t[1], body: '', line: i + 1, section: null, data: true });
      return;
    }
    if (raw.trim().startsWith('|') || raw.trim().startsWith('>')) return flush();
    const m = raw.match(ID_LINE);
    if (m) {
      flush();
      current = { id: m[2], body: m[3], line: i + 1 };
      return;
    }
    if (current && /^\s+\S/.test(raw)) current.body += ' ' + raw.trim();
    else flush();
  });
  flush();
  return out;
}

/** Strip fenced blocks and blockquotes: text inside them is data, not references. */
function proseOnly(lines) {
  let fence = null;
  return lines
    .filter((raw) => {
      const fenceMark = raw.match(/^\s*(`{3,})/);
      if (fenceMark) {
        if (fence && raw.trim().startsWith(fence)) fence = null;
        else if (!fence) fence = fenceMark[1];
        return false;
      }
      return !fence && !raw.trim().startsWith('>');
    })
    .join('\n');
}

export function check(text, { baseline, maxDelta = 20 } = {}) {
  const lines = text.split(/\r?\n/);
  const problems = [];
  const defined = new Map();

  // Section of each physical line, so a normative line can be checked against its prefix.
  const sectionAt = [];
  let section = null;
  let fence = null;
  lines.forEach((raw, i) => {
    const fenceMark = raw.match(/^\s*(`{3,})/);
    if (fenceMark) fence = fence && raw.trim().startsWith(fence) ? null : fence ?? fenceMark[1];
    else if (!fence) {
      const h = raw.match(/^##\s+(.+?)\s*$/);
      if (h) section = h[1];
    }
    sectionAt[i] = section;
  });

  for (const item of logicalLines(lines)) {
    const sec = sectionAt[item.line - 1];
    const at = `${item.line} ${item.id}`;
    const parts = item.id.match(ID);
    if (defined.has(item.id)) problems.push(`${at}: duplicate id (first at line ${defined.get(item.id).line})`);
    defined.set(item.id, { line: item.line, section: sec });
    if (item.data) continue;

    if (!KNOWN_PREFIXES.has(parts[1])) problems.push(`${at}: unknown id prefix "${parts[1]}"`);
    else {
      const expected = PREFIX_BY_SECTION[sec];
      if (!expected) problems.push(`${at}: section "${sec}" holds no normative lines`);
      else if (parts[1] !== expected) problems.push(`${at}: prefix "${parts[1]}" in section "${sec}" expects "${expected}"`);
    }
    if (parts[3] !== undefined) {
      const parent = `${parts[1]}${parts[2]}`;
      if (!defined.has(parent)) problems.push(`${at}: orphan — parent ${parent} is not defined above it`);
    }
    if (CASE_LABEL.test(item.id)) continue; // label: discriminator, no modal by design

    if (!MODAL_LEAD.test(item.body)) problems.push(`${at}: no leading modal`);
    const modals = item.body.match(MODAL_ANY) ?? [];
    if (modals.length > 1) problems.push(`${at}: ${modals.length} modals (${modals.join(', ')}) — split the line`);
  }

  // An obligation that forgot its id is invisible to every check above.
  let fence2 = null;
  lines.forEach((raw, i) => {
    const fenceMark = raw.match(/^\s*(`{3,})/);
    if (fenceMark) {
      fence2 = fence2 && raw.trim().startsWith(fence2) ? null : fence2 ?? fenceMark[1];
      return;
    }
    if (fence2 || !PREFIX_BY_SECTION[sectionAt[i]]) return;
    const body = raw.replace(/^\s*[-*]\s+/, '').trim();
    if (MODAL_LEAD.test(body)) problems.push(`${i + 1}: obligation with no id — "${body.slice(0, 48)}"`);
  });

  // References. Ranges first, so endpoints are not also counted as single refs.
  const prose = proseOnly(lines);
  const seen = new Set();
  let stripped = prose.replace(RANGE, (m, p1, n1, p2, n2) => {
    seen.add(m);
    if (p2 && p2 !== p1) {
      problems.push(`range ${m}: mixed prefixes`);
      return ' ';
    }
    const [lo, hi] = [Number(n1), Number(n2)];
    if (hi < lo) problems.push(`range ${m}: reversed`);
    for (let n = lo; n <= hi; n++) if (!defined.has(`${p1}${n}`)) problems.push(`range ${m}: ${p1}${n} is not defined`);
    return ' ';
  });
  for (const [, prefix, rest] of stripped.matchAll(TOKEN)) {
    const id = `${prefix}${rest}`;
    if (!KNOWN_PREFIXES.has(prefix) || seen.has(id)) continue;
    seen.add(id);
    if (!defined.has(id)) problems.push(`unresolved reference ${id}`);
  }

  const bytes = Buffer.byteLength(text, 'utf8');
  const chars = [...text].length;
  let delta = null;
  if (baseline) {
    delta = (bytes / Number(baseline) - 1) * 100;
    if (delta > maxDelta) problems.push(`size: +${delta.toFixed(1)}% exceeds the +${maxDelta}% budget`);
  }
  return { problems, ids: defined.size, bytes, chars, delta };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const [file, ...flags] = process.argv.slice(2);
  const arg = (n) => flags.find((f) => f.startsWith(`--${n}=`))?.split('=')[1];
  const r = check(readFileSync(file, 'utf8'), { baseline: arg('baseline'), maxDelta: Number(arg('max-delta') ?? 20) });
  console.log(`${file}: ${r.ids} ids, ${r.bytes} bytes, ${r.chars} chars` + (r.delta === null ? '' : `, ${r.delta > 0 ? '+' : ''}${r.delta.toFixed(1)}%`));
  for (const p of r.problems) console.log(`FAIL ${p}`);
  process.exit(r.problems.length ? 1 : 0);
}
