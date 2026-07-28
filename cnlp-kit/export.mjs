#!/usr/bin/env node
// Copy the CNL-P format into another repository.
//
//   node cnlp-kit/export.mjs <target> [--skills-dir <dir>] [--no-test] [--force]
//
// It reads the live files of this repository rather than a second copy of them, so the kit
// cannot drift from the standard it exports. Everything project-specific — the vocabulary in
// `custom_sections`, the rubric content — is seeded and then authored in the target.

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const KIT = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(KIT, '..');

// `tools/cnlp/cnlp.js` sits 2 levels under the target root, the same depth as
// `src/artifacts/cnlp.js` here, so `resolveDoc`'s `../../` resolves without a rewrite.
const CHECKER_DIR = 'tools/cnlp';

export async function exportKit(target, { skillsDir = '.claude/skills', test = true, force = false } = {}) {
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

  // The rules and the checker: verbatim, straight from the live files.
  await put('docs/cnlp-format.md', { from: path.join(REPO, 'docs/cnlp-format.md') });
  await put('profiles/profile.md', { from: path.join(REPO, 'profiles/profile.md') });
  await put(`${CHECKER_DIR}/cnlp.js`, { from: path.join(REPO, 'src/artifacts/cnlp.js') });

  // The values: seeded, then authored in the target. An authored profile is never overwritten.
  await put('profiles/skill.md', { from: path.join(KIT, 'seed/profiles/skill.md') }, { keep: true });
  await put('docs/cnlp-quality-rules.md', { from: path.join(KIT, 'seed/quality_rules.md') }, { keep: true });
  await put(`${skillsDir}/cnlp-migrate/SKILL.md`, { from: path.join(KIT, 'seed/skills/cnlp-migrate/SKILL.md') }, { keep: true });

  if (test) {
    const src = await readFile(path.join(REPO, 'test/skill-format.test.js'), 'utf8');
    await put('test/skill-format.test.js', retarget(src, skillsDir), { keep: true });
  }

  return { written, skipped, skillsDir, test };
}

/**
 * The exported test differs from ours in where the checker and the skills live, and it drops
 * the blocks marked `cnlp-kit:strip` — guards about shipping skills inside an npm package,
 * which do not hold for a repository that keeps its skills next to its standard.
 */
function retarget(src, skillsDir) {
  return src
    .replace(/\n\/\/ cnlp-kit:strip-start[\s\S]*?\/\/ cnlp-kit:strip-end\n/g, '\n')
    // test/ sits 1 level under the target root, as it does here
    .replace("'../src/artifacts/cnlp.js'", `'../${CHECKER_DIR}/cnlp.js'`)
    .replace(/path\.join\(repoRoot, 'skills'\)/g, `path.join(repoRoot, '${skillsDir}')`)
    .replace(/path\.join\(repoRoot, 'skills', name, 'SKILL\.md'\)/g, `path.join(repoRoot, '${skillsDir}', name, 'SKILL.md')`);
}

const argv = process.argv.slice(2);
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = argv.find((a) => !a.startsWith('--'));
  if (!target) {
    console.error('usage: node cnlp-kit/export.mjs <target> [--skills-dir <dir>] [--no-test] [--force]');
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
