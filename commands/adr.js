import { detectAif, AifError } from '../src/aif/detect.js';
import { init } from '../src/init.js';

/**
 * Registered by AI Factory via the `commands` manifest entry: `mod.register(program)` where
 * `program` is AIF's Commander instance (dist/cli/index.js). Adds the `adr` command group.
 */
export function register(program) {
  const adr = program.command('adr').description('Architecture Decision Record lifecycle');

  adr
    .command('init')
    .description('Create the ADR directory structure and default configuration (idempotent)')
    .option('--json', 'Machine-readable output')
    .action((opts) => guard(opts, async () => {
      const { items } = await init();
      if (opts.json) {
        console.log(JSON.stringify({ command: 'init', items }, null, 2));
      } else {
        for (const it of items) console.log(`  ${it.status.padEnd(8)} ${it.item}`);
        const created = items.filter((i) => i.status === 'created').length;
        console.log(created ? `ADR structure ready (${created} created).` : 'ADR structure already present.');
      }
    }));

  return adr;
}

/** Run the AIF project/version gate (§7, §29) then the action; convert failures to the §27 error contract. */
async function guard(opts, fn) {
  try {
    await detectAif();
    await fn();
  } catch (err) {
    if (err instanceof AifError) {
      if (opts?.json) console.error(JSON.stringify({ error: err.message }));
      else console.error(err.message);
      process.exitCode = 1;
      return;
    }
    throw err;
  }
}
