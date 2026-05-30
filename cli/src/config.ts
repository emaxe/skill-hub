import fs from 'fs';
import path from 'path';
import os from 'os';
import { AgentName, ExtensionType } from './catalog';

export interface AiAgentConfig {
  enabled: boolean;
  useProxy: boolean;
}

export interface AiAgentsConfig {
  proxy: string;
  agents: Record<AgentName, AiAgentConfig>;
}

export interface ConfigHistory {
  registryUrl?: string[];
  proxy?: string[];
}

export interface SkillHubConfig {
  agent: AgentName;
  defaultScope: 'global' | 'project';
  registryUrl: string;
  /** Текущий проект. Расширения с несовместимым projects фильтруются/помечаются. */
  project?: string;
  aiAgents: AiAgentsConfig;
  history?: ConfigHistory;
}

export type ConfigSource = 'global' | 'project';

export interface ProjectExtensionRecord {
  type: ExtensionType;
  name: string;
  version?: string;
  scope: 'global' | 'project';
  /** Источник установки (например, 'skillssh:owner/repo@slug') */
  source?: string;
}

export interface ResolvedConfig {
  config: SkillHubConfig;
  source: ConfigSource;
  projectRoot: string | null;
}

/** Формат публичной части проектного конфига (.skill-hub.json) — коммитится в git */
export interface ProjectPublicConfig {
  registryUrl?: string;
  project?: string;
  extensions?: ProjectExtensionRecord[];
  /** Добавлять проектные папки ИИ-агентов в .gitignore */
  gitignoreAgentDirs?: boolean;
}

/** Формат локальной части проектного конфига (.skill-hub.local.json) — в .gitignore */
export interface ProjectLocalConfig {
  agent?: AgentName;
  defaultScope?: 'global' | 'project';
  aiAgents?: AiAgentsConfig;
  history?: ConfigHistory;
}

const CONFIG_DIR = path.join(os.homedir(), '.skill-hub');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const PROJECT_CONFIG_NAME = '.skill-hub.json';
const PROJECT_LOCAL_CONFIG_NAME = '.skill-hub.local.json';

const DEFAULT_CONFIG: SkillHubConfig = {
  agent: 'claude-code',
  defaultScope: 'project',
  registryUrl: 'https://github.com/emaxe/skill-hub-catalog.git',
  aiAgents: {
    proxy: '',
    agents: {
      'claude-code':        { enabled: false, useProxy: false },
      'cursor':             { enabled: false, useProxy: false },
      'copilot':            { enabled: false, useProxy: false },
      'codex':              { enabled: false, useProxy: false },
      'agents-conventions': { enabled: false, useProxy: false },
    },
  },
};

function mergeWithDefaults(raw: Partial<SkillHubConfig>): SkillHubConfig {
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    aiAgents: {
      ...DEFAULT_CONFIG.aiAgents,
      ...(raw.aiAgents || {}),
      agents: {
        ...DEFAULT_CONFIG.aiAgents.agents,
        ...(raw.aiAgents?.agents || {}),
      },
    },
    history: {
      registryUrl: raw.history?.registryUrl ?? [],
      proxy: raw.history?.proxy ?? [],
    },
  };
}

// Маркеры агентских scope-директорий — указывают, что директория является отдельным проектом
const AGENT_SCOPE_MARKERS = ['.claude', '.cursor', '.codex', '.agents'];

function hasAgentScopeDirs(dir: string): boolean {
  return AGENT_SCOPE_MARKERS.some(m => {
    try {
      return fs.statSync(path.join(dir, m)).isDirectory();
    } catch {
      return false;
    }
  });
}

// Ищет корень проекта вверх от cwd.
// Приоритет: ближайшая директория с агентскими папками (.claude/, .cursor/, .agents/)
// имеет приоритет над родительской с .skill-hub.json. Поиск ограничен .git границей.
export function findProjectRoot(from: string = process.cwd()): string | null {
  let dir = path.resolve(from);
  const root = path.parse(dir).root;
  let firstAgentDir: string | null = null;

  while (dir !== root) {
    // .skill-hub.json — сильный маркер, но ближайшая агентская директория приоритетнее
    if (fs.existsSync(path.join(dir, PROJECT_CONFIG_NAME))) {
      return firstAgentDir ?? dir;
    }

    // Запоминаем первую (ближайшую к CWD) директорию с агентскими папками
    if (!firstAgentDir && hasAgentScopeDirs(dir)) {
      firstAgentDir = dir;
    }

    // .git — граница поиска
    if (fs.existsSync(path.join(dir, '.git'))) {
      return firstAgentDir ?? dir;
    }

    dir = path.dirname(dir);
  }

  return firstAgentDir ?? null;
}

export function getProjectConfigPath(projectRoot: string): string {
  return path.join(projectRoot, PROJECT_CONFIG_NAME);
}

