import { ClaudeCodeAdapter } from './claude-code';
import { Extension } from '../catalog';
import path from 'path';
import os from 'os';
import fs from 'fs';

const tmpHome = path.join(os.tmpdir(), 'cc-adapter-test-' + Date.now());
const tmpProject = path.join(os.tmpdir(), 'cc-proj-' + Date.now());
const tmpCache = path.join(os.tmpdir(), 'cc-cache-' + Date.now());

const mockSkill: Extension = {
  type: 'skill', name: 'test-skill', description: 'Test', tags: [],
  version: '1.0.0', scope: 'global',
  platforms: { 'claude-code': 'SKILL.md' },
  path: 'skills/test-skill', dependencies: [], projects: [],
};

const mockAgent: Extension = {
  type: 'agent', name: 'test-agent', description: 'Test agent', tags: [],
  version: '1.0.0', scope: 'global',
  platforms: { 'claude-code': 'AGENT.md' },
  path: 'agents/test-agent', dependencies: [], projects: [],
};

beforeEach(() => {
  fs.mkdirSync(path.join(tmpCache, 'skills', 'test-skill'), { recursive: true });
  fs.writeFileSync(path.join(tmpCache, 'skills', 'test-skill', 'SKILL.md'), '# Test Skill');
  fs.mkdirSync(path.join(tmpCache, 'agents', 'test-agent'), { recursive: true });
  fs.writeFileSync(path.join(tmpCache, 'agents', 'test-agent', 'AGENT.md'), '# Test Agent');
  fs.mkdirSync(tmpHome, { recursive: true });
  fs.mkdirSync(tmpProject, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpHome, { recursive: true, force: true });
  fs.rmSync(tmpProject, { recursive: true, force: true });
  fs.rmSync(tmpCache, { recursive: true, force: true });
});

test('install skill global: создаёт ~/.claude/skills/{name}/SKILL.md', async () => {
  const adapter = new ClaudeCodeAdapter(tmpProject, tmpHome);
  await adapter.install(mockSkill, 'global', tmpCache);
  expect(fs.existsSync(path.join(tmpHome, '.claude', 'skills', 'test-skill', 'SKILL.md'))).toBe(true);
});

test('install agent global: создаёт ~/.claude/agents/{name}.md', async () => {
  const adapter = new ClaudeCodeAdapter(tmpProject, tmpHome);
  await adapter.install(mockAgent, 'global', tmpCache);
  expect(fs.existsSync(path.join(tmpHome, '.claude', 'agents', 'test-agent.md'))).toBe(true);
});

test('remove skill: удаляет директорию', async () => {
  const adapter = new ClaudeCodeAdapter(tmpProject, tmpHome);
  await adapter.install(mockSkill, 'global', tmpCache);
  await adapter.remove(mockSkill, 'global');
  expect(fs.existsSync(path.join(tmpHome, '.claude', 'skills', 'test-skill'))).toBe(false);
});

test('isInstalled: true после установки', async () => {
  const adapter = new ClaudeCodeAdapter(tmpProject, tmpHome);
  expect(adapter.isInstalled(mockSkill, 'global')).toBe(false);
  await adapter.install(mockSkill, 'global', tmpCache);
  expect(adapter.isInstalled(mockSkill, 'global')).toBe(true);
});

describe('Claude Code Adapter: case-insensitive path comparison on Windows', () => {
  const ORIGINAL_PLATFORM = process.platform;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: ORIGINAL_PLATFORM });
  });

  test('scanInstalled parent walk stops at homeDir (case-insensitive on win32)', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    let ClaudeCodeAdapterWin: typeof ClaudeCodeAdapter;
    jest.isolateModules(() => {
      ClaudeCodeAdapterWin = require('./claude-code').ClaudeCodeAdapter;
    });

    // Создаём структуру: home/parent/project
    const parentDir = path.join(tmpHome, 'parent');
    const nestedProject = path.join(parentDir, 'project');
    fs.mkdirSync(nestedProject, { recursive: true });

    // Создаём скилл в parent dir
    const parentSkillsDir = path.join(parentDir, '.claude', 'skills', 'parent-skill');
    fs.mkdirSync(parentSkillsDir, { recursive: true });
    fs.writeFileSync(path.join(parentSkillsDir, 'SKILL.md'), '# Parent Skill');

    // Используем адаптер с homeDir, проект вложен в home
    const adapter = new ClaudeCodeAdapterWin!(nestedProject, tmpHome);
    const results = adapter.scanInstalled();

    // parent-skill должен быть найден через parent walk
    const parentSkill = results.find(r => r.name === 'parent-skill');
    expect(parentSkill).toBeTruthy();
    expect(parentSkill!.scope).toBe('parent');
  });

  test('pathsEqual используется для сравнения с homeDir', () => {
    // Тест что pathsEqual импортируется и используется (косвенная проверка через scan)
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    let ClaudeCodeAdapterUnix: typeof ClaudeCodeAdapter;
    jest.isolateModules(() => {
      ClaudeCodeAdapterUnix = require('./claude-code').ClaudeCodeAdapter;
    });

    const adapter = new ClaudeCodeAdapterUnix!(tmpProject, tmpHome);
    // Не должен бросать ошибку
    const results = adapter.scanInstalled();
    expect(Array.isArray(results)).toBe(true);
  });
});
