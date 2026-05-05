import fs from 'fs';
import path from 'path';
import os from 'os';

import {
  getMcpConfigPath,
  getBaseSkillSourcePath,
  getBaseSkillDestPath,
  checkMcp,
  checkBaseSkill,
  checkMcpUpToDate,
  checkBaseSkillUpToDate,
  checkSetupStatus,
  installMcp,
  installBaseSkill,
} from './base-setup';

let tmpDir: string;
let homeDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-hub-base-setup-test-'));
  homeDir = path.join(tmpDir, 'home');
  fs.mkdirSync(homeDir, { recursive: true });
  jest.spyOn(os, 'homedir').mockReturnValue(homeDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  jest.restoreAllMocks();
});

// Вспомогательная функция для записи MCP-конфига
function writeMcpConfig(agent: 'claude-code' | 'cursor' | 'copilot', data: unknown): void {
  const configPath = getMcpConfigPath(agent)!;
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
}

// --- MCP up-to-date ---

describe('checkMcpUpToDate', () => {
  test('возвращает true если MCP не установлен', () => {
    expect(checkMcpUpToDate('claude-code')).toBe(true);
  });

  test('возвращает true если MCP актуален (claude-code)', () => {
    writeMcpConfig('claude-code', {
      mcpServers: { 'skill-hub': { command: 'skill-hub-mcp', args: [] } },
    });
    expect(checkMcpUpToDate('claude-code')).toBe(true);
  });

  test('возвращает false если MCP устарел (claude-code)', () => {
    writeMcpConfig('claude-code', {
      mcpServers: { 'skill-hub': { command: 'skill-hub-mcp', args: ['--old'] } },
    });
    expect(checkMcpUpToDate('claude-code')).toBe(false);
  });

  test('возвращает true если MCP актуален (copilot)', () => {
    writeMcpConfig('copilot', {
      mcpServers: { 'skill-hub': { type: 'local', command: 'skill-hub-mcp', args: [], tools: ['*'] } },
    });
    expect(checkMcpUpToDate('copilot')).toBe(true);
  });

  test('возвращает false если MCP устарел (copilot)', () => {
    writeMcpConfig('copilot', {
      mcpServers: { 'skill-hub': { type: 'local', command: 'skill-hub-mcp', args: [] } },
    });
    expect(checkMcpUpToDate('copilot')).toBe(false);
  });

  test('возвращает true при другом порядке ключей (claude-code)', () => {
    writeMcpConfig('claude-code', {
      mcpServers: { 'skill-hub': { args: [], command: 'skill-hub-mcp' } },
    });
    expect(checkMcpUpToDate('claude-code')).toBe(true);
  });

  test('возвращает true при другом порядке ключей (copilot)', () => {
    writeMcpConfig('copilot', {
      mcpServers: { 'skill-hub': { tools: ['*'], args: [], type: 'local', command: 'skill-hub-mcp' } },
    });
    expect(checkMcpUpToDate('copilot')).toBe(true);
  });

  test('возвращает true когда actual содержит доп. поля — нет (strict equality)', () => {
    writeMcpConfig('claude-code', {
      mcpServers: { 'skill-hub': { command: 'skill-hub-mcp', args: [], env: { DEBUG: '1' } } },
    });
    expect(checkMcpUpToDate('claude-code')).toBe(false);
  });
});

// --- Base skill up-to-date ---

describe('checkBaseSkillUpToDate', () => {
  const agentDir = path.join(__dirname, '..', 'base-skills', 'claude-code');
  const sourceFile = path.join(agentDir, 'SKILL.md');
  let originalContent: string | null = null;

  beforeAll(() => {
    if (fs.existsSync(sourceFile)) {
      originalContent = fs.readFileSync(sourceFile, 'utf-8');
    }
  });

  beforeEach(() => {
    fs.mkdirSync(agentDir, { recursive: true });
  });

  afterEach(() => {
    if (originalContent !== null) {
      fs.writeFileSync(sourceFile, originalContent);
    } else {
      fs.rmSync(agentDir, { recursive: true, force: true });
    }
  });

  test('возвращает true если скилл не установлен', () => {
    fs.writeFileSync(sourceFile, 'source');
    expect(checkBaseSkillUpToDate('claude-code')).toBe(true);
  });

  test('возвращает true если скилл актуален', () => {
    fs.writeFileSync(sourceFile, 'same content');
    const destPath = getBaseSkillDestPath('claude-code')!;
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, 'same content');
    expect(checkBaseSkillUpToDate('claude-code')).toBe(true);
  });

  test('возвращает false если скилл устарел', () => {
    fs.writeFileSync(sourceFile, 'new content');
    const destPath = getBaseSkillDestPath('claude-code')!;
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, 'old content');
    expect(checkBaseSkillUpToDate('claude-code')).toBe(false);
  });
});

// --- checkSetupStatus ---

describe('checkSetupStatus', () => {
  const agentDir = path.join(__dirname, '..', 'base-skills', 'claude-code');
  const sourceFile = path.join(agentDir, 'SKILL.md');
  let originalContent: string | null = null;

  beforeAll(() => {
    if (fs.existsSync(sourceFile)) {
      originalContent = fs.readFileSync(sourceFile, 'utf-8');
    }
  });

  beforeEach(() => {
    fs.mkdirSync(agentDir, { recursive: true });
  });

  afterEach(() => {
    if (originalContent !== null) {
      fs.writeFileSync(sourceFile, originalContent);
    } else {
      fs.rmSync(agentDir, { recursive: true, force: true });
    }
  });

  test('ничего не установлено — outdated=false', async () => {
    const status = await checkSetupStatus('claude-code');
    expect(status.baseSkillInstalled).toBe(false);
    expect(status.mcpInstalled).toBe(false);
    expect(status.baseSkillOutdated).toBe(false);
    expect(status.mcpOutdated).toBe(false);
  });

  test('MCP установлен и актуален — outdated=false', async () => {
    writeMcpConfig('claude-code', {
      mcpServers: { 'skill-hub': { command: 'skill-hub-mcp', args: [] } },
    });
    fs.writeFileSync(sourceFile, 'skill');
    const status = await checkSetupStatus('claude-code');
    expect(status.mcpInstalled).toBe(true);
    expect(status.mcpOutdated).toBe(false);
    expect(status.baseSkillInstalled).toBe(false);
    expect(status.baseSkillOutdated).toBe(false);
  });

  test('MCP установлен и устарел — outdated=true', async () => {
    writeMcpConfig('claude-code', {
      mcpServers: { 'skill-hub': { command: 'old-cmd', args: [] } },
    });
    fs.writeFileSync(sourceFile, 'skill');
    const status = await checkSetupStatus('claude-code');
    expect(status.mcpInstalled).toBe(true);
    expect(status.mcpOutdated).toBe(true);
  });

  test('base-skill установлен и актуален — outdated=false', async () => {
    fs.writeFileSync(sourceFile, 'same');
    const destPath = getBaseSkillDestPath('claude-code')!;
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, 'same');
    const status = await checkSetupStatus('claude-code');
    expect(status.baseSkillInstalled).toBe(true);
    expect(status.baseSkillOutdated).toBe(false);
  });

  test('base-skill установлен и устарел — outdated=true', async () => {
    fs.writeFileSync(sourceFile, 'new');
    const destPath = getBaseSkillDestPath('claude-code')!;
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, 'old');
    const status = await checkSetupStatus('claude-code');
    expect(status.baseSkillInstalled).toBe(true);
    expect(status.baseSkillOutdated).toBe(true);
  });
});
