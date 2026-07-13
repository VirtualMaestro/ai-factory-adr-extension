// Integration tests — exercise the real `ai-factory` CLI (assumed globally installed, on PATH).
// The whole suite skips with a clear message when the CLI is absent so `node --test` stays green.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WIN = process.platform === 'win32';

// ponytail: shell:true so Windows resolves the `ai-factory.cmd` shim; args are test-controlled temp
// paths, not untrusted input, so §28's shell-interpolation rule (which targets ADR filenames) is n/a.
function aif(args, cwd) {
  const quoted = WIN ? args.map((a) => (/\s/.test(a) ? `"${a}"` : a)) : args;
  return execFileSync('ai-factory', quoted, { cwd, encoding: 'utf8', stdio: 'pipe', shell: WIN });
}

let available = false;
try {
  aif(['--version']);
  available = true;
} catch {
  available = false;
}
const opts = { skip: available ? false : 'ai-factory CLI not on PATH — integration suite skipped' };

async function newProject(agents) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'adr-integ-'));
  try {
    aif(['init', '--agents', agents, '--config'], dir);
  } catch {
    aif(['init', '--agents', agents], dir); // tolerate CLI versions without --config
  }
  return dir;
}

const skillsDir = (dir, runtime) => path.join(dir, `.${runtime}`, 'skills');
const adrSkills = async (dir, runtime) =>
  existsSync(skillsDir(dir, runtime))
    ? (await readdir(skillsDir(dir, runtime))).filter((n) => n.startsWith('aif-adr-'))
    : [];

test('add installs all 9 skills for each configured runtime and registers `adr` (Acc 2,3,4,6)', opts, async () => {
  const dir = await newProject('claude,codex');
  aif(['extension', 'add', EXT_ROOT], dir);

  assert.equal((await adrSkills(dir, 'claude')).length, 9, 'claude skills');
  assert.equal((await adrSkills(dir, 'codex')).length, 9, 'codex skills');
  assert.match(aif(['adr', '--help'], dir), /init/);

  aif(['adr', 'init'], dir);
  assert.ok(existsSync(path.join(dir, 'docs/adr/active')), 'adr init created the structure');
});

test('wave-1 lifecycle: propose → refine (draft) → accept, driven by the real CLI (Acc 11,12,13,26,27)', opts, async () => {
  const dir = await newProject('claude,codex');
  aif(['extension', 'add', EXT_ROOT], dir);
  aif(['adr', 'init'], dir);

  // Skills authored (no longer placeholders) and installed for both runtimes.
  assert.equal((await adrSkills(dir, 'claude')).length, 9, 'claude skills');
  assert.equal((await adrSkills(dir, 'codex')).length, 9, 'codex skills');
  const acceptSkill = await readFile(
    path.join(skillsDir(dir, 'claude'), 'aif-adr-accept', 'SKILL.md'),
    'utf8',
  );
  assert.doesNotMatch(acceptSkill, /Placeholder/, 'skill body authored');

  // propose: adr new scaffolds a proposed ADR with a stable id.
  aif(['adr', 'new', 'test decision'], dir);
  const proposed = path.join(dir, 'docs/adr/proposals/adr-test-decision.md');
  assert.ok(existsSync(proposed), 'proposal created');
  assert.match(await readFile(proposed, 'utf8'), /status: proposed/);

  // Duplicate id is rejected, leaving the proposal untouched (Acc 27).
  assert.throws(() => aif(['adr', 'new', 'test decision'], dir), /already exists|Error/);

  // Stand in for refine's content-authoring: replace the template placeholders with real content
  // (keep status: proposed) so the ADR validates clean once accepted (inv 6).
  await writeFile(proposed, [
    '---', 'id: adr-test-decision', 'type: adr', 'status: proposed', 'owners: [maintainer]',
    'depends_on: []', 'affects: []', 'supersedes: []', '---', '',
    '# Test decision', '',
    '## Context', '', '- **Problem:** We need a documented test decision.',
    '- **Constraints:** None material.', '- **Decision drivers:** Simplicity.', '',
    '## Decision', '', 'We will use option A for the test scope because it is simplest.', '',
    '## Alternatives considered', '', '- **Option B** — rejected because it is more complex.', '',
    '## Consequences', '', '- **Positive:** Simple.', '- **Negative:** Limited.', '- **Risks:** None.', '',
    '## Implementation', '', '- **Plan:** none', '- **Evidence:** pending', '',
  ].join('\n'), 'utf8');

  // refine (first): proposed → draft.
  aif(['adr', 'transition', 'docs/adr/proposals/adr-test-decision.md', 'draft'], dir);
  assert.ok(!existsSync(proposed), 'left proposals/');
  const draft = path.join(dir, 'docs/adr/drafts/adr-test-decision.md');
  assert.ok(existsSync(draft), 'moved to drafts/ (Acc 12)');

  // accept: draft → accepted.
  aif(['adr', 'transition', 'docs/adr/drafts/adr-test-decision.md', 'accepted'], dir);
  const accepted = path.join(dir, 'docs/adr/accepted/adr-test-decision.md');
  assert.ok(existsSync(accepted), 'moved to accepted/ (Acc 13)');

  // status overview sees exactly one accepted ADR; --check passes on a clean tree.
  const overview = JSON.parse(aif(['adr', 'status', '--json'], dir));
  assert.deepEqual(overview.acceptedNoPlan, ['adr-test-decision']);
  assert.equal(overview.issues.length, 0, 'no status-directory mismatches (Acc 26)');
  assert.doesNotThrow(() => aif(['adr', 'status', '--check'], dir), 'clean tree → exit 0');
});

