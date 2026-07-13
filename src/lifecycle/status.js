import path from 'node:path';

// §14: status ↔ directory correspondence. Directory names are plural; statuses singular.
export const DIR_BY_STATUS = {
  proposed: 'proposals',
  draft: 'drafts',
  accepted: 'accepted',
  active: 'active',
  superseded: 'superseded',
};

export const STATUS_BY_DIR = Object.fromEntries(
  Object.entries(DIR_BY_STATUS).map(([status, dir]) => [dir, status]),
);

export const STATUSES = Object.keys(DIR_BY_STATUS);

export function isValidStatus(status) {
  return Object.prototype.hasOwnProperty.call(DIR_BY_STATUS, status);
}

/**
 * inv 4: the directory a file lives in must match its frontmatter status.
 * Returns { ok, expectedDir, actualDir }.
 */
export function validateDirStatus(file, status) {
  const expectedDir = DIR_BY_STATUS[status];
  const actualDir = path.basename(path.dirname(path.resolve(file)));
  return { ok: expectedDir === actualDir, expectedDir, actualDir };
}
