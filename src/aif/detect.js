import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');

/** Error whose message follows the §27 contract: expected / detected / untouched / next action. */
export class AifError extends Error {}

function parseVersion(v) {
  const m = String(v).trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function cmp(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return 0;
}

// ponytail: supports the documented `>=X <Y` comparator form (§29). Swap for `semver` if ranges get richer.
function satisfies(version, range) {
  const ver = parseVersion(version);
  if (!ver) return null; // unknown → caller warns
  for (const part of range.trim().split(/\s+/)) {
    const m = part.match(/^(>=|<=|>|<|=)?(\d+\.\d+\.\d+)$/);
    if (!m) continue;
    const op = m[1] || '=';
    const c = cmp(ver, parseVersion(m[2]));
    const ok = { '>=': c >= 0, '<=': c <= 0, '>': c > 0, '<': c < 0, '=': c === 0 }[op];
    if (!ok) return false;
  }
  return true;
}

async function readCompatRange() {
  try {
    return JSON.parse(await readFile(pkgPath, 'utf8')).aiFactoryCompatibility;
  } catch {
    return null;
  }
}

/**
 * Verify the cwd is an AI-Factory-initialized project and its version is compatible.
 * Throws AifError (non-initialized or known-incompatible); warns to stderr on unknown version.
 * Returns the detected AIF version (or null when unknown).
 */
export async function detectAif(projectDir = process.cwd(), { warn = console.warn } = {}) {
  const marker = path.join(projectDir, '.ai-factory.json');
  if (!existsSync(marker) && !existsSync(path.join(projectDir, '.ai-factory'))) {
    throw new AifError(
      'Not an AI Factory project.\n' +
        `  expected: .ai-factory.json or .ai-factory/ in ${projectDir}\n` +
        '  detected: neither marker present\n' +
        '  files:    nothing was changed\n' +
        '  next:     run `ai-factory init` in the project root first',
    );
  }

  let version = null;
  try {
    version = JSON.parse(await readFile(marker, 'utf8')).version ?? null;
  } catch {
    version = null; // corrupted/absent .ai-factory.json → treat version as unknown
  }

  const range = await readCompatRange();
  const result = range ? satisfies(version, range) : null;
  if (result === false) {
    throw new AifError(
      'Incompatible AI Factory version.\n' +
        `  expected: AI Factory ${range}\n` +
        `  detected: ${version}\n` +
        '  files:    nothing was changed\n' +
        '  next:     upgrade this extension or the AI Factory version to a compatible pair',
    );
  }
  if (result === null) {
    warn(`ai-factory-adr-extension: could not determine AI Factory version (found: ${version ?? 'none'}); proceeding.`);
  }
  return version;
}
