import { readFile } from 'node:fs/promises';
import YAML from 'yaml';

// Leading `---` YAML block, then the rest of the document (the body).
const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * Split a Markdown document into `{ data, body, hasFrontmatter }`.
 * `body` is preserved byte-for-byte; only frontmatter is re-serialized on write.
 * Throws on a frontmatter block whose YAML is malformed (§27 fail-safe).
 */
export function parse(content) {
  const m = content.match(FM_RE);
  if (!m) return { data: {}, body: content, hasFrontmatter: false };
  let data;
  try {
    data = YAML.parse(m[1]) ?? {};
  } catch (err) {
    throw new Error(`Frontmatter YAML could not be parsed: ${err.message}`);
  }
  return { data, body: m[2], hasFrontmatter: true };
}

/** Recompose a document from frontmatter `data` + untouched `body`. */
export function serialize(data, body) {
  return `---\n${YAML.stringify(data)}---\n${body}`;
}

export async function read(file) {
  return parse(await readFile(file, 'utf8'));
}
