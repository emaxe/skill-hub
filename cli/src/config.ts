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
  aiAgents: AiAgentsConfig;
  history?: ConfigHistory;
}

export type ConfigSource = 'global' | 'project';

export interface ProjectExtensionRecord {
  type: ExtensionType;
  name: string;
  version?: string;
  scope: 'global' | 'project';
}

export interface ResolvedConfig {
  config: SkillHubConfig;
  source: ConfigSource;
  projectRoot: string | null;
}

const CONFIG_DIR = path.join(os.homedir(), '.skill-hub');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const PROJECT_CONFIG_NAME = '.skill-hub.json';

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

// Ищет корень проекта вверх от cwd: .skill-hub.json или .git
export function findProjectRoot(from: string = process.cwd()): string | null {
  let dir = path.resolve(from);
  const root = path.parse(dir).root;
  while (dir !== root) {
    if (
      fs.existsSync(path.join(dir, PROJECT_CONFIG_NAME)) ||
      fs.existsSync(path.join(dir, '.git'))
    ) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

export function getProjectConfigPath(projectRoot: string): string {
  return path.join(projectRoot, PROJECT_CONFIG_NAME);
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

// --- Проектный конфиг ---

export function loadProjectConfig(projectRoot?: string): SkillHubConfig | null {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return null;
  const configPath = getProjectConfigPath(root);
  try {
    if (fs.existsSync(configPath)) {
      const file = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (file && typeof file === 'object' && file.settings) {
        return mergeWithDefaults(file.settings as Partial<SkillHubConfig>);
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveProjectConfig(config: SkillHubConfig, projectRoot?: string): void {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return;
  const configPath = getProjectConfigPath(root);

  let existing: Record<string, unknown> = {};
  try {
    if (fs.existsSync(configPath)) {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch {
    // ignore
  }
  existing.settings = config;
  fs.writeFileSync(configPath, JSON.stringify(existing, null, 2));
}

// --- Resolved конфиг (проектный > глобальный) ---

export function resolveConfig(): ResolvedConfig {
  const projectRoot = findProjectRoot();
  if (projectRoot) {
    const projectConfig = loadProjectConfig(projectRoot);
    if (projectConfig) {
      return { config: projectConfig, source: 'project', projectRoot };
    }
  }
  return { config: loadConfig(), source: 'global', projectRoot };
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

// При старте: если в проекте нет .skill-hub.json — создать из глобального
export function initProjectConfig(): boolean {
  const projectRoot = findProjectRoot();
  if (!projectRoot) return false;
  const configPath = getProjectConfigPath(projectRoot);
  if (fs.existsSync(configPath)) return false;
  const globalConfig = loadConfig();
  saveProjectConfig(globalConfig, projectRoot);
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
  return fs.existsSync(getProjectConfigPath(root));
}

export function loadProjectExtensions(projectRoot?: string): ProjectExtensionRecord[] {
  const root = projectRoot ?? findProjectRoot();
  if (!root) return [];
  const configPath = getProjectConfigPath(root);
  try {
    if (fs.existsSync(configPath)) {
      const file = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
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
  const configPath = getProjectConfigPath(root);

  let existing: Record<string, unknown> = {};
  try {
    if (fs.existsSync(configPath)) {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch {
    // ignore
  }
  existing.extensions = extensions;
  fs.writeFileSync(configPath, JSON.stringify(existing, null, 2));
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