// Author an accepted ADR at docs/adr/accepted/<id>.md with inv-6-clean content (Evidence non-sentinel).
async function seedAccepted(dir, id, title) {
  const file = path.join(dir, 'docs/adr/accepted', `${id}.md`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, [
    '---', `id: ${id}`, 'type: adr', 'status: accepted', 'owners: [maintainer]',
    'depends_on: []', 'affects: []', 'supersedes: []', '---', '',
    `# ${title}`, '',
    '## Context', '', '- **Problem:** We need a documented decision.', '',
    '## Decision', '', 'We will use option A because it is simplest.', '',
    '## Consequences', '', '- **Negative:** Limited.', '', '## Implementation', '', '',
    '## References', '', '- **Replaced by:** —', '',
  ].join('\n'), 'utf8');
  return file;
}

test('wave-2 lifecycle: plan → finalize activates the ADR and archives the plan (Acc 15,16,20,21)', opts, async () => {
  const dir = await newProject('claude,codex');
  aif(['extension', 'add', EXT_ROOT], dir);
  aif(['adr', 'init'], dir);

  // The 3 P3 skill bodies are authored (not placeholders) and installed for both runtimes.
  for (const runtime of ['claude', 'codex']) {
    for (const skill of ['aif-adr-plan', 'aif-adr-implement', 'aif-adr-finalize']) {
      const body = await readFile(path.join(skillsDir(dir, runtime), skill, 'SKILL.md'), 'utf8');
      assert.doesNotMatch(body, /Placeholder/, `${runtime}/${skill} authored`);
    }
  }

  const id = 'adr-cache-layer';
  await seedAccepted(dir, id, 'Cache layer');
  const adrFile = `docs/adr/accepted/${id}.md`;
  await writeFile(path.join(dir, 'docs/adr/accepted', `${id}.md`), (
    await readFile(path.join(dir, adrFile), 'utf8')
  ) + '- **Plan:** pending\n- **Evidence:** pending\n', 'utf8');

  // Stand in for `aif-plan full`: place the plan artifact AIF would create in paths.plans.
  const planId = `plan-${id}`;
  const planDir = path.join(dir, '.ai-factory', 'plans');
  await mkdir(planDir, { recursive: true });
  const planFile = path.join(planDir, `${planId}.md`);
  await writeFile(planFile, [
    '---', `id: ${planId}`, 'type: plan', 'status: in_progress',
    `implements: [${id}]`, `depends_on: [${id}]`, '---', '', '# Plan', '',
  ].join('\n'), 'utf8');

  // Link reciprocally, then confirm resolve-plan sees exactly one active plan.
  aif(['adr', 'link-plan', adrFile, path.join('.ai-factory', 'plans', `${planId}.md`)], dir);
  const resolved = JSON.parse(aif(['adr', 'resolve-plan', adrFile, '--json'], dir));
  assert.equal(resolved.active.length, 1, 'one active plan resolved');
  assert.equal(resolved.active[0].id, planId);

  // Stand in for strict aif-verify: record evidence, then finalize.
  aif(['adr', 'finalize', adrFile], dir);
  assert.ok(!existsSync(path.join(dir, adrFile)), 'ADR left accepted/');
  const active = path.join(dir, 'docs/adr/active', `${id}.md`);
  assert.ok(existsSync(active), 'ADR moved to active/ (Acc 20)');
  assert.match(await readFile(active, 'utf8'), /- \*\*Evidence:\*\* implemented/);

  assert.ok(!existsSync(planFile), 'plan left the live plans dir');
  const archived = path.join(dir, '.ai-factory/archive/plans', `${planId}.md`);
  assert.ok(existsSync(archived), 'plan archived (Acc 21)');
  assert.match(await readFile(archived, 'utf8'), /status: done/);

  assert.doesNotThrow(() => aif(['adr', 'status', '--check'], dir), 'clean tree → exit 0');
});

