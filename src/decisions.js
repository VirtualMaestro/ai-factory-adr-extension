import path from 'node:path';
import { adrRoot } from './config/paths.js';
import { read } from './artifacts/frontmatter.js';
import { isValidId } from './artifacts/id.js';
import { parseBlocks, itemsOf, loadProfile } from './artifacts/cnlp.js';
import { listAdrs } from './status.js';
import { STATUS_BY_DIR } from './lifecycle/status.js';

/**
 * The standing body of obligations, compressed. `decision:`, `constraints:`, `scope:` and
 * `rules:` are required blocks of every accepted or active ADR (profiles/adr.md), so the
 * digest is derivable without an LLM — that is the whole point: an agent about to write a
 * decision reads all of them for the price of one ADR file.
 *
 * Deliberately NOT `validateAdr` or `bodyIssues`: the first walks the plans directory per ADR
 * and diagnoses ADR↔plan links, the second appends the lexicon checks (cnlp.js, lexiconIssues).
 * Neither belongs in a summary of what the project has already decided.
 */
// ponytail: whole corpus per read; slice by affects/code past ~800 printed lines.
const STATUSES = ['accepted', 'active'];
const REQUIRED = ['decision', 'constraints', 'scope', 'rules'];
const MARKER = /^\s*(?:[-*]|\d+\.)\s+/;

const asArray = (v) => (Array.isArray(v) ? v.map(String) : v == null || v === '' ? [] : [String(v)]);

function readBody(body, forms) {
  const { lines, sections } = parseBlocks(body);
  const out = { malformed: [] };
  for (const key of REQUIRED) {
    const found = sections.filter((s) => s.key === key);
    // Two blocks of one name would be silently truncated to the first: the digest would
    // claim completeness while dropping half the obligations.
    if (found.length > 1) out.malformed.push(`block "${key}:" appears more than 1 time`);
    if (!found.length) {
      out[key] = [];
      continue;
    }
    const section = found[0];
    const items = itemsOf(lines, section.line)
      .map((i) => i.text.replace(MARKER, '').trim())
      .filter((t) => t !== '');
    // A block written in the wrong form loses content silently: `constraints: first` with
    // `- second` under it keeps only `first`. The profile says which form each block takes,
    // so ask it rather than assume — and when the form is wrong, take everything anyway, so
    // a malformed block is reported rather than quietly halved.
    const scalar = forms.get(key) === 'scalar';
    if (scalar ? !section.value || items.length : Boolean(section.value)) {
      out.malformed.push(`block "${key}:" is not the ${forms.get(key)} its profile declares`);
    }
    out[key] = section.value ? [section.value, ...items] : items;
  }
  out.excludes = out.scope.filter((s) => /^excludes:/.test(s)).map((s) => s.slice('excludes:'.length).trim());
  out.scope = out.scope.filter((s) => !/^excludes:/.test(s));
  return out;
}

/**
 * Every accepted and active ADR, reduced to what it obliges. Returns { items, issues }:
 * `issues` are [{ code, file, message }] and never a reason to fail — the caller decides
 * (`ai-factory adr decisions` always exits 0; the skills read the codes and stop or continue).
 */
export async function buildDecisions({ projectDir = process.cwd() } = {}) {
  const root = await adrRoot(projectDir);
  const profile = await loadProfile('adr');
  const forms = new Map(profile.sections.map((s) => [s.key, s.form]));
  // Forward slashes on every platform, as `runAudit` does: the digest is read as a document,
  // and its paths sit beside `code:` anchors that are authored with `/`.
  const rel = (f) => path.relative(projectDir, f).split(path.sep).join('/');
  const items = [];
  const issues = [];
  const add = (code, file, message) => issues.push({ code, file, message });

  for (const { dir, file } of await listAdrs(root)) {
    const status = STATUS_BY_DIR[dir];
    if (!STATUSES.includes(status)) continue;

    let data, body;
    try {
      ({ data, body } = await read(file));
    } catch (err) {
      add('unreadable', rel(file), err.message);
      continue;
    }

    const parsed = readBody(body, forms);
    items.push({
      id: String(data.id ?? ''),
      status,
      file: rel(file),
      // The anchors keep their `#symbol`: it tells the reader where to look, and nothing
      // machine-matches these paths any more.
      affects: asArray(data.affects),
      decision: parsed.decision[0] ?? '',
      constraints: parsed.constraints,
      scope: parsed.scope,
      excludes: parsed.excludes,
      rules: parsed.rules,
      depends_on: asArray(data.depends_on),
      code: asArray(data.code),
      _yamlStatus: data.status,
      _malformed: parsed.malformed,
    });
  }

  // `readdir` order is platform-dependent, and `id` alone does not separate a duplicated one.
  items.sort((a, b) => a.id.localeCompare(b.id) || a.file.localeCompare(b.file));

  const byId = new Map();
  for (const it of items) byId.set(it.id, [...(byId.get(it.id) ?? []), it.file]);

  for (const it of items) {
    if (!isValidId(it.id)) add('invalid-id', it.file, `id ${JSON.stringify(it.id)} is missing or malformed`);
    const dupes = byId.get(it.id) ?? [];
    if (isValidId(it.id) && dupes.length > 1) add('duplicate-id', it.file, `id "${it.id}" is also used by ${dupes.filter((f) => f !== it.file).join(', ')}`);
    if (it._yamlStatus !== it.status) add('status-mismatch', it.file, `frontmatter status ${JSON.stringify(it._yamlStatus)} against directory "${it.status}"`);
    for (const message of it._malformed) add('invalid-block', it.file, message);
    for (const key of REQUIRED) {
      const empty = key === 'decision' ? !it.decision : it[key].length === 0;
      if (empty && !it._malformed.some((m) => m.includes(`"${key}:"`))) add('empty-block', it.file, `block "${key}:" is empty or absent`);
    }
    delete it._yamlStatus;
    delete it._malformed;
  }

  issues.sort((a, b) => a.file.localeCompare(b.file) || a.code.localeCompare(b.code));
  return { items, issues };
}

/** The digest as printed lines, without the trailing count. */
export function renderDecisions(items) {
  const lines = [];
  for (const it of items) {
    lines.push(`${it.id}  [${it.status}]  ${it.file}`);
    if (it.decision) lines.push(`  decision: ${it.decision}`);
    if (it.constraints.length) {
      lines.push('  constraints:');
      for (const c of it.constraints) lines.push(`    - ${c}`);
    }
    if (it.scope.length || it.excludes.length) {
      lines.push('  scope:');
      for (const s of it.scope) lines.push(`    - ${s}`);
      for (const e of it.excludes) lines.push(`    excludes: ${e}`);
    }
    if (it.rules.length) {
      lines.push('  rules:');
      it.rules.forEach((r, i) => lines.push(`    ${i + 1}. ${r.replace(/^\d+\.\s*/, '')}`));
    }
    const tail = [
      it.affects.length ? `affects: ${it.affects.join(', ')}` : null,
      it.depends_on.length ? `depends_on: ${it.depends_on.join(', ')}` : null,
      it.code.length ? `code: ${it.code.join(', ')}` : null,
    ].filter(Boolean);
    if (tail.length) lines.push(`  ${tail.join(' · ')}`);
  }
  return lines;
}
