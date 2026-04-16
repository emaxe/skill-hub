// --- Проверка синхронизации расширений ---
// Сравнивает .skill-hub.json (декларативный список) с фактически установленными расширениями.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { AgentName, ExtensionType, loadCatalog } from './catalog';
import { ProjectExtensionRecord, loadProjectExtensions, findProjectRoot } from './config';
import { createRegistry, InstallRecord } from './registry';
import { getAdapter } from './adapters/get-adapter';
import { filterRecordsByDirectory } from './path-filter';
import { getCachePath } from './git';

/** Базовые скиллы, встроенные в CLI — не участвуют в синхронизации с каталогом */
const BASE_SKILLS = new Set(['agents-conventions', 'skill-hub']);

export interface UntrackedExtension {
  type: ExtensionType;
  name: string;
  scope: 'project' | 'parent';
  path: string;
  /** Есть ли расширение в каталоге */
  inCatalog: boolean;
  /** Версия из каталога (если есть) */
  catalogVersion?: string;
}

export interface SyncResult {
  missing: ProjectExtensionRecord[];
  untracked: UntrackedExtension[];
}

/**
 * Проверяет, все ли расширения из .skill-hub.json установлены.
 * Сверяет реестр (installed.json) и файловую систему (scan) с декларативным списком проекта.
 */
export function checkExtensionSync(agent: AgentName): SyncResult {
  const projectRoot = findProjectRoot();
  if (!projectRoot) return { missing: [], untracked: [] };

  const projectExtensions = loadProjectExtensions(projectRoot);

  const reg = createRegistry(path.join(os.homedir(), '.skill-hub'));
  const records = reg.list(agent);
  const cwd = process.cwd();
  const homeDir = os.homedir();
  const filtered = filterRecordsByDirectory(records, cwd, homeDir);
  // Только записи, чьи файлы реально существуют на диске
  const installedSet = new Set(
    filtered
      .filter(({ record }) => fs.existsSync(record.path))
      .map(({ record }) => `${record.type}:${record.name}`)
  );

  // Собираем все project/parent расширения из filesystem scan для обратной проверки
  const localScanned: Omit<UntrackedExtension, 'inCatalog' | 'catalogVersion'>[] = [];
  try {
    const adapter = getAdapter(agent);
    const scanned = adapter.scanInstalled();
    for (const scan of scanned) {
      installedSet.add(`${scan.type}:${scan.name}`);
      // Только project/parent scope — глобальные не являются проектными
      if (scan.scope === 'project' || scan.scope === 'parent') {
        localScanned.push({ type: scan.type as ExtensionType, name: scan.name, scope: scan.scope, path: scan.path });
      }
    }
  } catch {
    // ignore scan failures
  }

  // Прямая проверка: расширения из конфига, которых нет на диске (кроме базовых скиллов)
  const missing = projectExtensions.length > 0
    ? projectExtensions.filter(e => !installedSet.has(`${e.type}:${e.name}`) && !BASE_SKILLS.has(e.name))
    : [];

  // Обратная проверка: расширения на диске (project scope), которых нет в конфиге
  const declaredSet = new Set(
    projectExtensions.map(e => `${e.type}:${e.name}`)
  );
  const untrackedRaw = localScanned.filter(
    e => !declaredSet.has(`${e.type}:${e.name}`) && !BASE_SKILLS.has(e.name)
  );

  // Проверяем наличие в каталоге и берём актуальную версию
  let catalogMap: Map<string, string> | null = null;
  try {
    const cachePath = getCachePath();
    const catalog = loadCatalog(cachePath);
    catalogMap = new Map<string, string>(
      catalog.extensions
        .filter(e => e.version)
        .map(e => [`${e.type}:${e.name}`, e.version!])
    );
  } catch {
    // каталог может быть недоступен
  }

  const untracked: UntrackedExtension[] = untrackedRaw.map(e => {
    const key = `${e.type}:${e.name}`;
    const catalogVersion = catalogMap?.get(key);
    return { ...e, inCatalog: !!catalogVersion, catalogVersion };
  });

  return { missing, untracked };
}

// --- Проверка конфликтов проектов ---

export interface ProjectConflict {
  type: ExtensionType;
  name: string;
  scope: 'global' | 'project' | 'parent';
  /** Проекты расширения (из каталога или registry) */
  extensionProjects: string[];
  path: string;
}

/**
 * Находит установленные расширения, несовместимые с текущим проектом.
 * Конфликт: project задан, у расширения projects непуст и не содержит project.
 */
export function checkProjectConflicts(agent: AgentName, project: string | null | undefined): ProjectConflict[] {
  if (!project) return [];

  const reg = createRegistry(path.join(os.homedir(), '.skill-hub'));
  const records = reg.list(agent);
  const cwd = process.cwd();
  const homeDir = os.homedir();
  const filtered = filterRecordsByDirectory(records, cwd, homeDir);

  // Загружаем каталог для получения актуальных projects
  let catalogProjects: Map<string, string[]> | null = null;
  try {
    const cachePath = getCachePath();
    const catalog = loadCatalog(cachePath);
    catalogProjects = new Map(
      catalog.extensions.map(e => [`${e.type}:${e.name}`, e.projects])
    );
  } catch {
    // каталог может быть недоступен
  }

  const conflicts: ProjectConflict[] = [];

  for (const { record, effectiveScope } of filtered) {
    if (!fs.existsSync(record.path)) continue;

    // Приоритет: каталог → registry
    const key = `${record.type}:${record.name}`;
    const projects = catalogProjects?.get(key) ?? record.projects ?? [];

    // Универсальное расширение (projects пуст) — не конфликтует
    if (projects.length === 0) continue;

    if (!projects.includes(project)) {
      conflicts.push({
        type: record.type,
        name: record.name,
        scope: effectiveScope,
        extensionProjects: projects,
        path: record.path,
      });
    }
  }

  return conflicts;
}
