// The mechanical half of docs/cnlp-format.md, shared by the skills conformance test
// (test/skill-format.test.js, skills profile) and `ai-factory adr validate` (ADR profile, §7).
// Grammar and lexicon only — neither caller can judge whether a bullet says something useful.

export const DENY = /\b(surface[sd]?|sharpen[s]?|weigh[s]?|leverage[sd]?|robust|sanity-check|ensure[sd]?)\b/i; // §8
const NUM = '(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten)';
/** §8 skills profile: a threshold is a digit. */
export const SPELLED_THRESHOLD = /\b(at least|exactly|more than|fewer than|no more than|only) (one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
/** §8 ADR profile: a limit is written as a comparison, digit or word form alike. */
export const PROSE_LIMIT = new RegExp(`\\b(?:at least|at most|no more than|no fewer than|not more than|not less than|more than|fewer than|less than|greater than|up to|not exceed(?:ing)?)\\s+${NUM}\\b`, 'i');
/** §8 ADR profile: an unquantified comparative is not a decision. */
export const COMPARATIVE = /\b(better|faster|cleaner|significantly|substantially|flexible|scalable|extensible|where possible|if needed|as appropriate|should probably|may want to)\b/i;
export const HARD_LIMIT = 250; // §4: 150 is the target, 250 is compound whatever it claims

// §7 blocks, in the order they appear in an ADR body.
const ADR_ORDER = ['problem', 'constraints', 'decision_drivers', 'decision', 'scope', 'rules',
  'alternatives', 'positive', 'negative', 'risks', 'blast_radius'];
const ADR_REQUIRED = ADR_ORDER.filter((k) => k !== 'blast_radius');
const ADR_OPTIONAL = ['out_of_scope', 'unproven_hypothesis', 'increment_order'];
const ADR_HEADINGS = ['## Context', '## Decision', '## Alternatives considered', '## Consequences'];
// §7: these belong to the frontmatter; a body copy goes stale.
const MACHINE_FIELDS = ['code', 'issue', 'plan', 'evidence', 'depends_on', 'affects', 'supersedes', 'replaced_by', 'id', 'type', 'status', 'owners'];
const ALT_REQUIRED = ['id', 'description', 'rejected_because'];
const ALT_KEYS = [...ALT_REQUIRED, 'kept_as'];

/**
 * Body split into lines, top-level `key:` sections and `##` headings, with fenced regions
 * blanked — §3: a fence is opaque, its contents are data and never section keys.
 * Leading frontmatter is stripped when present. Line numbers are 1-based within the body.
 */
export function parseBlocks(raw) {
  const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  let fenced = false;
  const lines = body.split(/\r?\n/).map((l) => {
    if (/^\s*```/.test(l)) { fenced = !fenced; return ''; }
    return fenced ? '' : l;
  });
  const sections = [];
  const headings = [];
  lines.forEach((l, i) => {
    const key = l.match(/^([a-z_]+):(.*)$/);
    if (key) sections.push({ key: key[1], value: key[2].trim(), line: i + 1 });
    if (/^##\s/.test(l)) headings.push({ text: l.trim(), line: i + 1 });
  });
  return { lines, sections, headings };
}

/** Lines of a section: everything up to the next top-level key or `##` heading. */
function itemsOf(lines, at) {
  const out = [];
  for (let i = at; i < lines.length; i += 1) {
    if (/^([a-z_]+):/.test(lines[i]) || /^##\s/.test(lines[i])) break;
    if (lines[i].trim() !== '') out.push({ text: lines[i], line: i + 1 });
  }
  return out;
}

/**
 * ADR body conformance with §7 and the ADR half of §8. Returns [{ line, message }]; the
 * caller decides the severity (`validate` warns before `accepted`, errors from it on).
 */
export function adrBodyIssues(raw) {
  const { lines, sections, headings } = parseBlocks(raw);
  const issues = [];
  const at = (line, message) => issues.push({ line, message });

  const seenHeadings = headings.map((h) => h.text);
  for (const want of ADR_HEADINGS) {
    if (!seenHeadings.includes(want)) at(0, `missing heading "${want}" (§7)`);
  }

  const keys = sections.map((s) => s.key);
  for (const block of ADR_REQUIRED) {
    if (!keys.includes(block)) at(0, `missing required block "${block}:" (§7)`);
  }

  const known = new Set([...ADR_ORDER, ...ADR_OPTIONAL]);
  for (const { key, line } of sections) {
    if (known.has(key)) continue;
    if (MACHINE_FIELDS.includes(key)) at(line, `"${key}:" is a frontmatter field, not a body block (§7)`);
    else at(line, `unknown block "${key}:" — reuse a §7 block name`);
  }

  const ordered = keys.filter((k) => ADR_ORDER.includes(k));
  const sorted = [...ordered].sort((a, b) => ADR_ORDER.indexOf(a) - ADR_ORDER.indexOf(b));
  if (ordered.join() !== sorted.join()) at(0, `blocks out of order — §7 order is ${ADR_ORDER.join(', ')}`);

  for (const { key, value, line } of sections) {
    if (!known.has(key)) continue;
    const items = itemsOf(lines, line);
    if (key === 'decision') {
      if (!value) at(line, '"decision:" is a scalar — its value goes on the key line (§3)');
      continue;
    }
    if (value) at(line, `"${key}:" carries a value on the key line but is not a scalar block (§3)`);
    else if (items.length === 0) at(line, `"${key}:" is empty — a required block states "- none" with the reason, an optional one is deleted (§7)`);
    if (key === 'rules' || key === 'increment_order') {
      const bad = items.find((i) => !/^\d+\. /.test(i.text));
      if (bad) at(bad.line, `"${key}:" is a numbered-list — every item opens with "N. " (§3)`);
    } else if (key === 'alternatives') {
      issues.push(...alternativesIssues(items));
    } else if (ADR_ORDER.includes(key)) {
      const bad = items.find((i) => !/^- /.test(i.text));
      if (bad) at(bad.line, `"${key}:" is a bullet-list — every item opens with "- " (§3)`);
    }
  }

  issues.push(...lexiconIssues(lines, 'adr'));
  return issues.sort((a, b) => a.line - b.line);
}

/** §3 record-list plus the §7 key set: `id`, `description`, `rejected_because`, optional `kept_as`. */
function alternativesIssues(items) {
  const issues = [];
  let record = null;
  const close = () => {
    if (!record) return;
    for (const want of ALT_REQUIRED) {
      if (!record.keys.includes(want)) issues.push({ line: record.line, message: `alternative is missing "${want}:" (§7)` });
    }
    record = null;
  };
  for (const { text, line } of items) {
    const open = text.match(/^- ([a-z_]+):/);
    const sub = text.match(/^ {2}([a-z_]+):/);
    if (open) {
      close();
      record = { line, keys: [open[1]] };
      if (open[1] !== 'id') issues.push({ line, message: 'an alternative record opens with "- id: <slug>" (§7)' });
    } else if (sub && record) {
      record.keys.push(sub[1]);
      if (!ALT_KEYS.includes(sub[1])) issues.push({ line, message: `"${sub[1]}" is not an alternative key — §7 allows ${ALT_KEYS.join(', ')}` });
    } else {
      issues.push({ line, message: 'an alternatives item is a record: "- id: …" then two-space-indented keys (§3)' });
    }
  }
  close();
  return issues;
}

/** §8 lexicon over body lines. `profile` picks the threshold rule that applies. */
export function lexiconIssues(lines, profile) {
  const issues = [];
  lines.forEach((l, i) => {
    const line = i + 1;
    if (/^(-|\d+\.) /.test(l) && l.length > HARD_LIMIT) {
      issues.push({ line, message: `${l.length} chars exceeds the ${HARD_LIMIT} hard limit — it is holding more than one idea (§4)` });
    }
    if (/^- never\b/.test(l)) issues.push({ line, message: 'a prohibition opens with "do not", not "never" (§8)' });
    const deny = l.match(DENY);
    if (deny) issues.push({ line, message: `deny-list word "${deny[0]}" (§8)` });
    if (profile === 'adr') {
      const limit = l.match(PROSE_LIMIT);
      if (limit) issues.push({ line, message: `"${limit[0]}" — a limit is written as a comparison, e.g. "<= 2 connections per client" (§8)` });
      const comp = l.match(COMPARATIVE);
      if (comp) issues.push({ line, message: `unquantified comparative "${comp[0]}" — name the property and its bound (§8)` });
    } else {
      const spelled = l.match(SPELLED_THRESHOLD);
      if (spelled) issues.push({ line, message: `"${spelled[0]}" — a threshold is a digit (§8)` });
    }
  });
  return issues;
}
