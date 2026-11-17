import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { adrRoot, STATUS_DIRS } from './config/paths.js';
import { read } from './artifacts/frontmatter.js';
import { validateAdr } from './lifecycle/validate.js';
import { resolvePlans } from './artifacts/plan.js';
import { STATUS_BY_DIR } from './lifecycle/status.js';
import { existsSync } from 'node:fs';
import { liveFile, readAifPaths } from './config/paths.js';
import { readClaim, isStale, planInProgress } from './lifecycle/claim.js';

async function listPlans(projectDir) {
  const { plans, archivePlans } = await readAifPaths(projectDir);
  const out = [];
  for (const dir of [plans, archivePlans]) {
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      /* directory absent */
    }
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith('.md')) out.push(path.join(dir, e.name));
      // an ultra bundle keeps its frontmatter in `index.md`
      else if (e.isDirectory() && existsSync(path.join(dir, e.name, 'index.md'))) out.push(path.join(dir, e.name, 'index.md'));
    }
  }
  return out;
}

/** A claim as status reports it, with the stale warning of §4.3 when its branch is gone. */
function claimEntry(projectDir, id, kind, claimed) {
  return { id, kind, branch: claimed.branch, base: claimed.base, started: claimed.started, stale: isStale(projectDir, claimed) };
}

const staleWarning = (rel, c) => `${rel}: claim names ${c.branch}, which exists neither locally nor on a remote: run \`ai-factory adr unclaim\``;

export async function listAdrs(root) {
  const out = [];
  for (const dir of STATUS_DIRS) {
    let files = [];
    try {
      files = (await readdir(path.join(root, dir))).filter((f) => f.endsWith('.md'));
    } catch {
      /* directory absent → skip */
    }
    for (const f of files) out.push({ dir, file: path.join(root, dir, f) });
  }
  return out;
}

/** Every readable ADR by id: { status (from its directory), file, replaced_by }. */
export async function indexAdrsById(root) {
  const index = new Map();
  for (const { dir, file } of await listAdrs(root)) {
    try {
      const { data } = await read(file);
      const replacedBy = String(data.replaced_by ?? '').trim() || null;
      if (data.id != null) index.set(data.id, { status: STATUS_BY_DIR[dir], file, replaced_by: replacedBy });
    } catch {
      /* malformed ADRs are reported by status --check / audit-artifacts */
    }
  }
  return index;
}

function checkDependencies(data, index) {
  const ids = Array.isArray(data.depends_on)
    ? data.depends_on
    : data.depends_on == null ? [] : [data.depends_on];
  const warnings = [];
  for (const id of ids) {
    const dependency = index.get(id);
    if (!dependency || dependency.status === 'active') continue;
    warnings.push(
      dependency.status === 'superseded'
        ? `depends on superseded "${id}"; consider its replacement`
        : `depends on "${id}" which is not yet active (status: ${dependency.status})`,
    );
  }
  return warnings;
}

/**
 * Project-wide ADR overview (§19.8). `issues` collects blocking ADR-specific problems (dir/status
 * mismatch, multi-plan, placeholders). Duplicate ids / broken refs are the audit's job (run separately).
 */
export async function buildStatus(projectDir = process.cwd()) {
  const root = await adrRoot(projectDir);
  const rel = (f) => path.relative(projectDir, f);
  const report = { proposals: [], drafts: [], acceptedNoPlan: [], acceptedWithPlan: [], active: [], superseded: [], inWork: [], issues: [], warnings: [] };
  const livePath = await liveFile(projectDir);
  if (!existsSync(livePath)) {
    report.issues.push(`${rel(livePath)}: not found: every project keeps LIVE.md; run adr-live-seed when the project has an active ADR; otherwise run \`ai-factory adr live init\``);
  }

  for (const { dir, file } of await listAdrs(root)) {
    let data;
    try {
      ({ data } = await read(file));
    } catch (err) {
      report.issues.push(`${rel(file)}: ${err.message}`);
      continue;
    }
    const { errors } = await validateAdr(file, { projectDir });
    for (const e of errors) report.issues.push(`${rel(file)}: ${e}`);

    const status = STATUS_BY_DIR[dir];
    const id = data.id ?? rel(file);
    const claimed = readClaim(data);
    if (claimed) {
      const entry = claimEntry(projectDir, id, 'adr', claimed);
      report.inWork.push(entry);
      if (entry.stale) report.warnings.push(staleWarning(rel(file), claimed));
    }
    if (status === 'proposed') report.proposals.push(id);
    else if (status === 'draft') report.drafts.push(id);
    else if (status === 'active') report.active.push(id);
    else if (status === 'superseded') report.superseded.push(id);
    else if (status === 'accepted') {
      const { active } = await resolvePlans(data.id, { projectDir });
      (active.length ? report.acceptedWithPlan : report.acceptedNoPlan).push(id);
    }
  }

  // Plan claims (§4.7): only a plan in progress is in work.
  for (const file of await listPlans(projectDir)) {
    let data;
    try {
      ({ data } = await read(file));
    } catch {
      continue;
    }
    const claimed = readClaim(data);
    if (!claimed) continue;
    if (!planInProgress(data)) {
      report.issues.push(`${rel(file)}: claim on a done plan: only a plan in progress is in work; remove it with \`ai-factory adr claim --release\``);
      continue;
    }
    const entry = claimEntry(projectDir, data.id ?? rel(file), 'plan', claimed);
    report.inWork.push(entry);
    if (entry.stale) report.warnings.push(staleWarning(rel(file), claimed));
  }
  return report;
}

/** Single-ADR detail (§19.8): id, status, location, linked plan, evidence, relations, validation. */
export async function buildFileStatus(file, projectDir = process.cwd()) {
  const { data } = await read(file);
  const { active, plans } = await resolvePlans(data.id, { projectDir });
  const { errors, warnings } = await validateAdr(file, { projectDir });
  const dependencyWarnings = checkDependencies(
    data,
    await indexAdrsById(await adrRoot(projectDir)),
  );
  const evidence = String(data.evidence ?? '').trim() || null;
  const claimed = readClaim(data);
  const claim = claimed ? claimEntry(projectDir, data.id, 'adr', claimed) : null;
  if (claim?.stale) warnings.push(staleWarning(path.relative(projectDir, path.resolve(file)), claimed));
  const replacedBy = String(data.replaced_by ?? '').trim() || null;
  return {
    id: data.id,
    status: data.status,
    location: path.relative(projectDir, path.resolve(file)),
    plan: data.plan ?? null,
    activePlan: active[0]?.id ?? null,
    archivedPlans: plans.filter((p) => p.archived).map((p) => p.id),
    evidence,
    replacedBy,
    depends_on: data.depends_on ?? [],
    affects: data.affects ?? [],
    supersedes: data.supersedes ?? [],
    claim,
    errors,
    warnings: [...warnings, ...dependencyWarnings],
  };
}
