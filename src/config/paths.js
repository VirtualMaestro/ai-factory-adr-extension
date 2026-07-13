import { readFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

export const STATUS_DIRS = ['proposals', 'drafts', 'accepted', 'active', 'superseded'];
export const DEFAULT_ADR_ROOT = 'docs/adr';
export const DEFAULT_PLANS = '.ai-factory/plans';
export const DEFAULT_ARCHIVE_PLANS = '.ai-factory/archive/plans';

async function readYaml(file) {
  try {
    return YAML.parse(await readFile(file, 'utf8')) ?? {};
  } catch {
    return {}; // absent/unreadable → callers fall back to documented defaults (§26)
  }
}

/** ADR root from the extension config (`adr.root`), defaulting to docs/adr (§26). */
export async function adrRoot(projectDir = process.cwd()) {
  const cfg = await readYaml(path.join(projectDir, '.ai-factory', 'adr-extension.yaml'));
  const root = cfg?.adr?.root || DEFAULT_ADR_ROOT;
  return path.resolve(projectDir, root);
}

/**
 * Plans + archived-plans locations, read only from AI Factory's config.yaml (§26 — never duplicated
 * in extension config). Falls back to documented defaults when `paths.*` are absent.
 * ponytail: archive-plans is `paths.archive`/plans; if paths.archive already targets plans, P3 revisits.
 */
export async function readAifPaths(projectDir = process.cwd()) {
  const cfg = await readYaml(path.join(projectDir, '.ai-factory', 'config.yaml'));
  const plans = cfg?.paths?.plans || DEFAULT_PLANS;
  const archiveBase = cfg?.paths?.archive;
  const archivePlans = archiveBase ? path.posix.join(archiveBase.replace(/\/$/, ''), 'plans') : DEFAULT_ARCHIVE_PLANS;
  return {
    plans: path.resolve(projectDir, plans),
    archivePlans: path.resolve(projectDir, archivePlans),
  };
}
