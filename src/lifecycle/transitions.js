// §17 allowed transitions. `none` = creation (no source file yet).
const LEGAL = new Set([
  'none>proposed',
  'proposed>draft',
  'draft>accepted',
  'accepted>draft',
  'accepted>active',
  'active>superseded',
  'accepted>superseded',
]);

export function isLegal(from, to) {
  return LEGAL.has(`${from}>${to}`);
}

/** Statuses reachable from `from`, for error messages. */
export function legalTargets(from) {
  return [...LEGAL]
    .filter((t) => t.startsWith(`${from}>`))
    .map((t) => t.split('>')[1]);
}
