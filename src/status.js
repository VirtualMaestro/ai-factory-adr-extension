import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { adrRoot, STATUS_DIRS } from './config/paths.js';
import { read } from './artifacts/frontmatter.js';
import { validateAdr } from './lifecycle/validate.js';
import { resolvePlans } from './artifacts/plan.js';
import { STATUS_BY_DIR } from './lifecycle/status.js';

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

async function indexAdrsById(root) {
  const index = new Map();
  for (const { dir, file } of await listAdrs(root)) {
    try {
      const { data } = await read(file);
      if (data.id != null) index.set(data.id, { status: STATUS_BY_DIR[dir], file });
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
  const report = { proposals: [], drafts: [], acceptedNoPlan: [], acceptedWithPlan: [], active: [], superseded: [], issues: [] };

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
    if (status === 'proposed') report.proposals.push(id);
    else if (status === 'draft') report.drafts.push(id);
    else if (status === 'active') report.active.push(id);
    else if (status === 'superseded') report.superseded.push(id);
    else if (status === 'accepted') {
      const { active } = await resolvePlans(data.id, { projectDir });
      (active.length ? report.acceptedWithPlan : report.acceptedNoPlan).push(id);
    }
  }
  return report;
}

/** Single-ADR detail (§19.8): id, status, location, linked plan, evidence, relations, validation. */
export async function buildFileStatus(file, projectDir = process.cwd()) {
  const { data, body } = await read(file);
  const { active, plans } = await resolvePlans(data.id, { projectDir });
  const { errors, warnings } = await validateAdr(file, { projectDir });
  const dependencyWarnings = checkDependencies(
    data,
    await indexAdrsById(await adrRoot(projectDir)),
  );
  const evidence = body.match(/- \*\*Evidence:\*\* (.*)/)?.[1]?.trim() ?? null;
  const replacedBy = body.match(/- \*\*Replaced by:\*\* (.*)/)?.[1]?.trim() ?? null;
  return {
    id: data.id,
    status: data.status,
    location: path.relative(projectDir, path.resolve(file)),
    activePlan: active[0]?.id ?? null,
    archivedPlans: plans.filter((p) => p.archived).map((p) => p.id),
    evidence,
    replacedBy,
    depends_on: data.depends_on ?? [],
    affects: data.affects ?? [],
    supersedes: data.supersedes ?? [],
    errors,
    warnings: [...warnings, ...dependencyWarnings],
  };
}
