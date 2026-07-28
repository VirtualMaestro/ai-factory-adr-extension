// The mechanical half of docs/cnlp-format.md. One implementation for every document kind:
// what differs between kinds is declared in a profile document (profiles/*.md), not branched
// here. `test/skill-format.test.js` runs it over the skills, `ai-factory adr validate` over an
// ADR body. Grammar and lexicon only — neither caller can judge whether a bullet says
// something useful.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const DENY = /\b(surface[sd]?|sharpen[s]?|weigh[s]?|leverage[sd]?|robust|sanity-check|ensure[sd]?)\b/i;
const NUM = '(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten)';
/** §5: a threshold is a digit. */
export const SPELLED_THRESHOLD = /\b(at least|exactly|more than|fewer than|no more than|only) (one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
/** §5: a limit whose bound the phrase leaves open — the enforced half of the canonical form. */
export const AMBIGUOUS_LIMIT = new RegExp(`\\b(?:no more than|at most|up to|not exceeding|not exceed|no fewer than|not less than)\\s+${NUM}\\b`, 'i');
/** §5: an unquantified comparative claims a value the reader cannot check. */
export const COMPARATIVE = /\b(better|faster|cleaner|significantly|substantially|flexible|scalable|extensible|where possible|if needed|as appropriate|should probably|may want to)\b/i;
export const HARD_LIMIT = 250; // §4: 150 is the target, 250 is compound whatever it claims

const FORMS = new Set(['scalar', 'bullet-list', 'numbered-list', 'record-list', 'keyed-block']);
const KEY = /^([a-z][a-z0-9_]*):(.*)$/;

/**
 * Body split into lines, top-level `key:` sections and `##` headings, with fenced regions
 * blanked — §3: a fence is opaque, its contents are data and never section keys.
 * Leading frontmatter is stripped when present. Line numbers are 1-based within the body.
 */
export function parseBlocks(raw) {
  const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  let fenced = false;
  const fences = []; // 1-based line numbers a fence covered: blanked, but not absent
  const lines = body.split(/\r?\n/).map((l, i) => {
    if (/^\s*```/.test(l)) { fenced = !fenced; fences.push(i + 1); return ''; }
    if (fenced) { fences.push(i + 1); return ''; }
    return l;
  });
  const sections = [];
  const headings = [];
  lines.forEach((l, i) => {
    const key = l.match(KEY);
    if (key) sections.push({ key: key[1], value: key[2].trim(), line: i + 1 });
    if (/^##\s/.test(l)) headings.push({ text: l.trim(), line: i + 1 });
  });
  return { lines, sections, headings, fences: new Set(fences) };
}

/** Lines of a section: everything up to the next top-level key or `##` heading. */
function itemsOf(lines, at) {
  const out = [];
  for (let i = at; i < lines.length; i += 1) {
    if (KEY.test(lines[i]) || /^##\s/.test(lines[i])) break;
    if (lines[i].trim() !== '') out.push({ text: lines[i], line: i + 1 });
  }
  return out;
}

/** §3 record-list: `- key: value` opens a record, two-space-indented keys continue it. */
export function readRecords(items) {
  const records = [];
  const stray = [];
  const repeated = [];
  for (const { text, line } of items) {
    const open = text.match(/^- ([a-z][a-z0-9_]*): ?(.*)$/);
    const sub = text.match(/^ {2}([a-z][a-z0-9_]*): ?(.*)$/);
    if (open) records.push({ line, keys: [open[1]], values: { [open[1]]: open[2].trim() } });
    else if (sub && records.length) {
      const rec = records[records.length - 1];
      // A second copy of a key would silently win: two readers, two interpretations.
      if (rec.keys.includes(sub[1])) repeated.push({ key: sub[1], line });
      rec.keys.push(sub[1]);
      rec.values[sub[1]] = sub[2].trim();
    } else stray.push({ text, line });
  }
  return { records, stray, repeated };
}

const listValues = (items) => items
  .map((i) => i.text.replace(/^[-\d.]+ ?/, '').trim())
  .map((t) => (t.includes(':') ? t.slice(0, t.indexOf(':')).trim() : t))
  .filter((t) => t !== '');

/**
 * A value outside its domain is a typo that would otherwise pass silently — `required: ye`
 * reading as `no` disables the check the profile meant to declare.
 */
function domain(key, field, value, allowed) {
  if (!allowed.includes(value)) {
    throw new Error(`profile section "${key}": ${field} is ${JSON.stringify(value)}, expected one of ${allowed.join(', ')}`);
  }
  return value;
}

/** A profile document (profiles/*.md) read into the values the checker needs. */
export function readProfile(raw) {
  const { lines, sections } = parseBlocks(raw);
  const block = (key) => {
    const at = sections.find((s) => s.key === key);
    return at ? { value: at.value, items: itemsOf(lines, at.line) } : null;
  };
  const names = (key) => {
    const b = block(key);
    if (!b) return [];
    const out = listValues(b.items);
    return out.length === 1 && out[0] === 'none' ? [] : out;
  };
  const declared = readRecords(block('sections')?.items ?? []).records.map((r) => ({
    key: r.values.key,
    form: domain(r.values.key, 'form', r.values.form, [...FORMS]),
    required: domain(r.values.key, 'required', r.values.required, ['yes', 'no']) === 'yes',
    heading: (r.values.heading ?? '').replace(/^"|"$/g, ''),
    recordKeys: (r.values.record_keys ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    optionalRecordKeys: (r.values.optional_record_keys ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  }));
  return {
    format: block('format')?.value ?? '',
    mood: block('mood')?.value ?? '',
    headings: names('headings').map((h) => (h.startsWith('##') ? h : `## ${h}`)),
    frontmatterFields: names('frontmatter_fields'),
    custom: names('custom_sections'),
    sections: declared,
  };
}

const cache = new Map();

/**
 * Absolute path of a shipped document: the standard, or `profiles/<name>.md`. Resolved inside
 * this package, like `templates/adr.md` — the installing project keeps neither at its root, so
 * `ai-factory adr format` is how anything outside the package reaches them.
 */
export function resolveDoc(name = 'format') {
  // The name reaches this from a command line, so it names a document and never a path:
  // `profiles/${name}.md` with a `..` in it walks out of the package and reads anything.
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new Error(`not a CNL-P document name: ${JSON.stringify(name)}`);
  }
  const rel = name === 'format' ? 'docs/cnlp-format.md' : `profiles/${name}.md`;
  return fileURLToPath(new URL(`../../${rel}`, import.meta.url));
}

/** Load a shipped profile by name. */
export async function loadProfile(name) {
  if (!cache.has(name)) cache.set(name, readProfile(await readFile(resolveDoc(name), 'utf8')));
  return cache.get(name);
}

/**
 * Body conformance with the profile and with the shared lexicon. Returns [{ line, message }]
 * sorted by line; the caller decides the severity. A line number of 0 means the issue is
 * about the document as a whole.
 */
export function bodyIssues(raw, profile) {
  const { lines, sections, headings, fences } = parseBlocks(raw);
  const issues = [];
  const at = (line, message) => issues.push({ line, message });
  const byKey = new Map(profile.sections.map((s) => [s.key, s]));
  const order = profile.sections.map((s) => s.key);

  const seen = headings.map((h) => h.text);
  for (const want of profile.headings) {
    if (!seen.includes(want)) at(0, `missing heading "${want}"`);
  }
  for (const h of headings) {
    if (!profile.headings.includes(h.text)) at(h.line, `unknown heading "${h.text}" — the profile declares ${profile.headings.join(', ') || 'none'}`);
    else if (seen.indexOf(h.text) !== seen.lastIndexOf(h.text)) at(h.line, `heading "${h.text}" appears more than 1 time`);
  }
  const headingOrder = seen.filter((t) => profile.headings.includes(t));
  if (headingOrder.join() !== [...new Set(headingOrder)].sort((a, b) => profile.headings.indexOf(a) - profile.headings.indexOf(b)).join()) {
    at(0, `headings out of order — the profile declares ${profile.headings.join(', ')}`);
  }

  for (const s of profile.sections) {
    if (s.required && !sections.some((f) => f.key === s.key)) at(0, `missing required block "${s.key}:"`);
  }

  const declared = new Set();
  for (const { key, line } of sections) {
    if (declared.has(key)) at(line, `block "${key}:" appears more than 1 time — a fact lives in exactly 1 place`);
    declared.add(key);
    if (byKey.has(key) || profile.custom.includes(key)) continue;
    if (profile.frontmatterFields.includes(key)) at(line, `"${key}:" is a frontmatter field, not a body block`);
    else at(line, `unknown block "${key}:" — reuse a name the profile declares`);
  }

  const found = sections.map((s) => s.key).filter((k) => byKey.has(k));
  const sorted = [...found].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  if (found.join() !== sorted.join()) at(0, `blocks out of order — the profile declares ${order.join(', ')}`);

  for (const { key, value, line } of sections) {
    const spec = byKey.get(key);
    if (!spec) continue; // a custom section declares no form
    const items = itemsOf(lines, line);
    if (spec.heading) {
      const under = [...headings].reverse().find((h) => h.line < line);
      if (!under) at(line, `"${key}:" belongs under "${spec.heading}", found before any heading`);
      else if (under.text !== spec.heading) at(line, `"${key}:" belongs under "${spec.heading}", found under "${under.text}"`);
    }
    if (spec.form === 'scalar') {
      if (!value) at(line, `"${key}:" is a scalar — its value goes on the key line`);
      continue;
    }
    if (value) at(line, `"${key}:" carries a value on the key line but its form is ${spec.form}`);
    else if (items.length === 0) {
      // A fence is opaque content, not absence: its lines are blanked, so ask the parser.
      if (!coversFence(fences, line, lines)) {
        at(line, `"${key}:" is empty — a required block states "- none" with the reason, an optional one is deleted`);
      }
      continue;
    }
    // "- none: reason" is the declared way to say a required block has nothing, in any form.
    // It is the whole content of a required block: anything else makes it 2 statements.
    const none = items.find((i) => /^- none\b/.test(i.text));
    if (none) {
      if (!spec.required) at(none.line, `"${key}:" is optional and has nothing to say — delete the block instead of stating "- none"`);
      else if (items.length !== 1) at(none.line, `"${key}:" states "- none" alongside other items — the sentinel is the whole content or it is not used`);
      else if (!/^- none: \S/.test(none.text)) at(none.line, `"${key}:" states "- none" without the reason, which is what the reader needs`);
      continue;
    }
    issues.push(...formIssues(key, spec, items));
  }

  issues.push(...lexiconIssues(lines));
  return issues.sort((a, b) => a.line - b.line);
}

/** Whether the region under a key held a fenced block — §3: a fence is opaque, not empty. */
function coversFence(fences, at, lines) {
  for (let i = at; i < lines.length; i += 1) {
    if (KEY.test(lines[i]) || /^##\s/.test(lines[i])) return false;
    if (fences.has(i + 1)) return true;
  }
  return false;
}

function formIssues(key, spec, items) {
  const issues = [];
  const at = (line, message) => issues.push({ line, message });
  if (spec.form === 'numbered-list') {
    const bad = items.find((i) => !/^\d+\. /.test(i.text));
    if (bad) at(bad.line, `"${key}:" is a numbered-list — every item opens with "N. "`);
    else {
      // The numbers are the order: a gap or a repeat makes 2 readings of the same sequence.
      items.forEach((i, n) => {
        const got = Number(i.text.match(/^(\d+)\./)[1]);
        if (got !== n + 1) at(i.line, `"${key}:" step ${got} is out of sequence — the steps run 1..${items.length}`);
      });
    }
    return issues;
  }
  if (spec.form === 'bullet-list') {
    const bad = items.find((i) => !/^- /.test(i.text));
    if (bad) at(bad.line, `"${key}:" is a bullet-list — every item opens with "- "`);
    return issues;
  }
  if (spec.form === 'keyed-block') {
    const bad = items.find((i) => !/^ {2}[a-z][a-z0-9_]*:/.test(i.text));
    if (bad) at(bad.line, `"${key}:" is a keyed-block — its sub-keys are two-space-indented`);
    const allowed = [...spec.recordKeys, ...spec.optionalRecordKeys];
    const present = [];
    for (const i of items) {
      const sub = i.text.trim().split(':')[0];
      if (present.includes(sub)) at(i.line, `"${key}:" carries "${sub}:" more than 1 time`);
      else if (!allowed.includes(sub)) at(i.line, `"${sub}" is not a "${key}:" sub-key — the profile declares ${allowed.join(', ')}`);
      present.push(sub);
    }
    for (const want of spec.recordKeys) {
      if (!present.includes(want)) at(items[0].line, `"${key}:" is missing "${want}:"`);
    }
    return issues;
  }
  // record-list
  const { records, stray, repeated } = readRecords(items);
  for (const r of repeated) at(r.line, `a "${key}:" record carries "${r.key}:" more than 1 time`);
  for (const s of stray) at(s.line, `"${key}:" is a record-list — a record opens with "- ${spec.recordKeys[0] ?? 'key'}: …" then two-space-indented keys`);
  const allowed = [...spec.recordKeys, ...spec.optionalRecordKeys];
  for (const rec of records) {
    if (spec.recordKeys.length && rec.keys[0] !== spec.recordKeys[0]) {
      at(rec.line, `a "${key}:" record opens with "- ${spec.recordKeys[0]}: <value>"`);
    }
    for (const want of spec.recordKeys) {
      if (!rec.keys.includes(want)) at(rec.line, `a "${key}:" record is missing "${want}:"`);
    }
    for (const k of rec.keys) {
      if (!allowed.includes(k)) at(rec.line, `"${k}" is not a "${key}:" key — the profile declares ${allowed.join(', ')}`);
    }
  }
  return issues;
}

/** §5: quoted or backticked text is data, not a claim, so the lexicon does not police it. */
const unquoted = (l) => l.replace(/`[^`]*`|"[^"]*"|'[^']*'/g, ' ');

/** §5 lexicon. One rule set for every profile. */
export function lexiconIssues(lines) {
  const issues = [];
  lines.forEach((l, i) => {
    const line = i + 1;
    const text = unquoted(l);
    // Every line, not only a bullet: a scalar or a record sub-key holds one idea too.
    if (l.length > HARD_LIMIT) {
      issues.push({ line, message: `${l.length} chars exceeds the ${HARD_LIMIT} hard limit — it is holding more than one idea` });
    }
    if (/^- never\b/.test(l)) issues.push({ line, message: 'a prohibition opens with "do not", not "never"' });
    const deny = text.match(DENY);
    if (deny) issues.push({ line, message: `deny-list word "${deny[0]}"` });
    const spelled = text.match(SPELLED_THRESHOLD);
    if (spelled) issues.push({ line, message: `"${spelled[0]}" — a threshold is a digit` });
    const limit = text.match(AMBIGUOUS_LIMIT);
    if (limit) issues.push({ line, message: `"${limit[0]}" leaves its bound open — state the limit as "<subject> <= <value> <unit>"` });
    const comp = text.match(COMPARATIVE);
    if (comp) issues.push({ line, message: `unquantified comparative "${comp[0]}" — name the property and its bound` });
  });
  return issues;
}

export { FORMS };
