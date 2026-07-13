import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export const CONFIG_VERSION = 1;

export const DEFAULT_CONFIG = {
  version: CONFIG_VERSION,
  adr: {
    root: 'docs/adr',
    lifecycle: {
      requireAlternatives: true,
      requireNegativeConsequences: true,
      allowDocumentationOnly: true,
    },
    memory: { provider: 'none' },
    codeIntelligence: { provider: 'none' },
  },
};

export function configPath(projectDir = process.cwd()) {
  return path.join(projectDir, '.ai-factory', 'adr-extension.yaml');
}

/**
 * Create the extension config with defaults iff absent (§26 — never overwrites an existing file).
 * Returns { created: boolean, path }.
 */
export async function ensureConfig(projectDir = process.cwd()) {
  const file = configPath(projectDir);
  if (existsSync(file)) return { created: false, path: file };
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, YAML.stringify(DEFAULT_CONFIG), 'utf8');
  return { created: true, path: file };
}

export async function readConfig(projectDir = process.cwd()) {
  const file = configPath(projectDir);
  if (!existsSync(file)) return null;
  return YAML.parse(await readFile(file, 'utf8'));
}
