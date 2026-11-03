import { spawnSync } from 'node:child_process';
import { readFile, readdir, rmdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKAGE_ROOT } from 'cnlp-kit';
import { AGENT_BLOCK, CONFIG_NAME, filesFor } from 'cnlp-kit/config';
import { PROFILE_ROOTS } from './artifacts/cnlp.js';
import { STATUS_DIRS, adrRoot, liveFile } from './config/paths.js';
import { atomicWrite } from './util/safe-path.js';

// `npx cnlp` in a project resolves no copy bundled under `.ai-factory/extensions/`: it finds a global
// install of another version, or asks the registry for a package named `cnlp`. Every call goes here.
export const CNLP_BIN = fileURLToPath(new URL('bin/cnlp.js', PACKAGE_ROOT));
const PROFILES = fileURLToPath(new URL('profiles', PROFILE_ROOTS[0]));
const AIF_TO_CNLP = { claude: 'claude-code', codex: 'codex' };
export const BLOCK_BEGIN = '<!-- ai-factory-adr-extension:cnlp -->';
export const BLOCK_END = '<!-- /ai-factory-adr-extension:cnlp -->';

const posix = (p) => p.split(path.sep).join('/');

/** Run the bundled `cnlp` with `args`; returns the `spawnSync` result. */
export function runCnlp(args, { cwd = process.cwd(), stdio = 'inherit' } = {}) {
  return spawnSync(process.execPath, [CNLP_BIN, ...args], { cwd, stdio, encoding: 'utf8' });
}

/** cnlp-kit's agent block, calling the bundled `cnlp` through this extension. */
export const agentBlock = () => AGENT_BLOCK.map((l) => l.replaceAll('npx cnlp', 'ai-factory adr cnlp'));

/**
 * Add to `cnlp.config.json` the corpus entries this extension owns — `LIVE.md` and the accepted and
 * active ADRs — once a file matches each: `cnlp check` refuses a glob matching no file. Entries the project wrote stay as
 * they are. A config is created only when 1 entry matches, since an empty corpus fails the check too.
 */
export async function syncCorpus(projectDir = process.cwd()) {
  const at = path.join(projectDir, CONFIG_NAME);
  const existed = existsSync(at);
  const ours = posix(path.relative(projectDir, PROFILES));
  const cfg = existed ? JSON.parse(await readFile(at, 'utf8')) : { profiles: ours, corpus: [] };
  cfg.corpus ??= [];
  const rel = (abs) => posix(path.relative(projectDir, abs));
  const root = rel(await adrRoot(projectDir));
  // `adr validate` makes a format issue an error only once an ADR is accepted or active; `cnlp check`
  // fails on every issue, so a proposal still being improved stays out of the corpus.
  const owned = [{ profile: 'adr', glob: `${root}/{accepted,active}/*.md` }];
  // `live` is a profile of this extension: only a config reading its profiles directory reaches it.
  if (cfg.profiles === ours) owned.unshift({ profile: 'live', glob: rel(await liveFile(projectDir)) });

  // 5.1.0 wrote an ADR entry over every status directory; it gives way to the entry above.
  const legacy = `${root}/{${STATUS_DIRS.join(',')}}/*.md`;
  const kept = cfg.corpus.filter((e) => e.glob !== legacy);
  const removed = cfg.corpus.length - kept.length;
  cfg.corpus = kept;

  const added = [];
  for (const entry of owned) {
    if (cfg.corpus.some((e) => e.glob === entry.glob)) continue;
    if ((await filesFor(entry, projectDir)).length) added.push(entry);
  }
  if (!existed && !added.length) return { path: at, status: 'skipped', added };
  const changed = added.length > 0 || removed > 0;
  if (changed) {
    cfg.corpus.push(...added);
    await atomicWrite(at, `${JSON.stringify(cfg, null, 2)}\n`);
  }
  return { path: at, status: existed ? (changed ? 'updated' : 'present') : 'created', added };
}

/**
 * Install the cnlp-kit skills for the agents `.ai-factory.json` names, through `cnlp init`. It
 * replaces only its own skill directories, so the AI Factory skills beside them stay untouched.
 */
export async function installCnlpSkills(projectDir = process.cwd()) {
  let agents = [];
  try {
    const marker = JSON.parse(await readFile(path.join(projectDir, '.ai-factory.json'), 'utf8'));
    agents = [...new Set((marker.agents ?? []).map((a) => AIF_TO_CNLP[a.id]).filter(Boolean))];
  } catch {
    // no marker: install for no agent
  }
  // `cnlp init` creates `cnlp/profiles/` for a project's own profiles; this one reads the extension's.
  const scratch = path.join(projectDir, 'cnlp');
  const hadScratch = existsSync(scratch);
  const res = runCnlp(['init', projectDir, '--agents', agents.join(',')], { cwd: projectDir, stdio: 'pipe' });
  if (res.status !== 0) throw new Error(`cnlp init failed: ${(res.stderr || res.stdout || String(res.error)).trim()}`);
  if (!hadScratch) {
    for (const dir of [path.join(scratch, 'profiles'), scratch]) {
      if (existsSync(dir) && (await readdir(dir)).length === 0) await rmdir(dir);
    }
  }
  return { agents };
}

/** Write the agent block into `AGENTS.md` between its markers: append it once, then replace it in place. */
export async function writeAgentBlock(projectDir = process.cwd()) {
  const at = path.join(projectDir, 'AGENTS.md');
  const raw = existsSync(at) ? await readFile(at, 'utf8') : null;
  const eol = raw?.includes('\r\n') ? '\r\n' : '\n';
  const block = [BLOCK_BEGIN, '## CNL-P documents', '', ...agentBlock(), BLOCK_END].join(eol);
  let next;
  if (raw === null) {
    next = `# AGENTS.md${eol}${eol}${block}${eol}`;
  } else {
    const start = raw.indexOf(BLOCK_BEGIN);
    const end = start >= 0 ? raw.indexOf(BLOCK_END, start) : -1;
    next = end >= 0
      ? raw.slice(0, start) + block + raw.slice(end + BLOCK_END.length)
      : `${raw.replace(/\s*$/, '')}${eol}${eol}${block}${eol}`;
  }
  if (next === raw) return { path: at, status: 'present' };
  await atomicWrite(at, next);
  return { path: at, status: raw === null ? 'created' : 'updated' };
}
