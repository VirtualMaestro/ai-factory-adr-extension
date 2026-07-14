import { detectAif, AifError } from '../src/aif/detect.js';
import { init } from '../src/init.js';
import { validateAdr } from '../src/lifecycle/validate.js';
import { transition } from '../src/lifecycle/move.js';
import { resolvePlans } from '../src/artifacts/plan.js';
import { linkPlan } from '../src/artifacts/links.js';
import { finalize } from '../src/lifecycle/finalize.js';
import { supersede } from '../src/lifecycle/supersede.js';
import { buildStatus, buildFileStatus } from '../src/status.js';
import { runAudit } from '../src/audit.js';
import { createProposal } from '../src/artifacts/create.js';
import { importAdr } from '../src/artifacts/import.js';

/**
 * Registered by AI Factory via the `commands` manifest entry: `mod.register(program)` where
 * `program` is AIF's Commander instance (dist/cli/index.js). Adds the `adr` command group.
 */
export function register(program) {
  const adr = program.command('adr').description('Architecture Decision Record lifecycle');
  const out = (opts, obj, human) => (opts.json ? console.log(JSON.stringify(obj, null, 2)) : human());

  adr
    .command('init')
    .description('Create the ADR directory structure and default configuration (idempotent)')
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
    .action((file, opts) => guard(opts, async () => {
      const res = await validateAdr(file, { projectDir: process.cwd() });
      out(opts, { command: 'validate', file, ...res }, () => {
        res.errors.forEach((e) => console.error(`  error:   ${e}`));
        res.warnings.forEach((w) => console.warn(`  warning: ${w}`));
        console.log(res.errors.length ? `Invalid: ${res.errors.length} error(s).` : 'Valid.');
      });
      if (res.errors.length) process.exitCode = 1;
    }));

  adr
    .command('transition <file> <status>')
    .description('Move an ADR to a new lifecycle status (atomic; §17)')
    .option('--json', 'Machine-readable output')
    .action((file, status, opts) => guard(opts, async () => {
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
      const res = await linkPlan(adrFile, planFile, { projectDir: process.cwd() });
      out(opts, { command: 'link-plan', ...res }, () => console.log(`Linked ${res.adrId} ↔ ${res.planId}`));
    }));

  adr
    .command('finalize <file>')
    .description('Activate an accepted ADR and archive its plan (deterministic core)')
    .option('--json', 'Machine-readable output')
    .action((file, opts) => guard(opts, async () => {
      const res = await finalize(file, { projectDir: process.cwd() });
      out(opts, { command: 'finalize', ...res }, () => {
        console.log(`Activated ${res.id}: ${res.active}`);
        if (res.archivedPlan) console.log(`Archived plan: ${res.archivedPlan}`);
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
      const res = await supersede(oldFile, newFile, { projectDir: process.cwd(), planDisposition });
      out(opts, { command: 'supersede', ...res }, () => {
        console.log(`${res.oldId} superseded by ${res.newId}: ${res.superseded}`);
        if (res.plan) console.log(`Plan ${res.plan.action}.`);
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
        report.issues.forEach((i) => console.error(`  issue: ${i}`));
      });
      const auditFailed = audit && audit.code !== 0 && audit.code !== null;
      if (opts.check && (report.issues.length || auditFailed)) process.exitCode = 1;
    }));

  return adr;
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
