import { CopilotAdapter } from './copilot';
import { Extension } from '../catalog';
import path from 'path';
import os from 'os';
import fs from 'fs';

const tmpHome = path.join(os.tmpdir(), 'copilot-adapter-test-' + Date.now());
const tmpProject = path.join(os.tmpdir(), 'copilot-proj-' + Date.now());
const tmpCache = path.join(os.tmpdir(), 'copilot-cache-' + Date.now());

const mockSkill: Extension = {
  type: 'skill', name: 'test-skill', description: 'Test', tags: [],
  version: '1.0.0', scope: 'both',
  platforms: { copilot: 'COPILOT.md' },
  path: 'skills/test-skill', dependencies: [],
};

beforeEach(() => {
  fs.mkdirSync(path.join(tmpCache, 'skills', 'test-skill'), { recursive: true });
  fs.writeFileSync(path.join(tmpCache, 'skills', 'test-skill', 'COPILOT.md'), '# Test Skill\nContent here.');
  fs.mkdirSync(path.join(tmpProject, '.github'), { recursive: true });
  fs.mkdirSync(tmpHome, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpHome, { recursive: true, force: true });
  fs.rmSync(tmpProject, { recursive: true, force: true });
  fs.rmSync(tmpCache, { recursive: true, force: true });
});

test('install project: добавляет секцию в .github/copilot-instructions.md', async () => {
  const adapter = new CopilotAdapter(tmpProject, tmpHome);
  await adapter.install(mockSkill, 'project', tmpCache);
  const content = fs.readFileSync(path.join(tmpProject, '.github', 'copilot-instructions.md'), 'utf-8');
  expect(content).toContain('<!-- skill-hub: test-skill -->');
  expect(content).toContain('# Test Skill');
});

test('remove project: удаляет секцию из copilot-instructions.md', async () => {
  const adapter = new CopilotAdapter(tmpProject, tmpHome);
  await adapter.install(mockSkill, 'project', tmpCache);
  await adapter.remove(mockSkill, 'project');
  const content = fs.readFileSync(path.join(tmpProject, '.github', 'copilot-instructions.md'), 'utf-8');
  expect(content).not.toContain('skill-hub: test-skill');
});

test('isInstalled: true после install, false после remove', async () => {
  const adapter = new CopilotAdapter(tmpProject, tmpHome);
  expect(adapter.isInstalled(mockSkill, 'project')).toBe(false);
  await adapter.install(mockSkill, 'project', tmpCache);
  expect(adapter.isInstalled(mockSkill, 'project')).toBe(true);
  await adapter.remove(mockSkill, 'project');
  expect(adapter.isInstalled(mockSkill, 'project')).toBe(false);
});
