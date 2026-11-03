import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AGENT_BLOCK } from 'cnlp-kit/config';
import { init } from '../src/init.js';
import { BLOCK_BEGIN, BLOCK_END, agentBlock, runCnlp, syncCorpus, writeAgentBlock } from '../src/cnlp-setup.js';

const tmp = () => mkdtemp(path.join(os.tmpdir(), 'adr-cnlp-'));
const config = async (dir) => JSON.parse(await readFile(path.join(dir, 'cnlp.config.json'), 'utf8'));

test('agentBlock is cnlp-kit AGENT_BLOCK calling the bundled cnlp', () => {
  assert.equal(agentBlock().length, AGENT_BLOCK.length);
  assert.ok(agentBlock().every((l) => !l.includes('npx cnlp')));
  assert.match(agentBlock()[0], /`ai-factory adr cnlp print format`/);
});

test('writeAgentBlock appends to an existing AGENTS.md, then replaces only its marked block, keeping CRLF', async () => {
  const dir = await tmp();
  const file = path.join(dir, 'AGENTS.md');
  await writeFile(file, '# Project\r\n\r\nCode map.\r\n', 'utf8');
  assert.equal((await writeAgentBlock(dir)).status, 'updated');
  const first = await readFile(file, 'utf8');
  assert.ok(first.startsWith('# Project\r\n\r\nCode map.\r\n\r\n'));
  assert.ok(!/[^\r]\n/.test(first), 'every line ends in CRLF');
  assert.equal((await writeAgentBlock(dir)).status, 'present');

  // A block from an older cnlp-kit, followed by the operator's own text.
  const stale = `${first.slice(0, first.indexOf(BLOCK_BEGIN))}${BLOCK_BEGIN}\r\n- old line\r\n${BLOCK_END}\r\n\r\nMine.\r\n`;
  await writeFile(file, stale, 'utf8');
  assert.equal((await writeAgentBlock(dir)).status, 'updated');
  assert.equal(await readFile(file, 'utf8'), `${first.replace(/\r\n$/, '')}\r\n\r\nMine.\r\n`);
});

test('syncCorpus adds the ADR entry once an ADR exists, and leaves the project entries alone', async () => {
  const dir = await tmp();
  assert.equal((await syncCorpus(dir)).status, 'skipped', 'no file matches: no config');
  assert.ok(!existsSync(path.join(dir, 'cnlp.config.json')));

  await init(dir);
  assert.deepEqual((await config(dir)).corpus.map((e) => e.profile), ['live']);
  assert.equal(runCnlp(['check'], { cwd: dir, stdio: 'pipe' }).status, 0, 'the written config passes the check');

  // `adr validate` only warns on the format of a proposal, so the check leaves it out.
  await writeFile(path.join(dir, 'docs/adr/proposals/adr-x.md'), '# x\n', 'utf8');
  assert.equal((await syncCorpus(dir)).status, 'present');

  await writeFile(path.join(dir, 'docs/adr/accepted/adr-z.md'), '# z\n', 'utf8');
  const res = await syncCorpus(dir);
  assert.equal(res.status, 'updated');
  assert.equal(res.added[0].glob, 'docs/adr/{accepted,active}/*.md');
  assert.equal((await syncCorpus(dir)).status, 'present');
});

test('syncCorpus replaces the 5.1.0 ADR entry over every status directory', async () => {
  const dir = await tmp();
  await init(dir);
  const cfg = await config(dir);
  cfg.corpus.push({ profile: 'adr', glob: 'docs/adr/{proposals,drafts,accepted,active,superseded}/*.md' });
  await writeFile(path.join(dir, 'cnlp.config.json'), JSON.stringify(cfg), 'utf8');
  await writeFile(path.join(dir, 'docs/adr/proposals/adr-x.md'), '# x\n', 'utf8');

  assert.equal((await syncCorpus(dir)).status, 'updated');
  assert.deepEqual((await config(dir)).corpus.map((e) => e.glob), ['.ai-factory/LIVE.md']);
  assert.equal(runCnlp(['check'], { cwd: dir, stdio: 'pipe' }).status, 0, 'a non-conformant proposal passes the check');
});

test('syncCorpus adds no live entry to a config reading its own profiles', async () => {
  const dir = await tmp();
  await init(dir);
  await mkdir(path.join(dir, 'docs/adr/active'), { recursive: true });
  await writeFile(path.join(dir, 'docs/adr/active/adr-y.md'), '# y\n', 'utf8');
  const own = { profiles: 'cnlp/profiles', corpus: [{ profile: 'skill', glob: 'skills/*/SKILL.md' }] };
  await writeFile(path.join(dir, 'cnlp.config.json'), JSON.stringify(own), 'utf8');

  await syncCorpus(dir);
  const cfg = await config(dir);
  assert.equal(cfg.profiles, 'cnlp/profiles');
  assert.deepEqual(cfg.corpus.map((e) => e.profile), ['skill', 'adr']);
});
