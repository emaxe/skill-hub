import fs from 'fs';
import path from 'path';
import os from 'os';
import { AgentName } from './catalog';

export interface AiAgentConfig {
  enabled: boolean;
  useProxy: boolean;
}

export interface AiAgentsConfig {
  proxy: string;
  agents: Record<AgentName, AiAgentConfig>;
}

export interface SkillHubConfig {
  agent: AgentName;
  defaultScope: 'global' | 'project';
  registryUrl: string;
  aiAgents: AiAgentsConfig;
}

const CONFIG_DIR = path.join(os.homedir(), '.skill-hub');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

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

export function loadConfig(): SkillHubConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as Partial<SkillHubConfig>;
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
      };
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
