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
  platforms: { cursor: 'CURSOR.md' },
  path: 'skills/test-skill', dependencies: [],
};

beforeEach(() => {
  fs.mkdirSync(path.join(tmpCache, 'skills', 'test-skill'), { recursive: true });
  fs.writeFileSync(path.join(tmpCache, 'skills', 'test-skill', 'CURSOR.md'), '---\ndescription: Test\n---\n# Test');
  fs.mkdirSync(tmpHome, { recursive: true });
  fs.mkdirSync(tmpProject, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpHome, { recursive: true, force: true });
  fs.rmSync(tmpProject, { recursive: true, force: true });
  fs.rmSync(tmpCache, { recursive: true, force: true });
});

test('install project: создаёт .cursor/rules/{name}.mdc', async () => {
  const adapter = new CursorAdapter(tmpProject, tmpHome);
  await adapter.install(mockSkill, 'project', tmpCache);
  expect(fs.existsSync(path.join(tmpProject, '.cursor', 'rules', 'test-skill.mdc'))).toBe(true);
});

test('install global: создаёт ~/.cursor/rules/{name}.mdc', async () => {
  const adapter = new CursorAdapter(tmpProject, tmpHome);
  await adapter.install(mockSkill, 'global', tmpCache);
  expect(fs.existsSync(path.join(tmpHome, '.cursor', 'rules', 'test-skill.mdc'))).toBe(true);
});

test('remove: удаляет mdc файл', async () => {
  const adapter = new CursorAdapter(tmpProject, tmpHome);
  await adapter.install(mockSkill, 'project', tmpCache);
  await adapter.remove(mockSkill, 'project');
  expect(fs.existsSync(path.join(tmpProject, '.cursor', 'rules', 'test-skill.mdc'))).toBe(false);
});