export function getProjectLocalConfigPath(projectRoot: string): string {
  return path.join(projectRoot, PROJECT_LOCAL_CONFIG_NAME);
}

// --- Глобальный конфиг ---

export function loadConfig(): SkillHubConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as Partial<SkillHubConfig>;
      return mergeWithDefaults(raw);
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: SkillHubConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// --- Миграция и обеспечение проектного конфига ---

/** Определяет, является ли файл .skill-hub.json старым форматом (с обёрткой settings) */
function isOldProjectConfigFormat(file: Record<string, unknown>): boolean {
  return file != null && typeof file === 'object' && 'settings' in file;
}

/**
 * Мигрирует старый формат .skill-hub.json (settings + extensions в одном файле)
 * в новый двухфайловый формат. Идемпотентна: если файл уже в новом формате — ничего не делает.
 * @returns true если миграция была выполнена
 */
export function migrateOldProjectConfig(projectRoot: string): boolean {
  const publicPath = getProjectConfigPath(projectRoot);
  if (!fs.existsSync(publicPath)) return false;

  let file: Record<string, unknown>;
  try {
    file = JSON.parse(fs.readFileSync(publicPath, 'utf-8'));
  } catch {
    return false;
  }

  if (!isOldProjectConfigFormat(file)) return false;

  const settings = (file.settings ?? {}) as Partial<SkillHubConfig>;
  const extensions = (Array.isArray(file.extensions) ? file.extensions : []) as ProjectExtensionRecord[];

  // Публичный файл: registryUrl, project, extensions
  const publicConfig: ProjectPublicConfig = {
    registryUrl: settings.registryUrl ?? DEFAULT_CONFIG.registryUrl,
    project: settings.project,
    extensions,
  };
  fs.writeFileSync(publicPath, JSON.stringify(publicConfig, null, 2));

  // Локальный файл: agent, defaultScope, aiAgents, history
  const localPath = getProjectLocalConfigPath(projectRoot);
  const localConfig: ProjectLocalConfig = {
    agent: settings.agent ?? DEFAULT_CONFIG.agent,
    defaultScope: settings.defaultScope ?? DEFAULT_CONFIG.defaultScope,
    aiAgents: settings.aiAgents ?? DEFAULT_CONFIG.aiAgents,
    history: settings.history,
  };
  fs.writeFileSync(localPath, JSON.stringify(localConfig, null, 2));

  return true;
}

/**
 * Добавляет .skill-hub.local.json в .gitignore если ещё нет.
 * Создаёт .gitignore если он не существует.
 */
export function ensureGitignore(projectRoot: string): void {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const entry = PROJECT_LOCAL_CONFIG_NAME;

  let content = '';
  try {
    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, 'utf-8');
    }
  } catch {
    // ignore
  }

  // Проверяем, есть ли уже запись (как точная строка в отдельной строке)
  const lines = content.split('\n');
  if (lines.some(line => line.trim() === entry)) return;

  const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(gitignorePath, content + separator + entry + '\n');
}

/**
 * Обеспечивает наличие локального конфига: если публичный есть, а локального нет —
 * создаёт локальный из глобальных настроек.
 */
export function ensureProjectLocalConfig(projectRoot: string): void {
  const localPath = getProjectLocalConfigPath(projectRoot);
  if (fs.existsSync(localPath)) return;

  const publicPath = getProjectConfigPath(projectRoot);
  if (!fs.existsSync(publicPath)) return;

  const globalConfig = loadConfig();
  const localConfig: ProjectLocalConfig = {
    agent: globalConfig.agent,
    defaultScope: globalConfig.defaultScope,
    aiAgents: globalConfig.aiAgents,
    history: globalConfig.history,
  };
  fs.writeFileSync(localPath, JSON.stringify(localConfig, null, 2));
}

/**
 * Оркестратор: миграция старого формата → обеспечение локального конфига → gitignore.
 * Идемпотентна, безопасна для повторных вызовов.
 */
export function ensureProjectConfig(projectRoot: string): void {
  migrateOldProjectConfig(projectRoot);
  ensureProjectLocalConfig(projectRoot);
  ensureGitignore(projectRoot);
}

// --- Проектный конфиг ---

