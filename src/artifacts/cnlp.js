// CNL-P itself — the standard, the checker and the generic profiles — lives in `cnlp-kit`. This
// adapter exists for one reason: it names this repository as a profile root, so `profiles/skill.md`
// (the sections the ADR skills use) shadows the generic profile the package ships,
// and the live and plan profiles resolve at all. Everything else passes through
// untouched.
export * from 'cnlp-kit';

import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PACKAGE_ROOT, loadProfile as pkgLoadProfile, resolveDoc as pkgResolveDoc } from 'cnlp-kit';

/** This repository's root, where its own profiles sit. */
export const PROFILE_ROOTS = [new URL('../../', import.meta.url)];

// The profiles this repository owns: `skill`, `live` and `plan`. Every other name resolves inside
// the package and nowhere else — ai-factory updates an extension by copying over the install
// directory without emptying it first, so a `profiles/adr.md` from a version that still shipped
// one lingers there forever. Searching this root for every name would let that orphan outrank the
// package indefinitely.
const OWNED = new Set(['skill', 'live', 'plan']);

const rootsFor = (name) => (OWNED.has(name) ? PROFILE_ROOTS : []);

/** Absolute path of a CNL-P document: a profile owned here if it is asked for, else the package. */
export const resolveDoc = (name = 'format') => pkgResolveDoc(name, { roots: rootsFor(name) });

/** Load a profile by name: one owned here from this repository, everything else from the package. */
export const loadProfile = (name) => pkgLoadProfile(name, { roots: rootsFor(name) });

/**
 * Every profile name `resolveDoc` can reach — what `ai-factory adr format <unknown>` lists back at
 * the caller. Read out of the package plus the names owned here, never by listing the install
 * directory, which may still hold profiles from an earlier version of this extension.
 */
export async function profileNames() {
  const dir = fileURLToPath(new URL('profiles/', PACKAGE_ROOT));
  const packaged = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.md'));
  return [...new Set([...packaged.map((f) => f.slice(0, -3)), ...OWNED])].sort();
}
