// Unresolved template tokens (see templates/adr.md). inv 6: accepted/active ADRs must contain none.
// Em-dash reference defaults are intentionally excluded — they are legitimately empty on many ADRs.
export const SENTINELS = ['not created', 'not implemented', '[decision]', '[scope]', '[main reason]', '[Alternative]'];

/** Template placeholders still present in an ADR body. */
export function findPlaceholders(body) {
  return SENTINELS.filter((s) => body.includes(s));
}