export function loadProjectConfig(projectRoot?: string): SkillHubConfig | null {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return null;

  const publicPath = getProjectConfigPath(root);
  if (!fs.existsSync(publicPath)) return null;

  // Обеспечиваем наличие обоих файлов (миграция + auto-create local)
  ensureProjectConfig(root);

  try {
    // Публичный: registryUrl, project
    let publicData: ProjectPublicConfig = {};
    if (fs.existsSync(publicPath)) {
      publicData = JSON.parse(fs.readFileSync(publicPath, 'utf-8')) as ProjectPublicConfig;
    }

    // Локальный: agent, defaultScope, aiAgents, history
    let localData: ProjectLocalConfig = {};
    const localPath = getProjectLocalConfigPath(root);
    if (fs.existsSync(localPath)) {
      localData = JSON.parse(fs.readFileSync(localPath, 'utf-8')) as ProjectLocalConfig;
    }

    const merged: Partial<SkillHubConfig> = {
      registryUrl: publicData.registryUrl,
      project: publicData.project,
      agent: localData.agent,
      defaultScope: localData.defaultScope,
      aiAgents: localData.aiAgents,
      history: localData.history,
    };
    return mergeWithDefaults(merged);
  } catch {
    // ignore
  }
  return null;
}

export function saveProjectConfig(config: SkillHubConfig, projectRoot?: string): void {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return;

  // Публичный файл: registryUrl, project (сохраняем extensions)
  const publicPath = getProjectConfigPath(root);
  let existingPublic: ProjectPublicConfig = {};
  try {
    if (fs.existsSync(publicPath)) {
      existingPublic = JSON.parse(fs.readFileSync(publicPath, 'utf-8')) as ProjectPublicConfig;
    }
  } catch {
    // ignore
  }
  existingPublic.registryUrl = config.registryUrl;
  existingPublic.project = config.project;
  fs.writeFileSync(publicPath, JSON.stringify(existingPublic, null, 2));

  // Локальный файл: agent, defaultScope, aiAgents, history
  const localPath = getProjectLocalConfigPath(root);
  const localConfig: ProjectLocalConfig = {
    agent: config.agent,
    defaultScope: config.defaultScope,
    aiAgents: config.aiAgents,
    history: config.history,
  };
  fs.writeFileSync(localPath, JSON.stringify(localConfig, null, 2));

  ensureGitignore(root);
}

// --- Resolved конфиг (проектный > глобальный) ---

export function resolveConfig(): ResolvedConfig {
  const projectRoot = findProjectRoot();
  if (projectRoot) {
    // Миграция + автосоздание локального конфига при наличии публичного
    const publicExists = fs.existsSync(getProjectConfigPath(projectRoot));
    if (publicExists) {
      ensureProjectConfig(projectRoot);
    }
    const projectConfig = loadProjectConfig(projectRoot);
    if (projectConfig) {
      return { config: projectConfig, source: 'project', projectRoot };
    }
  }
  return { config: loadConfig(), source: 'global', projectRoot };
}

// --- Резолв проекта (конфиг → родительские папки) ---

export interface ResolvedProject {
  project: string | null;
  /** Откуда взят проект: config — из текущего конфига, parent — из родительского .skill-hub.json */
  source: 'config' | 'parent' | null;
  /** Путь к родительскому конфигу (только для source='parent') */
  parentPath?: string;
}

/**
 * Определяет текущий проект:
 * 1. Из resolved-конфига (project поле)
 * 2. Если не задан — ищет .skill-hub.json в родительских папках выше projectRoot
 */
export function resolveProject(resolvedConfig?: ResolvedConfig): ResolvedProject {
  const resolved = resolvedConfig ?? resolveConfig();
  if (resolved.config.project) {
    return { project: resolved.config.project, source: 'config' };
  }

  // Поиск в родительских папках выше projectRoot
  const startDir = resolved.projectRoot ?? process.cwd();
  let dir = path.dirname(path.resolve(startDir));
  const root = path.parse(dir).root;

  while (dir !== root) {
    const configPath = path.join(dir, PROJECT_CONFIG_NAME);
    if (fs.existsSync(configPath)) {
      try {
        const file = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        // Поддержка обоих форматов: новый (project на верхнем уровне) и старый (settings.project)
        const parentProject = file?.project ?? file?.settings?.project;
        if (parentProject && typeof parentProject === 'string') {
          return { project: parentProject, source: 'parent', parentPath: configPath };
        }
      } catch {
        // ignore
      }
    }
    dir = path.dirname(dir);
  }

  return { project: null, source: null };
}

// Сохранить конфиг с учётом текущего source
export function saveResolvedConfig(config: SkillHubConfig, source: ConfigSource, projectRoot: string | null): void {
  if (source === 'project' && projectRoot) {
    saveProjectConfig(config, projectRoot);
  } else {
    saveConfig(config);
  }
}

// --- Действия: сохранить/сбросить ---

// Сохранить проектные настройки как глобальные
export function saveGlobalFromProject(): boolean {
  const projectRoot = findProjectRoot();
  if (!projectRoot) return false;
  const projectConfig = loadProjectConfig(projectRoot);
  if (!projectConfig) return false;
  saveConfig(projectConfig);
  return true;
}

