// Prepare a throwaway project that reads this corpus, so measuring the skill is 1 command
// instead of 6. The corpus itself is never copied and never written to: the project points at
// it through `adr.root`.
//
//   npm run corpus            build the project and print what to do next
//   npm run corpus -- --key   print the answer sheet, build nothing
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const ADR_ROOT = path.join(HERE, 'docs', 'adr').split(path.sep).join('/');
const WIN = process.platform === 'win32';

// shell:true so Windows resolves the `ai-factory.cmd` shim, as test/integration does. Args are
// this script's own temp paths, not input. The npm script passes --no-deprecation so DEP0190
// does not print over the instructions this script exists to give.
const aif = (args, cwd) =>
  execFileSync('ai-factory', WIN ? args.map((a) => (/\s/.test(a) ? `"${a}"` : a)) : args, {
    cwd, encoding: 'utf8', stdio: 'pipe', shell: WIN,
  });

async function printKey() {
  const expected = JSON.parse(await readFile(path.join(HERE, 'expected.json'), 'utf8'));
  const rows = [
    ...expected.contradiction.map((e) => [e.pair, 'contradiction', e.expected_follow_up]),
    ...expected.redundant.map((e) => [e.pair, 'redundant', e.expected_follow_up]),
    ...expected.shared_area.map((e) => [e.pair, 'shared-area', 'no action']),
  ];
  console.log('Answer sheet — every other pair of the 14 ADRs belongs in no row at all.\n');
  for (const [pair, verdict, follow] of rows) {
    console.log(`  ${verdict.padEnd(14)} ${pair.join(' + ')}\n${' '.repeat(17)}→ ${follow}`);
  }
  console.log('\nPass: all 3 contradictions named, and neither shared-area pair called a contradiction.');
  console.log('Fail: a contradiction missed (the metric that matters), or a shared-area pair called one.');
}

async function build() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'adr-corpus-'));
  aif(['init', '--agents', 'claude'], dir);
  aif(['extension', 'add', REPO], dir);
  aif(['adr', 'init'], dir);
  await writeFile(path.join(dir, '.ai-factory', 'adr-extension.yaml'), `adr:\n  root: ${ADR_ROOT}\n`, 'utf8');

  // A corpus that reports issues of its own would stop the skill on step 2, and the run it is
  // meant to measure would never happen.
  const digest = JSON.parse(aif(['adr', 'decisions', '--json'], dir));
  if (digest.items.length !== 14 || digest.issues.length !== 0) {
    console.error(`Corpus is not clean: ${digest.items.length} ADR (expected 14), ${digest.issues.length} issues (expected 0).`);
    for (const i of digest.issues) console.error(`  ${i.code}  ${i.file}: ${i.message}`);
    process.exit(1);
  }

  console.log(`Ready: ${digest.items.length} ADR, ${digest.issues.length} issues.\n`);
  console.log('  1. start a NEW session whose working directory is:\n');
  console.log(`       ${dir}\n`);
  console.log('     Not the repository — the `adr` subcommand exists only in a project that');
  console.log('     installed the extension, and the repository holds no ADRs of its own.\n');
  console.log('  2. in that session, run:  /aif-adr-check-consistency');
  console.log('     Do not open the fixture\'s README.md or expected.json from it: both name');
  console.log('     the conflicts, and a session that has read either cannot score the run.\n');
  console.log('  3. score it:  npm run corpus -- --key   (from the repository)\n');
  console.log('The corpus is read-only; delete the directory above when finished.');
}

await (process.argv.includes('--key') ? printKey() : build());