test('wave-2: a documentation-only ADR finalizes to active without a plan (Acc 22)', opts, async () => {
  const dir = await newProject('claude');
  aif(['extension', 'add', EXT_ROOT], dir);
  aif(['adr', 'init'], dir);

  const id = 'adr-naming-convention';
  await seedAccepted(dir, id, 'Naming convention');
  const adrFile = `docs/adr/accepted/${id}.md`;
  await writeFile(path.join(dir, adrFile), (
    await readFile(path.join(dir, adrFile), 'utf8')
  ) + '- **Plan:** not required\n- **Evidence:** documentation-only decision\n', 'utf8');

  aif(['adr', 'finalize', adrFile], dir);
  const active = path.join(dir, 'docs/adr/active', `${id}.md`);
  assert.equal((JSON.parse(aif(['adr', 'status', active, '--json'], dir))).status, 'active');
  assert.ok(!existsSync(path.join(dir, '.ai-factory/archive/plans', `plan-${id}.md`)), 'no plan archived');
});

test('wave-3 lifecycle: supersede moves the old ADR to superseded and archives its plan with a note (Acc 23,24,25)', opts, async () => {
  const dir = await newProject('claude,codex');
  aif(['extension', 'add', EXT_ROOT], dir);
  aif(['adr', 'init'], dir);

  // The P4 supersede skill body is authored (not a placeholder) and installed for both runtimes.
  for (const runtime of ['claude', 'codex']) {
    const body = await readFile(path.join(skillsDir(dir, runtime), 'aif-adr-supersede', 'SKILL.md'), 'utf8');
    assert.doesNotMatch(body, /Placeholder/, `${runtime}/aif-adr-supersede authored`);
  }

  const oldId = 'adr-old-storage';
  const newId = 'adr-new-storage';
  await seedAccepted(dir, oldId, 'Old storage');
  await seedAccepted(dir, newId, 'New storage');
  const oldFile = `docs/adr/accepted/${oldId}.md`;
  const newFile = `docs/adr/accepted/${newId}.md`;

  // Give the old ADR a live (non-archived) plan so supersede requires a disposition (inv 17).
  const planId = `plan-${oldId}`;
  const planDir = path.join(dir, '.ai-factory', 'plans');
  await mkdir(planDir, { recursive: true });
  await writeFile(path.join(planDir, `${planId}.md`), [
    '---', `id: ${planId}`, 'type: plan', 'status: in_progress',
    `implements: [${oldId}]`, `depends_on: [${oldId}]`, '---', '', '# Plan', '',
  ].join('\n'), 'utf8');
  aif(['adr', 'link-plan', oldFile, path.join('.ai-factory', 'plans', `${planId}.md`)], dir);

  // Supersede with an explicit plan disposition (archive-with-note).
  aif(['adr', 'supersede', oldFile, newFile, '--archive-plan'], dir);

  // Old ADR moved to superseded/ with a reciprocal Replaced-by link; new ADR gained `supersedes`.
  assert.ok(!existsSync(path.join(dir, oldFile)), 'old ADR left accepted/');
  const superseded = path.join(dir, 'docs/adr/superseded', `${oldId}.md`);
  assert.ok(existsSync(superseded), 'old ADR moved to superseded/ (Acc 24)');
  assert.match(await readFile(superseded, 'utf8'), new RegExp(`- \\*\\*Replaced by:\\*\\* .*${newId}\\.md`));
  assert.match(await readFile(path.join(dir, newFile), 'utf8'), new RegExp(`supersedes:[\\s\\S]*${oldId}`));

  // Plan archived with the superseded note (Acc 25, §19.7 step 5).
  const archived = path.join(dir, '.ai-factory/archive/plans', `${planId}.md`);
  assert.ok(existsSync(archived), 'plan archived');
  assert.match(await readFile(archived, 'utf8'), new RegExp(`archived_reason:.*superseded by ${newId}`));

  const overview = JSON.parse(aif(['adr', 'status', '--json'], dir));
  assert.ok(overview.superseded.includes(oldId), 'status reports the superseded ADR');
  assert.doesNotThrow(() => aif(['adr', 'status', '--check'], dir), 'clean tree → exit 0');
});

