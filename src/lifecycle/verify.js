import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { read } from '../artifacts/frontmatter.js';
import { isDocumentationOnly } from './finalize.js';
import { resolveInside } from '../util/safe-path.js';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Deterministic anchor check: confirm each `code:` frontmatter anchor resolves on disk
 * (and, for a `path#symbol` anchor, that the file mentions the symbol). Read-only; never
 * touches the ADR or the code. The Decision-vs-code judgment is the `aif-adr-verify` skill's job.
 *
 * Returns { id, status, docOnly, anchors: [{ anchor, path, symbol, fileExists, symbolFound }], missing: [] }
 * where `missing` lists anchors whose file is absent (or whose `#symbol` was not found).
 */
export async function verifyAnchors(file, { projectDir = process.cwd() } = {}) {
  const abs = resolveInside(projectDir, file);
  if (!existsSync(abs)) return { errors: [`File not found: ${file}`] };

  let data;
  try {
    ({ data } = await read(abs));
  } catch (err) {
    return { errors: [err.message] };
  }

  const docOnly = isDocumentationOnly(data);
  const list = Array.isArray(data.code) ? data.code : [];
  const anchors = [];
  const missing = [];

  for (const raw of list) {
    const anchor = String(raw);
    const hash = anchor.indexOf('#');
    const relPath = hash < 0 ? anchor : anchor.slice(0, hash);
    const symbol = hash < 0 ? null : anchor.slice(hash + 1);

    let fileExists = false;
    let symbolFound = null;
    try {
      const target = resolveInside(projectDir, relPath);
      fileExists = existsSync(target);
      if (fileExists && symbol) {
        // ponytail: naive word-boundary grep for the symbol, not real parsing.
        // Upgrade to LSP / codebase-memory-mcp (deferred Phase 6) if false hits matter.
        const src = await readFile(target, 'utf8');
        symbolFound = new RegExp(`\\b${escapeRe(symbol)}\\b`).test(src);
      }
    } catch {
      fileExists = false; // path escapes the project → treat as missing
    }

    anchors.push({ anchor, path: relPath, symbol, fileExists, symbolFound });
    if (!fileExists || symbolFound === false) missing.push(anchor);
  }

  return { id: data.id, status: data.status, docOnly, anchors, missing };
}
