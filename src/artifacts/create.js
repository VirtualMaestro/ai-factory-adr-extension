import { importAdr } from './import.js';

/**
 * Scaffold a new ADR proposal (§19.1): derive a stable id from the topic, guard against duplicate
 * ids anywhere in the lifecycle, and write `proposals/adr-<slug>.md` with `status: proposed` from
 * the template. Thin wrapper over `importAdr` pinned to the proposed status.
 * Returns { id, path }.
 */
export async function createProposal(topic, { projectDir = process.cwd() } = {}) {
  const { id, path } = await importAdr(topic, { status: 'proposed', projectDir });
  return { id, path };
}
