import fs from 'fs';
import path from 'path';
import os from 'os';
import { AgentName } from './catalog';

export interface SetupStatus {
  mcpInstalled: boolean | null;       // null = не поддерживается агентом
  baseSkillInstalled: boolean | null; // null = нет файла для агента
}

export function getMcpConfigPath(agent: AgentName): string | null {
  if (agent === 'claude-code') {
    return path.join(os.homedir(), '.claude', 'claude_desktop_config.json');
  }
  if (agent === 'cursor') {
    return path.join(os.homedir(), '.cursor', 'mcp.json');
  }
  if (agent === 'copilot') {
    return path.join(os.homedir(), '.copilot', 'mcp-config.json');
  }
  return null;
}

export function getBaseSkillSourcePath(agent: AgentName): string {
  return path.join(__dirname, '..', 'base-skills', agent, 'SKILL.md');
}

export function getBaseSkillDestPath(agent: AgentName): string | null {
  if (agent === 'claude-code') {
    return path.join(os.homedir(), '.claude', 'skills', 'skill-hub', 'SKILL.md');
  }
  if (agent === 'cursor') {
    return path.join(os.homedir(), '.cursor', 'skills', 'skill-hub', 'SKILL.md');
  }
  if (agent === 'copilot') {
    return path.join(os.homedir(), '.copilot', 'skills', 'skill-hub', 'SKILL.md');
  }
  return null;
}

export function checkMcp(agent: AgentName): boolean | null {
  const configPath = getMcpConfigPath(agent);
  if (configPath === null) return null;
  if (!fs.existsSync(configPath)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    const servers = (raw.mcpServers || {}) as Record<string, unknown>;
    return 'skill-hub' in servers;
  } catch {
    return false;
  }
}

export function checkBaseSkill(agent: AgentName): boolean | null {
  const sourcePath = getBaseSkillSourcePath(agent);
  if (!fs.existsSync(sourcePath)) return null;
  const destPath = getBaseSkillDestPath(agent);
  if (destPath === null) return null;
  return fs.existsSync(destPath);
}

export async function checkSetupStatus(agent: AgentName): Promise<SetupStatus> {
  return {
    mcpInstalled: checkMcp(agent),
    baseSkillInstalled: checkBaseSkill(agent),
  };
}

export async function installMcp(agent: AgentName): Promise<void> {
  const configPath = getMcpConfigPath(agent);
  if (configPath === null) {
    throw new Error(`MCP не поддерживается для агента: ${agent}`);
  }
  let config: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    } catch {
      config = {};
    }
  }
  const mcpServers = (config.mcpServers || {}) as Record<string, unknown>;
  const serverEntry = agent === 'copilot'
    ? { type: 'local', command: 'skill-hub-mcp', args: [], tools: ['*'] }
    : { command: 'skill-hub-mcp', args: [] };
  mcpServers['skill-hub'] = serverEntry;
  config.mcpServers = mcpServers;
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export async function installBaseSkill(agent: AgentName): Promise<void> {
  const sourcePath = getBaseSkillSourcePath(agent);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Нет базового скила для агента: ${agent}`);
  }
  const destPath = getBaseSkillDestPath(agent);
  if (destPath === null) {
    throw new Error(`Установка базового скила не поддерживается для агента: ${agent}`);
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(sourcePath, destPath);
}

export interface SelfUpdateResult {
  skill: boolean;
  mcp: boolean;
}

/**
 * Обновляет base-skill и MCP-конфигурацию до актуальных версий.
 * Обновляет только те компоненты, которые уже установлены.
 */
export async function updateSelf(agent: AgentName): Promise<SelfUpdateResult> {
  const skillInstalled = checkBaseSkill(agent) === true;
  if (skillInstalled) await installBaseSkill(agent);

  const mcpInstalled = checkMcp(agent) === true;
  if (mcpInstalled) await installMcp(agent);

  return { skill: skillInstalled, mcp: mcpInstalled };
}
