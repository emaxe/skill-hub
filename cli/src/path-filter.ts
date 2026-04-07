import path from 'path';

export type EffectiveScope = 'global' | 'project' | 'parent';

const AGENT_MARKERS = ['/.claude/', '/.cursor/', '/.github/', '/.agents/'];

function extractProjectRoot(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/');
  for (const marker of AGENT_MARKERS) {
    const idx = normalized.indexOf(marker);
    if (idx !== -1) {
      return normalized.slice(0, idx);
    }
  }
  return null;
}

export function classifyRecord(
  record: { scope: 'global' | 'project' | 'parent'; path: string },
  cwd: string,
  homeDir: string,
): EffectiveScope | null {
  if (record.scope === 'global') return 'global';

  const projectRoot = extractProjectRoot(record.path);
  if (!projectRoot) return null;

  const normalizedCwd = cwd.replace(/\\/g, '/').replace(/\/$/, '');
  const normalizedRoot = projectRoot.replace(/\/$/, '');

  if (normalizedCwd === normalizedRoot) return 'project';
  if (normalizedCwd.startsWith(normalizedRoot + '/')) return 'parent';
  return null;
}

export function filterRecordsByDirectory<T extends { scope: 'global' | 'project' | 'parent'; path: string }>(
  records: T[],
  cwd: string,
  homeDir: string,
): Array<{ record: T; effectiveScope: EffectiveScope }> {
  const result: Array<{ record: T; effectiveScope: EffectiveScope }> = [];
  for (const record of records) {
    const es = classifyRecord(record, cwd, homeDir);
    if (es !== null) {
      result.push({ record, effectiveScope: es });
    }
  }
  return result;
}
