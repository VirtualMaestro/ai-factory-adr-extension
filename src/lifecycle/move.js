import { unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { read, serialize } from '../artifacts/frontmatter.js';
import { DIR_BY_STATUS, isValidStatus, validateDirStatus } from './status.js';
import { isLegal, legalTargets } from './transitions.js';
import { resolveActivePlan } from '../artifacts/plan.js';
import { resolveInside, atomicWrite } from '../util/safe-path.js';
import { stageMove } from '../util/git.js';
import { liveFile } from '../config/paths.js';
import { deltaProblems } from '../live/delta.js';
import { gateProblem, gateError, liveMissing } from '../live/apply.js';
import { syncCorpus } from '../cnlp-setup.js';
import { CLAIM_KEYS } from './claim.js';
import { readFileSync } from 'node:fs';

class TransitionError extends Error {}

/**
 * Atomic status edit + directory move (§20, inv 15). Single operation with rollback:
 * on any failure no partial state remains (source stays; target removed).
 * Returns { id, from, to, source, target }.
 */
export function transitionTarget(file, toStatus, { projectDir = process.cwd() } = {}) {
  const source = resolveInside(projectDir, file);
  return resolveInside(
    projectDir,
    path.join(path.dirname(path.dirname(source)), DIR_BY_STATUS[toStatus], path.basename(source)),
  );
}

export async function transition(file, toStatus, { projectDir = process.cwd(), managed = false } = {}) {
  const source = resolveInside(projectDir, file);

  if (!isValidStatus(toStatus)) {
    throw new TransitionError(
      'Unknown target status.\n' +
        `  expected: one of ${Object.keys(DIR_BY_STATUS).join(', ')}\n` +
        `  detected: ${toStatus}\n` +
        '  files:    nothing was changed\n' +
        '  next:     pass a valid lifecycle status',
    );
  }
  if (!existsSync(source)) {
    throw new TransitionError(
      'ADR file not found.\n' +
        `  expected: an existing file\n  detected: ${source} is missing\n` +
        '  files:    nothing was changed\n  next:     check the path',
    );
  }

  const { data, body } = await read(source);
  const from = data.status;

  const dirCheck = validateDirStatus(source, from);
  if (!isValidStatus(from) || !dirCheck.ok) {
    throw new TransitionError(
      'Source ADR is in an inconsistent state.\n' +
        `  expected: status matching its directory (${dirCheck.expectedDir ?? '?'})\n` +
        `  detected: status=${from} in ${dirCheck.actualDir}/\n` +
        '  files:    nothing was changed\n' +
        '  next:     fix the status/directory mismatch first (`adr validate`)',
    );
  }
  if (!isLegal(from, toStatus)) {
    throw new TransitionError(
      'Illegal lifecycle transition.\n' +
        `  expected: from ${from} → one of [${legalTargets(from).join(', ') || 'none'}]\n` +
        `  detected: ${from} → ${toStatus}\n` +
        '  files:    nothing was changed\n' +
        '  next:     use an allowed transition (§17)',
    );
  }

  if (!managed && (toStatus === 'active' || toStatus === 'superseded')) {
    const command = toStatus === 'active' ? 'finalize' : 'supersede';
    throw new TransitionError(
      `The ${toStatus} status is managed by adr ${command}.\n` +
        `  expected: use \`ai-factory adr ${command} ...\`\n` +
        `  detected: direct transition ${from} → ${toStatus}\n` +
        '  files:    nothing was changed\n' +
        `  next:     run the ${command} workflow so its cross-file checks are applied`,
    );
  }
  if (from === 'accepted' && toStatus === 'draft') {
    const plan = await resolveActivePlan(data.id, { projectDir });
    if (plan) {
      throw new TransitionError(
        'Accepted ADR has an active plan.\n' +
          `  expected: no non-archived plan before returning ${data.id} to draft\n` +
          `  detected: active plan ${plan.id}\n` +
          '  files:    nothing was changed\n' +
          '  next:     archive or remove the plan explicitly, then retry',
      );
    }
  }

  // D5: an ADR states its delta before it becomes a rule, so a run never reaches implementation
  // with nothing to apply at finalize.
  if (toStatus === 'accepted') {
    const livePath = await liveFile(projectDir);
    if (!existsSync(livePath)) throw liveMissing({ projectDir, livePath });
    const delta = data.live ?? null;
    const problem = gateProblem(delta, delta == null ? [] : deltaProblems(delta, { adr: true }), { unapplied: true });
    if (problem) throw gateError(data.id, problem);
  }

  const target = transitionTarget(source, toStatus, { projectDir });
  if (existsSync(target)) {
    throw new TransitionError(
      'Target already exists.\n' +
        `  expected: no file at the destination\n  detected: ${target} exists\n` +
        '  files:    nothing was changed\n  next:     resolve the duplicate before transitioning',
    );
  }

  // A claim marks an accepted ADR in work; leaving accepted ends it (§4.1), as finalize does.
  if (toStatus !== 'accepted') for (const key of CLAIM_KEYS) delete data[key];

  // The accept below rewrites cnlp.config.json; a file it cannot parse fails here, before any move.
  if (toStatus === 'accepted') {
    const cfg = path.join(projectDir, 'cnlp.config.json');
    if (existsSync(cfg)) {
      try {
        JSON.parse(readFileSync(cfg, 'utf8'));
      } catch (err) {
        throw new TransitionError(
          'cnlp.config.json is not valid JSON.\n' +
            `  expected: a config the accept can add the ADR corpus entry to\n  detected: ${err.message}\n` +
            '  files:    nothing was changed\n  next:     fix cnlp.config.json, then retry',
        );
      }
    }
  }

  const original = readFileSync(source, 'utf8');
  data.status = toStatus;
  await atomicWrite(target, serialize(data, body));
  try {
    await unlink(source);
  } catch (err) {
    await unlink(target).catch(() => {}); // rollback: leave the source untouched
    throw err;
  }
  stageMove(source, target); // git sees a rename, not delete + untracked

  // The first accepted ADR adds the ADR corpus entry to cnlp.config.json. Doing it here lands the
  // entry in the planning commit; left to `adr cnlp check`, it dirtied the tree mid-implementation.
  const res = { id: data.id, from, to: toStatus, source, target };
  if (toStatus === 'accepted') {
    let corpus;
    try {
      corpus = await syncCorpus(projectDir);
    } catch (err) {
      // Roll the move back: the ADR is accepted only with its corpus entry.
      await atomicWrite(source, original);
      await unlink(target).catch(() => {});
      stageMove(source, target);
      throw new TransitionError(
        'cnlp.config.json could not take the ADR corpus entry.\n' +
          `  expected: a config the accept can add the ADR corpus entry to\n  detected: ${err.message}\n` +
          `  files:    nothing was changed; ${path.basename(source)} stays ${from}\n  next:     fix cnlp.config.json, then retry`,
      );
    }
    if (corpus.status === 'created' || corpus.status === 'updated') {
      stageMove(corpus.path);
      res.corpus = corpus.path;
    }
  }
  return res;
}
