import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { detectAif, AifError } from '../src/aif/detect.js';
import { bodyIssues, loadProfile, profileNames, resolveDoc } from '../src/artifacts/cnlp.js';
import { init } from '../src/init.js';
import { runCnlp, syncCorpus } from '../src/cnlp-setup.js';
import { validateAdr } from '../src/lifecycle/validate.js';
import { verifyAnchors } from '../src/lifecycle/verify.js';
import { transition } from '../src/lifecycle/move.js';
import { resolvePlans } from '../src/artifacts/plan.js';
import { linkPlan } from '../src/artifacts/links.js';
import { finalize } from '../src/lifecycle/finalize.js';
import { supersede } from '../src/lifecycle/supersede.js';
import { buildStatus, buildFileStatus } from '../src/status.js';
import { buildDecisions, renderDecisions } from '../src/decisions.js';
import { buildOrder } from '../src/order.js';
import { runAudit } from '../src/audit.js';
import { createProposal } from '../src/artifacts/create.js';
import { importAdr } from '../src/artifacts/import.js';
import { liveFile } from '../src/config/paths.js';
import { applySource, applyPending, initLive, liveMissing } from '../src/live/apply.js';
import { checkLive } from '../src/live/check.js';
import { claim, release, checkClaim, unclaim, assertClaimBranch, assertAdrAndPlanBranch } from '../src/lifecycle/claim.js';
import { readConfig, resolveAutoConfig } from '../src/config/adrConfig.js';
import * as review from '../src/review.js';

/**
 * Registered by AI Factory via the `commands` manifest entry: `mod.register(program)` where
 * `program` is AIF's Commander instance (dist/cli/index.js). Adds the `adr` command group.
 */
