// --- Проверка синхронизации расширений ---
// Сравнивает .skill-hub.json (декларативный список) с фактически установленными расширениями.

import os from 'os';
import path from 'path';
import { AgentName } from './catalog';
import { ProjectExtensionRecord, loadProjectExtensions, findProjectRoot } from './config';
import { createRegistry } from './registry';
import { getAdapter } from './adapters/get-adapter';
import { filterRecordsByDirectory } from './path-filter';

export interface SyncResult {
  missing: ProjectExtensionRecord[];
}

/**
 * Проверяет, все ли расширения из .skill-hub.json установлены.
 * Сверяет реестр (installed.json) и файловую систему (scan) с декларативным списком проекта.
 */
export function checkExtensionSync(agent: AgentName): SyncResult {
  const projectRoot = findProjectRoot();
  if (!projectRoot) return { missing: [] };

  const projectExtensions = loadProjectExtensions(projectRoot);
  if (projectExtensions.length === 0) return { missing: [] };

  const reg = createRegistry(path.join(os.homedir(), '.skill-hub'));
  const records = reg.list(agent);
  const cwd = process.cwd();
  const homeDir = os.homedir();
  const filtered = filterRecordsByDirectory(records, cwd, homeDir);
  const installedSet = new Set(
    filtered.map(({ record }) => `${record.type}:${record.name}`)
  );

  // Также проверяем через filesystem scan
  try {
    const adapter = getAdapter(agent);
    const scanned = adapter.scanInstalled();
    for (const scan of scanned) {
      installedSet.add(`${scan.type}:${scan.name}`);
    }
  } catch {
    // ignore scan failures
  }

  const missing = projectExtensions.filter(
    e => !installedSet.has(`${e.type}:${e.name}`)
  );

  return { missing };
}
