import { CodexAdapter } from './codex';
import { Extension } from '../catalog';
import path from 'path';
import os from 'os';
import fs from 'fs';

const tmpHome = path.join(os.tmpdir(), 'codex-adapter-test-' + Date.now());
const tmpProject = path.join(os.tmpdir(), 'codex-proj-' + Date.now());
const tmpCache = path.join(os.tmpdir(), 'codex-cache-' + Date.now());

const mockSkill: Extension = {
  type: 'skill', name: 'test-skill', description: 'Test', tags: [],
  version: '1.0.0', scope: 'both',
  platforms: { 'claude-code': 'SKILL.md' },
  path: 'skills/test-skill', dependencies: [], projects: [],
};

beforeEach(() => {
  fs.mkdirSync(path.join(tmpCache, 'skills', 'test-skill'), { recursive: true });
  fs.writeFileSync(path.join(tmpCache, 'skills', 'test-skill', 'SKILL.md'), '---\nname: test-skill\ndescription: Test\ntags: [testing]\n---\n# Test Skill\nContent here.');
  fs.mkdirSync(path.join(tmpProject, '.codex'), { recursive: true });
  fs.mkdirSync(tmpHome, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpHome, { recursive: true, force: true });
  fs.rmSync(tmpProject, { recursive: true, force: true });
  fs.rmSync(tmpCache, { recursive: true, force: true });
});

test('install project: добавляет секцию в .codex/AGENTS.md', async () => {
  const adapter = new CodexAdapter(tmpProject, tmpHome);
  await adapter.install(mockSkill, 'project', tmpCache);
  const content = fs.readFileSync(path.join(tmpProject, '.codex', 'AGENTS.md'), 'utf-8');
  expect(content).toContain('<!-- skill-hub: test-skill -->');
  expect(content).toContain('# Test Skill');
  expect(content).not.toContain('tags:');
});

test('install global: добавляет секцию в ~/.codex/AGENTS.md', async () => {
  const adapter = new CodexAdapter(tmpProject, tmpHome);
  await adapter.install(mockSkill, 'global', tmpCache);
  const content = fs.readFileSync(path.join(tmpHome, '.codex', 'AGENTS.md'), 'utf-8');
  expect(content).toContain('<!-- skill-hub: test-skill -->');
  expect(content).toContain('# Test Skill');
});

test('remove project: удаляет секцию из .codex/AGENTS.md', async () => {
  const adapter = new CodexAdapter(tmpProject, tmpHome);
  await adapter.install(mockSkill, 'project', tmpCache);
  await adapter.remove(mockSkill, 'project');
  const content = fs.readFileSync(path.join(tmpProject, '.codex', 'AGENTS.md'), 'utf-8');
  expect(content).not.toContain('skill-hub: test-skill');
});

test('isInstalled: true после install, false после remove', async () => {
  const adapter = new CodexAdapter(tmpProject, tmpHome);
  expect(adapter.isInstalled(mockSkill, 'project')).toBe(false);
  await adapter.install(mockSkill, 'project', tmpCache);
  expect(adapter.isInstalled(mockSkill, 'project')).toBe(true);
  await adapter.remove(mockSkill, 'project');
  expect(adapter.isInstalled(mockSkill, 'project')).toBe(false);
});

test('scanInstalled: находит установленные расширения в обоих scope', async () => {
  const adapter = new CodexAdapter(tmpProject, tmpHome);
  await adapter.install(mockSkill, 'project', tmpCache);
  await adapter.install(mockSkill, 'global', tmpCache);
  const results = adapter.scanInstalled();
  expect(results).toHaveLength(2);
  expect(results.find(r => r.scope === 'project')).toBeDefined();
  expect(results.find(r => r.scope === 'global')).toBeDefined();
  expect(results[0].name).toBe('test-skill');
});

test('getInstallPath: project scope использует .codex/AGENTS.md', () => {
  const adapter = new CodexAdapter(tmpProject, tmpHome);
  expect(adapter.getInstallPath(mockSkill, 'project')).toBe(
    path.join(tmpProject, '.codex', 'AGENTS.md')
  );
});

test('getInstallPath: global scope использует ~/.codex/AGENTS.md', () => {
  const adapter = new CodexAdapter(tmpProject, tmpHome);
  expect(adapter.getInstallPath(mockSkill, 'global')).toBe(
    path.join(tmpHome, '.codex', 'AGENTS.md')
  );
});

test('getSourceFile: возвращает claude-code source через platformKey', () => {
  const adapter = new CodexAdapter(tmpProject, tmpHome);
  expect(adapter.getSourceFile(mockSkill)).toBe('SKILL.md');
});

// ─── Multi-file skills ──────────────────────────────────────

describe('Codex Adapter: multi-file skills', () => {
  test('install копирует доп. файлы в .codex/skills/{name}/', async () => {
    const cacheDir = path.join(tmpCache, 'skills', 'test-skill');
    fs.writeFileSync(path.join(cacheDir, 'script.sh'), '#!/bin/bash\necho hello');

    const adapter = new CodexAdapter(tmpProject, tmpHome);
    await adapter.install(mockSkill, 'project', tmpCache);

    // Marker-injection в AGENTS.md
    const content = fs.readFileSync(path.join(tmpProject, '.codex', 'AGENTS.md'), 'utf-8');
    expect(content).toContain('<!-- skill-hub: test-skill -->');
    expect(content).toContain('<!-- additional files: .codex/skills/test-skill/ -->');

    // Дополнительные файлы
    expect(fs.existsSync(path.join(tmpProject, '.codex', 'skills', 'test-skill', 'script.sh'))).toBe(true);
  });

  test('remove удаляет marker-секцию И директорию доп. файлов', async () => {
    const cacheDir = path.join(tmpCache, 'skills', 'test-skill');
    fs.writeFileSync(path.join(cacheDir, 'script.sh'), '#!/bin/bash');

    const adapter = new CodexAdapter(tmpProject, tmpHome);
    await adapter.install(mockSkill, 'project', tmpCache);
    await adapter.remove(mockSkill, 'project');

    const content = fs.readFileSync(path.join(tmpProject, '.codex', 'AGENTS.md'), 'utf-8');
    expect(content).not.toContain('skill-hub: test-skill');
    expect(fs.existsSync(path.join(tmpProject, '.codex', 'skills', 'test-skill'))).toBe(false);
  });
});
