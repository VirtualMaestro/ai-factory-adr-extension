import { existsSync } from 'node:fs';
import { read } from '../artifacts/frontmatter.js';
import { isValidId, stemMatchesId } from '../artifacts/id.js';
import { isValidStatus, validateDirStatus } from './status.js';
import { isDocumentationOnly } from './finalize.js';
import { findPlaceholders } from '../artifacts/placeholders.js';
import { resolveActivePlan } from '../artifacts/plan.js';
import { resolveInside } from '../util/safe-path.js';

const EVIDENCE_RE = /- \*\*Evidence:\*\* (?!not implemented\b)\S/;
const DOC_ONLY_RE = /documentation-only|not required/i;

/**
 * ADR-specific invariant checks (§21). Deliberately does NOT re-check what `audit-artifacts` owns
 * (project-wide duplicate ids, relation targets, cycles — inv 1 global). Returns { errors, warnings }.
 */
export async function validateAdr(file, { projectDir = process.cwd() } = {}) {
  const errors = [];
  const warnings = [];
  const abs = resolveInside(projectDir, file);

  if (!existsSync(abs)) return { errors: [`File not found: ${file}`], warnings };

  let data, body;
  try {
    ({ data, body } = await read(abs));
  } catch (err) {
    return { errors: [err.message], warnings };
  }

  if (data.type !== 'adr') errors.push(`type must be "adr" (got ${JSON.stringify(data.type)})`); // inv 2
  if (!isValidId(data.id)) errors.push(`invalid or missing id: ${JSON.stringify(data.id)}`); // inv 1
  else if (!stemMatchesId(abs, data.id)) errors.push(`filename stem must equal id "${data.id}"`); // inv 3

  if (!isValidStatus(data.status)) {
    errors.push(`unknown status: ${JSON.stringify(data.status)}`);
    return { errors, warnings }; // remaining checks depend on a valid status
  }

  const dir = validateDirStatus(abs, data.status); // inv 4
  if (!dir.ok) errors.push(`status "${data.status}" expects directory "${dir.expectedDir}/", found "${dir.actualDir}/"`);

  if (data.status === 'accepted' || data.status === 'active') {
    const found = findPlaceholders(body); // inv 6
    if (found.length) errors.push(`unresolved placeholders: ${found.join(', ')}`);
    try {
      await resolveActivePlan(data.id, { projectDir }); // inv 7 (throws on >1)
    } catch (err) {
      errors.push(err.message.split('\n')[0]);
    }
  }

  if (data.status === 'active' && !EVIDENCE_RE.test(body) && !DOC_ONLY_RE.test(body)) {
    errors.push('active ADR must record implementation evidence or state documentation-only'); // inv 10
  }

  if (
    data.status === 'active' &&
    !isDocumentationOnly(body) &&
    (!Array.isArray(data.code) || data.code.length === 0)
  ) {
    warnings.push('active ADR has empty code anchors (list primary entry points in `code:` or mark documentation-only)');
  }

  if (data.status === 'superseded' && !/- \*\*Replaced by:\*\* (?!—)\S/.test(body)) {
    errors.push('superseded ADR must reference its replacement (Replaced by)'); // inv 11
  }

  return { errors, warnings };
}