// Сбросить проектные настройки на глобальные
export function resetProjectToGlobal(): boolean {
  const projectRoot = findProjectRoot();
  if (!projectRoot) return false;
  const globalConfig = loadConfig();
  saveProjectConfig(globalConfig, projectRoot);
  return true;
}

// При старте: если в проекте нет конфигов — создать оба из глобального
export function initProjectConfig(): boolean {
  const projectRoot = findProjectRoot();
  if (!projectRoot) return false;
  const publicPath = getProjectConfigPath(projectRoot);
  if (fs.existsSync(publicPath)) return false;

  const globalConfig = loadConfig();

  // Публичный файл: registryUrl, project, extensions
  const publicConfig: ProjectPublicConfig = {
    registryUrl: globalConfig.registryUrl,
    project: globalConfig.project,
    extensions: [],
  };
  fs.writeFileSync(publicPath, JSON.stringify(publicConfig, null, 2));

  // Локальный файл: agent, defaultScope, aiAgents, history
  const localPath = getProjectLocalConfigPath(projectRoot);
  const localConfig: ProjectLocalConfig = {
    agent: globalConfig.agent,
    defaultScope: globalConfig.defaultScope,
    aiAgents: globalConfig.aiAgents,
    history: globalConfig.history,
  };
  fs.writeFileSync(localPath, JSON.stringify(localConfig, null, 2));

  ensureGitignore(projectRoot);
  return true;
}

const MAX_HISTORY = 6;

export function pushHistory(list: string[] | undefined, value: string): string[] {
  if (!value) return list ?? [];
  const prev = list ?? [];
  const filtered = prev.filter(v => v !== value);
  return [value, ...filtered].slice(0, MAX_HISTORY);
}

// --- Проектные расширения ---

export function hasProjectConfig(projectRoot?: string): boolean {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return false;
  if (!fs.existsSync(getProjectConfigPath(root))) return false;
  ensureProjectConfig(root);
  return fs.existsSync(getProjectConfigPath(root)) && fs.existsSync(getProjectLocalConfigPath(root));
}

export function loadProjectExtensions(projectRoot?: string): ProjectExtensionRecord[] {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return [];
  const publicPath = getProjectConfigPath(root);
  try {
    if (fs.existsSync(publicPath)) {
      const file = JSON.parse(fs.readFileSync(publicPath, 'utf-8'));
      // Поддержка нового (плоского) формата — extensions на верхнем уровне
      if (file && Array.isArray(file.extensions)) {
        return file.extensions as ProjectExtensionRecord[];
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveProjectExtensions(extensions: ProjectExtensionRecord[], projectRoot?: string): void {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return;
  const publicPath = getProjectConfigPath(root);

  let existing: ProjectPublicConfig = {};
  try {
    if (fs.existsSync(publicPath)) {
      existing = JSON.parse(fs.readFileSync(publicPath, 'utf-8')) as ProjectPublicConfig;
    }
  } catch {
    // ignore
  }
  existing.extensions = extensions;
  fs.writeFileSync(publicPath, JSON.stringify(existing, null, 2));
}

export function addProjectExtension(record: ProjectExtensionRecord, projectRoot?: string): void {
  const list = loadProjectExtensions(projectRoot);
  const filtered = list.filter(e => !(e.type === record.type && e.name === record.name));
  filtered.push(record);
  saveProjectExtensions(filtered, projectRoot);
}

export function removeProjectExtension(name: string, type: ExtensionType, projectRoot?: string): void {
  const list = loadProjectExtensions(projectRoot);
  const filtered = list.filter(e => !(e.type === type && e.name === name));
  saveProjectExtensions(filtered, projectRoot);
}

// --- Настройка gitignoreAgentDirs ---

/** Читает настройку gitignoreAgentDirs из публичного проектного конфига */
export function loadGitignoreAgentDirs(projectRoot?: string): boolean {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return false;
  const publicPath = getProjectConfigPath(root);
  try {
    if (fs.existsSync(publicPath)) {
      const file = JSON.parse(fs.readFileSync(publicPath, 'utf-8')) as ProjectPublicConfig;
      return file.gitignoreAgentDirs === true;
    }
  } catch {
    // ignore
  }
  return false;
}

/** Сохраняет настройку gitignoreAgentDirs в публичный проектный конфиг */
export function saveGitignoreAgentDirs(value: boolean, projectRoot?: string): void {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return;
  const publicPath = getProjectConfigPath(root);

  let existing: ProjectPublicConfig = {};
  try {
    if (fs.existsSync(publicPath)) {
      existing = JSON.parse(fs.readFileSync(publicPath, 'utf-8')) as ProjectPublicConfig;
    }
  } catch {
    // ignore
  }
  existing.gitignoreAgentDirs = value;
  fs.writeFileSync(publicPath, JSON.stringify(existing, null, 2));
}
