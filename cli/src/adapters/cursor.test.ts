import { CursorAdapter } from './cursor';
import { Extension } from '../catalog';
import path from 'path';
import os from 'os';
import fs from 'fs';

const tmpHome = path.join(os.tmpdir(), 'cursor-adapter-test-' + Date.now());
const tmpProject = path.join(os.tmpdir(), 'cursor-proj-' + Date.now());
const tmpCache = path.join(os.tmpdir(), 'cursor-cache-' + Date.now());

const mockSkill: Extension = {
  type: 'skill', name: 'test-skill', description: 'Test', tags: [],
  version: '1.0.0', scope: 'global',
  platforms: { cursor: 'SKILL.md' },
  path: 'skills/test-skill', dependencies: [], projects: [],
};

beforeEach(() => {
  fs.mkdirSync(path.join(tmpCache, 'skills', 'test-skill'), { recursive: true });
  fs.writeFileSync(path.join(tmpCache, 'skills', 'test-skill', 'SKILL.md'), '---\nname: test-skill\ndescription: Test\ntags: [testing]\n---\n# Test');
  fs.mkdirSync(tmpHome, { recursive: true });
  fs.mkdirSync(tmpProject, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpHome, { recursive: true, force: true });
  fs.rmSync(tmpProject, { recursive: true, force: true });
  fs.rmSync(tmpCache, { recursive: true, force: true });
});

test('install project skill: создаёт .cursor/skills/{name}/SKILL.md', async () => {
  const adapter = new CursorAdapter(tmpProject, tmpHome);
  await adapter.install(mockSkill, 'project', tmpCache);
  const dest = path.join(tmpProject, '.cursor', 'skills', 'test-skill', 'SKILL.md');
  expect(fs.existsSync(dest)).toBe(true);
  const content = fs.readFileSync(dest, 'utf-8');
  expect(content).toContain('description: Test');
  expect(content).toContain('alwaysApply: false');
  expect(content).not.toContain('tags:');
});

test('install global skill: создаёт ~/.cursor/skills/{name}/SKILL.md', async () => {
  const adapter = new CursorAdapter(tmpProject, tmpHome);
  await adapter.install(mockSkill, 'global', tmpCache);
  expect(fs.existsSync(path.join(tmpHome, '.cursor', 'skills', 'test-skill', 'SKILL.md'))).toBe(true);
});

test('remove skill: удаляет каталог skills/{name}', async () => {
  const adapter = new CursorAdapter(tmpProject, tmpHome);
  await adapter.install(mockSkill, 'project', tmpCache);
  await adapter.remove(mockSkill, 'project');
  expect(fs.existsSync(path.join(tmpProject, '.cursor', 'skills', 'test-skill'))).toBe(false);
});

const mockAgent: Extension = {
  type: 'agent', name: 'test-agent', description: 'Test', tags: [],
  version: '1.0.0', scope: 'global',
  platforms: { cursor: 'AGENT.md' },
  path: 'agents/test-agent', dependencies: [], projects: [],
};

test('install agent: создаёт .cursor/agents/{name}.mdc', async () => {
  fs.mkdirSync(path.join(tmpCache, 'agents', 'test-agent'), { recursive: true });
  fs.writeFileSync(path.join(tmpCache, 'agents', 'test-agent', 'AGENT.md'), '---\nname: test-agent\ndescription: A\n---\n# A');
  const adapter = new CursorAdapter(tmpProject, tmpHome);
  await adapter.install(mockAgent, 'project', tmpCache);
  expect(fs.existsSync(path.join(tmpProject, '.cursor', 'agents', 'test-agent.mdc'))).toBe(true);
});
