import fs from 'fs';
import os from 'os';
import path from 'path';
import { Extension } from '../catalog';
import { ClaudeCodeAdapter } from '../adapters/claude-code';
import { createRegistry } from '../registry';
import { moveExtension } from './move';

let tmpDir: string;
let homeDir: string;
let projectDir: string;
let origHome: string;
let origCwd: string;

const skillExt: Extension = {
  type: 'skill',
  name: 'test-skill',
  description: 'Test skill',
  tags: [],
  version: '1.0.0',
  scope: 'both',
  platforms: { 'claude-code': 'SKILL.md', cursor: null, copilot: null },
  dependencies: [], projects: [],
  path: 'skills/test-skill',
  author: '',
};

const agentExt: Extension = {
  type: 'agent',
  name: 'test-agent',
  description: 'Test agent',
  tags: [],
  version: '1.0.0',
  scope: 'both',
  platforms: { 'claude-code': 'AGENT.md', cursor: null, copilot: null },
  dependencies: [], projects: [],
  path: 'agents/test-agent',
  author: '',
};

function setupCacheFile(ext: Extension): string {
  const cachePath = path.join(tmpDir, 'cache');
  const extDir = path.join(cachePath, `${ext.type}s`, ext.name);
  fs.mkdirSync(extDir, { recursive: true });
  const sourceFile = ext.platforms['claude-code']!;
  fs.writeFileSync(path.join(extDir, sourceFile), '# test content');
  return cachePath;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'move-test-'));
  homeDir = path.join(tmpDir, 'home');
  projectDir = path.join(tmpDir, 'project');
  fs.mkdirSync(homeDir, { recursive: true });
  fs.mkdirSync(projectDir, { recursive: true });
  origHome = process.env.HOME || '';
  origCwd = process.cwd();
  process.env.HOME = homeDir;
  process.chdir(projectDir);
});

afterEach(() => {
  process.env.HOME = origHome;
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('move skill из global в project', async () => {
  const cachePath = setupCacheFile(skillExt);
  const adapter = new ClaudeCodeAdapter(projectDir, homeDir);
  const reg = createRegistry(path.join(homeDir, '.skill-hub'));

  // Сначала установим в global
  await adapter.install(skillExt, 'global', cachePath);
  reg.add({
    type: 'skill', name: 'test-skill', version: '1.0.0',
    agent: 'claude-code', scope: 'global',
    path: adapter.getInstallPath(skillExt, 'global'),
  });

  expect(adapter.isInstalled(skillExt, 'global')).toBe(true);
  expect(adapter.isInstalled(skillExt, 'project')).toBe(false);

  // Перенос
  await moveExtension(skillExt, adapter, 'global', 'project', cachePath, reg);

  expect(adapter.isInstalled(skillExt, 'project')).toBe(true);
  expect(adapter.isInstalled(skillExt, 'global')).toBe(false);

  const record = reg.get('test-skill', 'skill', 'claude-code');
  expect(record?.scope).toBe('project');
});

test('move skill из project в global', async () => {
  const cachePath = setupCacheFile(skillExt);
  const adapter = new ClaudeCodeAdapter(projectDir, homeDir);
  const reg = createRegistry(path.join(homeDir, '.skill-hub'));

  await adapter.install(skillExt, 'project', cachePath);
  reg.add({
    type: 'skill', name: 'test-skill', version: '1.0.0',
    agent: 'claude-code', scope: 'project',
    path: adapter.getInstallPath(skillExt, 'project'),
  });

  await moveExtension(skillExt, adapter, 'project', 'global', cachePath, reg);

  expect(adapter.isInstalled(skillExt, 'global')).toBe(true);
  expect(adapter.isInstalled(skillExt, 'project')).toBe(false);

  const record = reg.get('test-skill', 'skill', 'claude-code');
  expect(record?.scope).toBe('global');
});

test('move agent (файл, не директория)', async () => {
  const cachePath = setupCacheFile(agentExt);
  const adapter = new ClaudeCodeAdapter(projectDir, homeDir);
  const reg = createRegistry(path.join(homeDir, '.skill-hub'));

  await adapter.install(agentExt, 'global', cachePath);
  reg.add({
    type: 'agent', name: 'test-agent', version: '1.0.0',
    agent: 'claude-code', scope: 'global',
    path: adapter.getInstallPath(agentExt, 'global'),
  });

  expect(adapter.isInstalled(agentExt, 'global')).toBe(true);

  await moveExtension(agentExt, adapter, 'global', 'project', cachePath, reg);

  expect(adapter.isInstalled(agentExt, 'project')).toBe(true);
  expect(adapter.isInstalled(agentExt, 'global')).toBe(false);
});

test('move расширения, не установленного в исходном scope — ошибка', async () => {
  const cachePath = setupCacheFile(skillExt);
  const adapter = new ClaudeCodeAdapter(projectDir, homeDir);
  const reg = createRegistry(path.join(homeDir, '.skill-hub'));

  // Не устанавливаем — сразу пытаемся перенести
  await expect(
    moveExtension(skillExt, adapter, 'global', 'project', cachePath, reg)
  ).rejects.toThrow('не установлено в scope "global"');
});

test('move расширения без поддержки агента — ошибка', async () => {
  const extNoSupport: Extension = {
    ...skillExt,
    platforms: { 'claude-code': null, cursor: null, copilot: null },
  };
  const cachePath = setupCacheFile(skillExt);
  const adapter = new ClaudeCodeAdapter(projectDir, homeDir);
  const reg = createRegistry(path.join(homeDir, '.skill-hub'));

  await expect(
    moveExtension(extNoSupport, adapter, 'global', 'project', cachePath, reg)
  ).rejects.toThrow('не поддерживает агента');
});
