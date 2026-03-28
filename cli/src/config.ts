import fs from 'fs';
import path from 'path';
import os from 'os';
import { AgentName } from './catalog';

export interface SkillHubConfig {
  agent: AgentName;
  defaultScope: 'global' | 'project';
}

const CONFIG_DIR = path.join(os.homedir(), '.skill-hub');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: SkillHubConfig = {
  agent: 'claude-code',
  defaultScope: 'project',
};

export function loadConfig(): SkillHubConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as Partial<SkillHubConfig>;
      return { ...DEFAULT_CONFIG, ...raw };
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