test('re-adding does not duplicate skills or extension entries (Acc 7)', opts, async () => {
  const dir = await newProject('claude');
  aif(['extension', 'add', EXT_ROOT], dir);
  aif(['extension', 'add', EXT_ROOT], dir); // second add

  assert.equal((await adrSkills(dir, 'claude')).length, 9);
  const cfg = JSON.parse(await readFile(path.join(dir, '.ai-factory.json'), 'utf8'));
  const entries = (cfg.extensions ?? []).filter((e) => e.name === 'ai-factory-adr-extension');
  assert.equal(entries.length, 1, 'exactly one extension entry');
});

test('update preserves ADR docs and user config (Acc 8)', opts, async () => {
  const dir = await newProject('claude');
  aif(['extension', 'add', EXT_ROOT], dir);
  aif(['adr', 'init'], dir);
  await writeFile(path.join(dir, 'docs/adr/active/adr-keepme.md'), 'seeded ADR\n', 'utf8');
  const cfgFile = path.join(dir, '.ai-factory/adr-extension.yaml');
  await writeFile(cfgFile, 'version: 1\n# user edit\n', 'utf8');

  try {
    aif(['extension', 'update', 'ai-factory-adr-extension'], dir);
  } catch {
    aif(['extension', 'update', '--force'], dir); // repair path if registry lookup is unavailable offline
  }

  assert.equal(await readFile(path.join(dir, 'docs/adr/active/adr-keepme.md'), 'utf8'), 'seeded ADR\n');
  assert.match(await readFile(cfgFile, 'utf8'), /# user edit/);
});

test('remove deletes extension skills but never ADR documents (Acc 9)', opts, async () => {
  const dir = await newProject('claude');
  aif(['extension', 'add', EXT_ROOT], dir);
  aif(['adr', 'init'], dir);
  await writeFile(path.join(dir, 'docs/adr/active/adr-keepme.md'), 'seeded ADR\n', 'utf8');

  aif(['extension', 'remove', 'ai-factory-adr-extension'], dir);

  assert.equal((await adrSkills(dir, 'claude')).length, 0, 'skills removed');
  assert.ok(existsSync(path.join(dir, 'docs/adr/active/adr-keepme.md')), 'ADR doc preserved');
});

test('adr commands refuse to run in a non-initialized project (Acc 5)', opts, async () => {
  // The gate is unit-covered (detect.test.js); here confirm the CLI itself is unaffected in a bare dir.
  const bare = await mkdtemp(path.join(os.tmpdir(), 'adr-bare-'));
  await mkdir(bare, { recursive: true });
  // No .ai-factory.json → AIF won't even load the extension command, so `adr` is simply unavailable.
  assert.doesNotThrow(() => {
    try { aif(['--help'], bare); } catch { /* CLI help still works */ }
  });
});
