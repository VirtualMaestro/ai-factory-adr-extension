import path from 'node:path';

// §15: `adr-` prefix, lowercase slug, hyphen-separated alphanumerics.
export const ID_RE = /^adr-[a-z0-9]+(-[a-z0-9]+)*$/;

/** Derive a stable ADR id from a free-text topic (§15). Created once; never re-derived on move. */
export function slugToId(topic) {
  let slug = String(topic)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.startsWith('adr-')) slug = slug.slice(4);
  if (!slug) throw new Error(`Cannot derive an ADR id from: ${JSON.stringify(topic)}`);
  return `adr-${slug}`;
}

export function isValidId(id) {
  return ID_RE.test(String(id ?? ''));
}

/** inv 3: the filename stem must equal the ADR id. */
export function stemMatchesId(file, id) {
  return path.basename(file, '.md') === id;
}
