// CNL-P itself — the standard, the checker and the generic profiles — lives in `cnlp-kit`. This
// adapter exists for one reason: it names this repository as a profile root, so `profiles/skill.md`
// (the 24 sections the 16 ADR skills actually use) shadows the generic profile the package ships.
// Everything else passes through untouched.
export * from 'cnlp-kit';

import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PACKAGE_ROOT, loadProfile as pkgLoadProfile, resolveDoc as pkgResolveDoc } from 'cnlp-kit';

/** This repository's root: `profiles/<name>.md` is looked up here before the package. */
export const PROFILE_ROOTS = [new URL('../../', import.meta.url)];

/** Absolute path of a CNL-P document, this repository's profiles first. */
export const resolveDoc = (name = 'format') => pkgResolveDoc(name, { roots: PROFILE_ROOTS });

/** Load a profile by name, this repository's profiles first. */
export const loadProfile = (name) => pkgLoadProfile(name, { roots: PROFILE_ROOTS });

/**
 * Every profile name `resolveDoc` can reach, this repository's and the package's, deduplicated —
 * what `ai-factory adr format <unknown>` lists back at the caller.
 */
export async function profileNames() {
  const names = new Set();
  for (const root of [...PROFILE_ROOTS, PACKAGE_ROOT]) {
    const dir = fileURLToPath(new URL('profiles/', root));
    for (const f of await readdir(dir).catch(() => [])) {
      if (f.endsWith('.md')) names.add(f.slice(0, -3));
    }
  }
  return [...names].sort();
}