export function register(program) {
  const adr = program.command('adr').description('Architecture Decision Record lifecycle');
  const out = (opts, obj, human) => (opts.json ? console.log(JSON.stringify(obj, null, 2)) : human());

  // not `--version`: the AIF root program answers that flag on every subcommand with its own version
  adr
    .command('version')
    .description('Print the installed ai-factory-adr-extension version')
    .action(() => console.log(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version));

  adr
    .command('init')
    .description('Create the ADR directory structure, the default configuration and an empty LIVE.md (idempotent)')
    .option('--json', 'Machine-readable output')
    .action((opts) => guard(opts, async () => {
      const { items } = await init();
      out(opts, { command: 'init', items }, () => {
        for (const it of items) console.log(`  ${it.status.padEnd(8)} ${it.item}`);
        const created = items.filter((i) => i.status === 'created').length;
        console.log(created ? `ADR structure ready (${created} created).` : 'ADR structure already present.');
      });
    }));

  adr
    .command('new <topic>')
    .description('Scaffold a new ADR proposal (generates a stable ID; status: proposed)')
    .option('--json', 'Machine-readable output')
    .action((topic, opts) => guard(opts, async () => {
      const res = await createProposal(topic, { projectDir: process.cwd() });
      out(opts, { command: 'new', ...res }, () => console.log(`Created ${res.id}: ${res.path}`));
    }));

  adr
    .command('import <topic>')
    .description('Scaffold a conformant ADR skeleton at a chosen status (for migrating existing decisions)')
    .requiredOption('--status <status>', 'Target lifecycle status (proposed|draft|accepted|active|superseded)')
    .option('--id <id>', 'Explicit ADR id (defaults to a slug derived from the topic)')
    .option('--json', 'Machine-readable output')
    .action((topic, opts) => guard(opts, async () => {
      const res = await importAdr(topic, { status: opts.status, id: opts.id, projectDir: process.cwd() });
      out(opts, { command: 'import', ...res }, () => console.log(`Imported ${res.id} [${res.status}]: ${res.path}`));
    }));

  adr
    .command('validate <file>')
    .description('Check an ADR against the lifecycle invariants (§21)')
    .option('--json', 'Machine-readable output')
    .option('--strict', 'Warnings fail too: the body must conform whatever the status')
    .action((file, opts) => guard(opts, async () => {
      const res = await validateAdr(file, { projectDir: process.cwd() });
      out(opts, { command: 'validate', file, strict: Boolean(opts.strict), ...res }, () => {
        res.errors.forEach((e) => console.error(`  error:   ${e}`));
        res.warnings.forEach((w) => console.warn(`  warning: ${w}`));
        console.log(res.errors.length ? `Invalid: ${res.errors.length} error(s).` : 'Valid.');
      });
      // A body issue is a warning before `accepted` because the document is still being
      // written. `adr-migrate` claims the opposite — that it is done — so it asks for
      // `--strict` and a warning there is work left undone, not advice.
      if (res.errors.length || (opts.strict && res.warnings.length)) process.exitCode = 1;
    }));

  adr
    .command('verify-anchors <file>')
    .description('Check that an ADR\'s `code:` anchors resolve on disk (non-zero exit if any are missing)')
    .option('--json', 'Machine-readable output')
    .action((file, opts) => guard(opts, async () => {
      const res = await verifyAnchors(file, { projectDir: process.cwd() });
      if (res.errors) {
        out(opts, { command: 'verify-anchors', file, ...res }, () => res.errors.forEach((e) => console.error(`  error:   ${e}`)));
        process.exitCode = 1;
        return;
      }
      out(opts, { command: 'verify-anchors', file, ...res }, () => {
        for (const a of res.anchors) {
          const ok = a.fileExists && a.symbolFound !== false;
          const why = !a.fileExists ? 'file not found' : a.symbolFound === false ? 'symbol not found' : '';
          console.log(`  ${ok ? 'ok     ' : 'MISSING'} ${a.anchor}${why ? `  (${why})` : ''}`);
        }
        if (!res.anchors.length) console.log(res.docOnly ? 'No code anchors (documentation-only ADR).' : 'No code anchors declared.');
        else console.log(res.missing.length ? `${res.missing.length} anchor(s) missing.` : 'All anchors resolve.');
      });
      if (res.missing.length) process.exitCode = 1;
    }));

  adr
    .command('transition <file> <status>')
    .description('Move an ADR to a new lifecycle status (atomic; §17)')
    .option('--json', 'Machine-readable output')
    .action((file, status, opts) => guard(opts, async () => {
      await assertClaimBranch(file, { projectDir: process.cwd(), command: 'transition' });
      const res = await transition(file, status, { projectDir: process.cwd() });
      out(opts, { command: 'transition', ...res }, () => console.log(`${res.from} → ${res.to}: ${res.target}`));
    }));

  adr
    .command('resolve-plan <file>')
    .description('Resolve plans implementing an ADR via `implements` frontmatter')
    .option('--json', 'Machine-readable output')
    .action((file, opts) => guard(opts, async () => {
      const { data } = await import('../src/artifacts/frontmatter.js').then((m) => m.read(file));
      const res = await resolvePlans(data.id, { projectDir: process.cwd() });
      out(opts, { command: 'resolve-plan', id: data.id, ...res }, () => {
        if (!res.plans.length) return console.log('No plans implement this ADR.');
        for (const p of res.plans) console.log(`  ${p.archived ? 'archived' : 'active  '} ${p.id} (${p.status})`);
      });
      if (res.active.length > 1) process.exitCode = 1;
    }));

  adr
    .command('link-plan <adr-file> <plan-file>')
    .description('Create reciprocal ADR↔plan links')
    .option('--json', 'Machine-readable output')
    .action((adrFile, planFile, opts) => guard(opts, async () => {
      await assertClaimBranch(adrFile, { projectDir: process.cwd(), command: 'link-plan' });
      await assertClaimBranch(planFile, { projectDir: process.cwd(), command: 'link-plan' });
      const res = await linkPlan(adrFile, planFile, { projectDir: process.cwd() });
      out(opts, { command: 'link-plan', ...res }, () => console.log(`Linked ${res.adrId} ↔ ${res.planId}`));
    }));

  adr
    .command('finalize <file>')
    .description('Activate an accepted ADR and archive its plan (deterministic core)')
    .option('--json', 'Machine-readable output')
    .action((file, opts) => guard(opts, async () => {
      await assertAdrAndPlanBranch(file, { projectDir: process.cwd(), command: 'finalize' });
      const res = await finalize(file, { projectDir: process.cwd() });
      out(opts, { command: 'finalize', ...res }, () => {
        console.log(`Activated ${res.id}: ${res.active}`);
        if (res.archivedPlan) console.log(`Archived plan: ${res.archivedPlan}`);
        if (res.live) printLive(res.live);
      });
    }));

  adr
    .command('supersede <old-file> <new-file>')
    .description('Replace an accepted/active ADR with an accepted replacement')
    .option('--archive-plan', 'Archive the old ADR\'s non-archived plan')
    .option('--delete-plan', 'Delete the old ADR\'s non-archived plan')
    .option('--json', 'Machine-readable output')
    .action((oldFile, newFile, opts) => guard(opts, async () => {
      const planDisposition = opts.archivePlan ? 'archive' : opts.deletePlan ? 'delete' : null;
      await assertAdrAndPlanBranch(oldFile, { projectDir: process.cwd(), command: 'supersede' });
      await assertClaimBranch(newFile, { projectDir: process.cwd(), command: 'supersede' });
      const res = await supersede(oldFile, newFile, { projectDir: process.cwd(), planDisposition });
      out(opts, { command: 'supersede', ...res }, () => {
        console.log(`${res.oldId} superseded by ${res.newId}: ${res.superseded}`);
        if (res.plan) console.log(`Plan ${res.plan.action}.`);
        if (res.live?.rewritten.length) console.log(`LIVE.md: refs to ${res.oldId} now name ${res.newId} in ${res.live.rewritten.join(', ')}`);
        res.live?.warnings.forEach((w) => console.warn(`  warning: ${w}`));
      });
    }));

  adr
    .command('status [file]')
    .description('ADR overview, or single-ADR detail; --check exits non-zero on blocking errors')
    .option('--check', 'CI mode: non-zero exit on blocking errors')
    .option('--json', 'Machine-readable output')
    .action((file, opts) => guard(opts, async () => {
      if (file) {
        const res = await buildFileStatus(file, process.cwd());
        out(opts, { command: 'status', ...res }, () => {
          console.log(`${res.id}  [${res.status}]  ${res.location}`);
          console.log(`  plan:     ${res.activePlan ?? 'none'}`);
          console.log(`  evidence: ${res.evidence ?? '—'}`);
          if (res.claim) console.log(`  in work:  ${res.claim.branch} (base ${res.claim.base ?? '?'}, since ${res.claim.started ?? '?'})`);
          res.errors.forEach((e) => console.error(`  error:   ${e}`));
          res.warnings.forEach((w) => console.warn(`  warning: ${w}`));
        });
        if (opts.check && res.errors.length) process.exitCode = 1;
        return;
      }

      const report = await buildStatus(process.cwd());
      let audit = null;
      if (opts.check) audit = await runAudit({ projectDir: process.cwd(), strict: true });
      out(opts, { command: 'status', ...report, audit: audit && { code: audit.code } }, () => {
        const line = (label, arr) => console.log(`  ${label.padEnd(20)} ${arr.length}${arr.length ? ': ' + arr.join(', ') : ''}`);
        line('proposals', report.proposals);
        line('drafts', report.drafts);
        line('accepted (no plan)', report.acceptedNoPlan);
        line('accepted (w/ plan)', report.acceptedWithPlan);
        line('active', report.active);
        line('superseded', report.superseded);
        line('in work', report.inWork.map((c) => `${c.id} on ${c.branch}`));
        report.issues.forEach((i) => console.error(`  issue: ${i}`));
        report.warnings.forEach((w) => console.warn(`  warning: ${w}`));
      });
      const auditFailed = audit && audit.code !== 0 && audit.code !== null;
      if (opts.check && (report.issues.length || auditFailed)) process.exitCode = 1;
    }));

  adr
    .command('order')
    .description('Dependency-ordered implementation plan: what is ready to implement next, and in what order')
    .option('--json', 'Machine-readable output')
    .action((opts) => guard(opts, async () => {
      const res = await buildOrder({ projectDir: process.cwd() });
      out(opts, { command: 'order', ...res }, () => {
        console.log('Next to implement (accepted, all deps active):');
        if (res.next.length) res.next.forEach((id, i) => console.log(`  ${i + 1}. ${id}`));
        else console.log('  (none ready)');
        if (res.inWork.length) {
          console.log('In work (claimed, on their branch):');
          for (const c of res.inWork) console.log(`  ${c.id} on ${c.branch}`);
        }
        console.log('Order (topological):');
        if (res.order.length) {
          for (const o of res.order) {
            const wait = o.blockedBy.length ? `  ← after ${o.blockedBy.join(', ')}` : '';
            console.log(`  [${o.status}] ${o.id}${wait}${o.branch ? `  (in work on ${o.branch})` : ''}`);
          }
        } else console.log('  (nothing to order)');
        if (res.blocked.length) {
          console.log('Blocked:');
          for (const b of res.blocked) console.log(`  ${b.id} ← ${b.blockedBy.join(', ') || '?'}${b.note ? `  (${b.note})` : ''}`);
        }
        if (res.cycles.length) {
          console.error('Cycles — mutually-dependent ADRs; break one before an order exists:');
          for (const c of res.cycles) console.error(`  ${c.join(' ↔ ')}`);
        }
      });
      if (res.cycles.length) process.exitCode = 1;
    }));

  adr
    .command('claim <file>')
    .description('Mark an accepted ADR or a plan in progress as in work on its branch; --check and --release read or remove the claim')
    .option('--base <branch>', 'The branch the work merges into')
    .option('--check', 'Exit 0 when the file has no claim or the current branch is its branch')
    .option('--release', 'Remove the claim and write the file, without committing')
    .option('--json', 'Machine-readable output')
    .action((file, opts) => guard(opts, async () => {
      const projectDir = process.cwd();
      if ([opts.base != null, opts.check, opts.release].filter(Boolean).length !== 1) {
        throw new AifError('Use exactly one of `--base <branch>`, `--check` and `--release`.');
      }
      if (opts.check) {
        const res = await checkClaim(file, { projectDir });
        out(opts, { command: 'claim check', ...res }, () => {
          if (!res.claim) return console.log(`${res.id}: no claim.`);
          if (res.ok) return console.log(`${res.id}: in work on ${res.claim.branch}, the current branch.`);
          console.error(
            `${res.id} is in work on ${res.claim.branch}.\n` +
              `  expected: the checkout of ${res.claim.branch}\n` +
              `  detected: current branch ${res.current ?? '(none)'}\n` +
              '  files:    nothing was changed\n' +
              `  next:     switch to ${res.claim.branch}, or release it with \`ai-factory adr unclaim ${file}\``,
          );
        });
        if (!res.ok) process.exitCode = 1;
        return;
      }
      if (opts.release) {
        const res = await release(file, { projectDir });
        out(opts, { command: 'claim release', ...res }, () =>
          console.log(res.released ? `Released ${res.id} from ${res.claim.branch}; nothing committed.` : `${res.id}: no claim.`));
        return;
      }
      const res = await claim(file, { base: opts.base, projectDir });
      out(opts, { command: 'claim', ...res }, () => console.log(res.branch));
    }));

  adr
    .command('unclaim <file>')
    .description('On the base: release a claim, commit `chore(adr|plan): release <id>` and push the base')
    .option('--delete-branch', 'Also delete the claimed branch locally and on the remote')
    .option('--json', 'Machine-readable output')
    .action((file, opts) => guard(opts, async () => {
      const res = await unclaim(file, { projectDir: process.cwd(), deleteBranch: Boolean(opts.deleteBranch) });
      out(opts, { command: 'unclaim', ...res }, () => {
        console.log(`Released ${res.id} from ${res.released.branch}: ${res.commit}`);
        if (res.local) console.log(`  push:   skipped: ${res.local}`);
        else console.log(`  push:   ${res.pushed ? 'done' : `failed (${res.pushError.rejected}): ${res.pushError.output}`}`);
        if (res.deleteSkipped) console.log(`  branch: kept: ${res.deleteSkipped}`);
        else if (opts.deleteBranch) console.log(`  branch: deleted locally ${res.deleted.local ? 'yes' : 'no'}, on the remote ${res.deleted.remote ? 'yes' : 'no'}`);
      });
      if (res.pushError) process.exitCode = 1;
    }));

  const auto = adr.command('auto').description('Configuration of the automated runs (adr-auto-implement, adr-auto-plan, adr-auto-change)');
  auto
    .command('config')
    .description('Print `adr.auto` and `adr.acceptance` resolved with their defaults; --check exits non-zero on an error')
    .option('--check', 'Non-zero exit on a config error')
    .option('--json', 'Machine-readable output')
    .action((opts) => guard(opts, async () => {
      const res = resolveAutoConfig((await readConfig(process.cwd())) ?? {});
      out(opts, { command: 'auto config', ...res }, () => {
        for (const [phase, roles] of Object.entries(res.roles)) {
          console.log(`${phase}:`);
          for (const [name, r] of Object.entries(roles)) {
            const extra = [r.model && `model ${r.model}`, r.effort && `effort ${r.effort}`, r.timeout && `timeout ${r.timeout}s`].filter(Boolean);
            console.log(`  ${name.padEnd(11)} ${r.runtime}${extra.length ? ` (${extra.join(', ')})` : ''}  fallback: ${r.fallback.join(' → ')}`);
          }
        }
        const a = res.auto;
        console.log(`escalate_at: ${a.escalate_at} · max_rounds: ${a.max_rounds} · branch: ${a.branch.prefix}<id>, delete after merge: ${a.branch.delete_after_merge}`);
        console.log(`checks.task: ${a.checks.task.join(' && ') || 'the project test suite'} · checks.full: ${a.checks.full.join(' && ') || 'the project test suite'}`);
        console.log(`release: ${a.release.command ?? 'none'} · acceptance: ${res.acceptance.command ?? 'none'}${res.acceptance.exploratory ? ` · exploratory: ${res.acceptance.exploratory.instructions}` : ''}`);
        res.errors.forEach((e) => console.error(`  error: ${e}`));
      });
      if (opts.check && res.errors.length) process.exitCode = 1;
    }));

  const rev = adr.command('review').description('A read-only review bracketed by snapshots of the tree: begin, run (CLI runtimes), end');
  rev
    .command('begin')
    .description('Resolve the role, write the prompt and the schema under .git/adr-auto/<id>/, take the snapshot')
    .requiredOption('--role <role>', 'reviewer_1 or reviewer_2')
    .requiredOption('--prompt <file>', 'The review brief; keep it outside the tree')
    .option('--files <files...>', 'Files under review, instead of the diff the prompt names')
    .option('--rubric <rubric>', 'adr or plan: append that rubric from the installed skills')
    .option('--phase <phase>', 'implement (adr.auto.roles) or plan (adr.auto.plan.roles over them)', 'implement')
    .option('--runtime <runtime>', 'Override the configured runtime, such as a fallback to subagent')
    .option('--json', 'Machine-readable output')
    .action((opts) => guard(opts, async () => {
      const res = await review.begin({ ...opts, projectDir: process.cwd() });
      out(opts, { command: 'review begin', ...res }, () => {
        console.log(`${res.id}  ${res.role}  ${res.runtime}${res.model ? ` ${res.model}` : ''}${res.effort ? ` ${res.effort}` : ''}`);
        console.log(`  prompt: ${res.prompt}`);
        console.log(`  result: ${res.result}`);
        console.log(res.runtime === 'subagent'
          ? `next: start a read-only subagent with the prompt, write its JSON answer to a file outside the tree, then \`adr review end ${res.id} --result <file>\``
          : `next: \`adr review run ${res.id}\`, then \`adr review end ${res.id}\``);
      });
    }));
  rev
    .command('run <id>')
    .description('Run a codex-cli or claude-cli reviewer with the role timeout and write its result')
    .option('--json', 'Machine-readable output')
    .action((id, opts) => guard(opts, async () => {
      const res = await review.run(id, { projectDir: process.cwd() });
      out(opts, { command: 'review run', ...res }, () =>
        console.log(`${res.id}  ${res.runtime}: ${res.timedOut ? 'timed out' : `exit ${res.exit}`} in ${res.seconds}s${res.result ? '' : ', no result'}`));
      if (res.timedOut || res.exit !== 0) process.exitCode = 1;
    }));
  rev
    .command('end <id>')
    .description('Take the snapshot again, check the run and the result; non-zero exit when the review does not count')
    .option('--result <file>', 'The answer of a subagent reviewer')
    .option('--json', 'Machine-readable output')
    .action((id, opts) => guard(opts, async () => {
      const res = await review.end(id, { result: opts.result, projectDir: process.cwd() });
      out(opts, { command: 'review end', ...res }, () => {
        if (!res.ok) return res.reasons.forEach((r) => console.error(`  error: ${r}`));
        for (const f of res.findings) console.log(`  ${f.severity.padEnd(8)} ${f.file}${f.line ? `:${f.line}` : ''}  ${f.claim}${f.verified ? '' : '  (not verified)'}`);
        console.log(`${res.findings.length} finding(s). ${res.verdict}`);
      });
      if (!res.ok) process.exitCode = 1;
    }));

  adr
    .command('decisions')
    .description('What every accepted and active ADR obliges: decision, constraints, scope, rules')
    .option('--json', 'Machine-readable output')
    .action((opts) => guard(opts, async () => {
      const { items, issues } = await buildDecisions({ projectDir: process.cwd() });
      const lines = renderDecisions(items);
      out(opts, { command: 'decisions', items, issues }, () => {
        lines.forEach((l) => console.log(l));
        console.log(`${items.length} ADR · ${lines.length} lines`);
        issues.forEach((i) => console.error(`  ${i.code}  ${i.file}: ${i.message}`));
      });
      // `issues` never set the exit code: the skills read this on every propose and refine,
      // and an incomplete corpus is a gap to name, not a reason to stop the run.
    }));

  adr
    .command('format [name]')
    .description('Print the CNL-P standard, or one of the profiles it ships with (§7)')
    .option('--path', 'Print the resolved file path instead of the content')
    .option('--check <file>', 'Check a document body against the named profile; any issue fails')
    .option('--json', 'Machine-readable output')
    .action((name, opts) => guard(opts, async () => {
      const doc = name ?? 'format';
      if (opts.check) {
        if (!name || name === 'format' || opts.path) throw new AifError('Use `adr format <profile> --check <file>` without --path.');
        const profile = await loadProfile(name);
        const issues = bodyIssues(await readFile(opts.check, 'utf8'), profile);
        out(opts, { command: 'format check', name, file: opts.check, issues }, () => {
          issues.forEach((i) => console.error(`  error: ${opts.check}:${i.line}: ${i.message}`));
          console.log(issues.length ? `${issues.length} format issue(s).` : 'Body conforms to the profile.');
        });
        if (issues.length) process.exitCode = 1;
        return;
      }
      let file;
      let content;
      try {
        file = resolveDoc(doc); // rejects anything that is a path rather than a name
        content = await readFile(file, 'utf8');
      } catch {
        const known = await profileNames();
        throw new AifError(
          'Unknown CNL-P document.\n' +
            `  expected: format, or one of ${known.join(', ')}\n` +
            `  detected: ${JSON.stringify(doc)}\n` +
            '  files:    nothing was changed\n' +
            '  next:     run `ai-factory adr format` for the standard itself',
        );
      }
      out(opts, { command: 'format', name: doc, path: file, content }, () => {
        console.log(opts.path ? file : content);
      });
    }));

  adr
    .command('cnlp')
    .description('Run the cnlp-kit CLI bundled with this extension (`npx cnlp` does not reach it); `check` adds the ADR corpus first')
    .argument('[args...]', 'arguments for cnlp, e.g. `check`, `print format`, `init`')
    .helpOption(false)
    .allowUnknownOption()
    .action((args) => guard({}, async () => {
      if (args[0] === 'check') await syncCorpus();
      const res = runCnlp(args);
      if (res.error) throw res.error;
      process.exitCode = res.status ?? 1;
    }));

  const live = adr
    .command('live')
    .description('Print LIVE.md, what the product does now; subcommands init, apply, check')
    .option('--json', 'Machine-readable output')
    .action((opts) => guard(opts, async () => {
      const file = await liveFile(process.cwd());
      if (!existsSync(file)) {
        throw liveMissing({ projectDir: process.cwd(), livePath: file });
      }
      const content = await readFile(file, 'utf8');
      out(opts, { command: 'live', path: file, content }, () => process.stdout.write(content));
    }));

  // Commander consumes --json on the parent `live`; carry it into each subcommand.
  const liveOpts = (opts) => Object.assign(opts, { json: opts.json || live.opts().json });

  live
    .command('init')
    .description('Create LIVE.md with no capability recorded yet; adr-live-seed fills it in a project with ADRs')
    .option('--json', 'Machine-readable output')
    .action((opts) => guard(liveOpts(opts), async () => {
      const res = await initLive({ projectDir: process.cwd() });
      out(opts, { command: 'live init', ...res }, () => {
        console.log(`Created ${res.live} (since ${res.since}).`);
        if (!res.acceptedWithoutDelta.length) return;
        console.log(`Accepted ADRs without live: (${res.acceptedWithoutDelta.length}); \`adr status --check\` fails on each until it has one:`);
        for (const a of res.acceptedWithoutDelta) console.log(`  ${a.id}  ${a.file}`);
        console.log('next: add live: by hand, with changes: or none:, or run adr-live-seed');
      });
    }));

  live
    .command('apply [file]')
    .description('Apply an active ADR or plan delta to LIVE.md')
    .option('--pending', 'Apply every unapplied delta in completion order; continue past failures')
    .option('--dry-run', 'Print the effect, the warnings and the guard; write nothing (any ADR status)')
    .option('--json', 'Machine-readable output')
    .action((file, opts) => guard(liveOpts(opts), async () => {
      if (opts.pending) {
        if (file || opts.dryRun) throw new Error('Use --pending without a file or --dry-run.');
        const res = await applyPending({ projectDir: process.cwd() });
        out(opts, { command: 'live apply', ...res }, () => {
          if (res.skipped) return console.log(`skipped: ${res.skipped}`);
          for (const result of res.results) {
            console.log(`Applied ${result.source}.`);
            printLive(result);
          }
          for (const failure of res.failures) console.error(`${failure.source}: ${failure.error}`);
          console.log(`${res.results.length} applied; ${res.failures.length} failed.`);
        });
        if (res.failures.length) process.exitCode = 1;
        return;
      }
      if (!file) throw new Error('Pass a source file or --pending.');
      if (!opts.dryRun) await assertClaimBranch(file, { projectDir: process.cwd(), command: 'live apply' });
      const res = await applySource(file, { projectDir: process.cwd(), dryRun: Boolean(opts.dryRun) });
      out(opts, { command: 'live apply', ...res }, () => {
        if (res.skipped) return console.log(`skipped: ${res.skipped}`);
        printLive(res);
        console.log(res.dryRun
          ? `Dry run: LIVE.md ${res.changed ? 'would change' : 'would not change'}; nothing was written.`
          : `Applied ${res.id} to ${res.live}${res.applied ? ` (applied: ${res.applied})` : ''}.`);
      });
    }));

  live
    .command('check')
    .description('Broken, ambiguous and stale refs in LIVE.md, and every delta that never reached it (exit 0; exit 1 without LIVE.md)')
    .option('--json', 'Machine-readable output')
    .action((opts) => guard(liveOpts(opts), async () => {
      const res = await checkLive({ projectDir: process.cwd() });
      if (!res.exists) throw liveMissing({ projectDir: process.cwd(), livePath: await liveFile(process.cwd()) });
      out(opts, { command: 'live check', ...res }, () => {
        res.issues.forEach((i) => console.error(`  ${i.code}  ${i.target}: ${i.message}`));
        console.log(res.issues.length ? `${res.issues.length} issue(s).` : 'LIVE.md is consistent.');
      });
      // Like `adr decisions`: the skills read the codes and decide; a gap is not a failed run.
    }));

  return adr;
}

/** What an apply did to LIVE.md, as finalize and `adr live apply` print it. */
function printLive(res) {
  for (const o of res.ops) console.log(`  LIVE.md ${o.op.padEnd(8)} ${o.id ?? o.ids.join(', ')}`);
  res.warnings.forEach((w) => console.warn(`  warning: ${w}`));
}

/** Run the AIF project/version gate (§7, §29) then the action; convert failures to the §27 error contract. */
async function guard(opts, fn) {
  try {
    await detectAif();
    await fn();
  } catch (err) {
    if (opts?.json) console.error(JSON.stringify({ error: err.message }));
    else console.error(err.message);
    process.exitCode = 1;
    if (!(err instanceof AifError) && process.env.ADR_DEBUG) console.error(err.stack);
  }
}
