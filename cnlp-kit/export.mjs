#!/usr/bin/env node
// Copy the CNL-P format into another repository.
//
//   node cnlp-kit/export.mjs <target> [--skills-dir <dir>] [--no-test] [--force]
//
// It reads the live files of this repository rather than a second copy of them, so the kit
// cannot drift from the standard it exports. Everything project-specific — the vocabulary in
// `custom_sections`, the rubric content — is seeded and then authored in the target.

import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const KIT = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(KIT, '..');

// The kit occupies 2 entries at the target root and nothing else: `cnlp/` holds everything it
// brings, `cnlp-migrate/` holds the skill so it can be moved into whichever agent runs it.
// Deleting `cnlp/` when the migration is over leaves the root as it was.
const HOME = 'cnlp';
const SKILL = 'cnlp-migrate';

export const ZIP = 'cnlp-kit.zip'; // at the repository root, gitignored, rebuilt on `npm version`

/**
 * Build the kit into a temp directory and pack it. The archive is the target project's tree,
 * so unpacking it at a project root puts every file where the README says it is.
 */
export async function buildZip(out = path.join(REPO, ZIP)) {
  const { default: AdmZip } = await import('adm-zip');
  const staging = await mkdtemp(path.join(os.tmpdir(), 'cnlp-kit-build-'));
  const { written } = await exportKit(staging, { bundleReadme: true });
  const zip = new AdmZip();
  zip.addLocalFolder(staging);
  zip.writeZip(out);
  return { out, entries: written };
}

// Where the *target's own* skills are, which is what the check reads. It has nothing to do
// with where `cnlp-migrate` is put: that folder is moved into whichever agent runs it.
const SKILLS = 'skills';

export async function exportKit(target, { skillsDir = SKILLS, test = true, force = false, bundleReadme = false } = {}) {
  const written = [];
  const skipped = [];

  const put = async (to, contents, { keep = false } = {}) => {
    const abs = path.join(target, to);
    if (keep && !force && existsSync(abs)) { skipped.push(to); return; }
    await mkdir(path.dirname(abs), { recursive: true });
    if (typeof contents === 'string') await writeFile(abs, contents, 'utf8');
    else await copyFile(contents.from, abs);
    written.push(to);
  };

  // The rules and the checker: content verbatim from the live files, paths retargeted.
  await put(`${HOME}/cnlp-format.md`, { from: path.join(REPO, 'docs/cnlp-format.md') });
  await put(`${HOME}/profiles/profile.md`, { from: path.join(REPO, 'profiles/profile.md') });
  await put(`${HOME}/cnlp.js`, retargetChecker(await readFile(path.join(REPO, 'src/artifacts/cnlp.js'), 'utf8')));

  // The values: seeded, then authored in the target. An authored profile is never overwritten.
  await put(`${HOME}/profiles/skill.md`, { from: path.join(KIT, 'seed/profiles/skill.md') }, { keep: true });
  await put(`${HOME}/quality-rules.md`, { from: path.join(KIT, 'seed/quality_rules.md') }, { keep: true });
  await put(`${SKILL}/SKILL.md`, { from: path.join(KIT, `seed/skills/${SKILL}/SKILL.md`) }, { keep: true });

  if (test) {
    const src = await readFile(path.join(REPO, 'test/skill-format.test.js'), 'utf8');
    await put(`${HOME}/skill-format.test.js`, retargetTest(src, skillsDir), { keep: true });
  }

  // Only the archive carries it: someone unpacking a zip has no other place to start.
  if (bundleReadme) {
    const { version } = JSON.parse(await readFile(path.join(REPO, 'package.json'), 'utf8'));
    const readme = await readFile(path.join(KIT, 'seed/BUNDLE-README.md'), 'utf8');
    await put(`${HOME}/README.md`, readme.replace(/__VERSION__/g, version));
  }

  return { written, skipped, skillsDir, test };
}

/**
 * In the kit the standard and the profiles sit beside the checker rather than 2 levels above
 * it, so `resolveDoc` looks next to itself. Content is untouched; only the 2 path expressions
 * change, and `test/kit.test.js` imports the result and resolves every document through it.
 */
function retargetChecker(src) {
  return src
    .replace("'docs/cnlp-format.md'", "'cnlp-format.md'")
    .replace('`../../${rel}`', '`./${rel}`');
}

/**
 * The exported check sits in `cnlp/`, 1 level under the target root, so `repoRoot` still lands
 * on the project. It differs from ours in the checker's path and in `SKILLS_DIR`, and it drops
 * the blocks marked `cnlp-kit:strip` — guards about shipping skills inside an npm package,
 * which do not hold for a repository that keeps its skills next to its standard.
 */
function retargetTest(src, skillsDir) {
  return src
    .replace(/\n\/\/ cnlp-kit:strip-start[\s\S]*?\/\/ cnlp-kit:strip-end\n/g, '\n')
    .replace("'../src/artifacts/cnlp.js'", "'./cnlp.js'")
    .replace(/^const SKILLS_DIR = '[^']*';/m, `const SKILLS_DIR = '${skillsDir}';`);
}

const argv = process.argv.slice(2);
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (argv.includes('--zip')) {
    const { out, entries } = await buildZip();
    for (const f of entries) console.log(`  packed   ${f}`);
    console.log(`\n${path.relative(REPO, out)} — copy it to another project and unpack at its root.`);
    process.exit(0);
  }
  const target = argv.find((a) => !a.startsWith('--'));
  if (!target) {
    console.error('usage: node cnlp-kit/export.mjs --zip');
    console.error('       node cnlp-kit/export.mjs <target> [--skills-dir <dir>] [--no-test] [--force]');
    process.exit(1);
  }
  const at = argv.indexOf('--skills-dir');
  const res = await exportKit(path.resolve(target), {
    skillsDir: at >= 0 ? argv[at + 1] : undefined,
    test: !argv.includes('--no-test'),
    force: argv.includes('--force'),
  });
  for (const f of res.written) console.log(`  written  ${f}`);
  for (const f of res.skipped) console.log(`  kept     ${f} (already authored; --force overwrites)`);
  console.log(`\nNext: read docs/cnlp-format.md, then run cnlp-migrate from ${res.skillsDir}/.`);
}
