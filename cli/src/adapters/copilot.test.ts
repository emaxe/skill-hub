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
  platforms: { copilot: 'SKILL.md' },
  path: 'skills/test-skill', dependencies: [], projects: [],
};

beforeEach(() => {
  fs.mkdirSync(path.join(tmpCache, 'skills', 'test-skill'), { recursive: true });
  fs.writeFileSync(path.join(tmpCache, 'skills', 'test-skill', 'SKILL.md'), '---\nname: test-skill\ndescription: Test\ntags: [testing]\n---\n# Test Skill\nContent here.');
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
  expect(content).not.toContain('tags:');
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

describe('Copilot Adapter Windows path', () => {
  const ORIGINAL_PLATFORM = process.platform;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: ORIGINAL_PLATFORM });
    delete process.env.APPDATA;
  });

  test('getInstallPath global на win32 использует APPDATA', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.env.APPDATA = path.join(tmpHome, 'AppData', 'Roaming');

    let CopilotAdapterWin: typeof CopilotAdapter;
    jest.isolateModules(() => {
      CopilotAdapterWin = require('./copilot').CopilotAdapter;
    });

    const adapter = new CopilotAdapterWin!(tmpProject, tmpHome);
    const installPath = adapter.getInstallPath(mockSkill, 'global');
    expect(installPath).toContain(path.join('AppData', 'Roaming', 'Code', 'User'));
  });

  test('getInstallPath global на win32 без APPDATA использует fallback', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    delete process.env.APPDATA;

    let CopilotAdapterWin: typeof CopilotAdapter;
    jest.isolateModules(() => {
      CopilotAdapterWin = require('./copilot').CopilotAdapter;
    });

    const adapter = new CopilotAdapterWin!(tmpProject, tmpHome);
    const installPath = adapter.getInstallPath(mockSkill, 'global');
    expect(installPath).toBe(
      path.join(tmpHome, 'AppData', 'Roaming', 'Code', 'User', 'copilot-instructions.md')
    );
  });

  test('getInstallPath global на darwin использует Library', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    let CopilotAdapterMac: typeof CopilotAdapter;
    jest.isolateModules(() => {
      CopilotAdapterMac = require('./copilot').CopilotAdapter;
    });

    const adapter = new CopilotAdapterMac!(tmpProject, tmpHome);
    const installPath = adapter.getInstallPath(mockSkill, 'global');
    expect(installPath).toContain(path.join('Library', 'Application Support', 'Code', 'User'));
  });
});

// ─── C2: removeSection с отсутствующим конечным маркером ─────

describe('Copilot Adapter: missing end marker safety', () => {
  test('remove не портит файл при отсутствии конечного маркера', async () => {
    const adapter = new CopilotAdapter(tmpProject, tmpHome);
    const destPath = path.join(tmpProject, '.github', 'copilot-instructions.md');
    // Записываем файл с начальным маркером, но без конечного
    const corruptContent = 'Before\n<!-- skill-hub: test-skill -->\nOrphan content\nAfter';
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, corruptContent);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    await adapter.remove(mockSkill, 'project');
    const result = fs.readFileSync(destPath, 'utf-8');
    expect(result).toBe(corruptContent); // файл не изменён
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('test-skill'));
    warnSpy.mockRestore();
  });

  test('install не портит существующий контент при отсутствии конечного маркера', async () => {
    const adapter = new CopilotAdapter(tmpProject, tmpHome);
    const destPath = path.join(tmpProject, '.github', 'copilot-instructions.md');
    // Файл с повреждённой секцией (без конечного маркера)
    const existingContent = 'Existing rules\n<!-- skill-hub: test-skill -->\nOld content';
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, existingContent);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    await adapter.install(mockSkill, 'project', tmpCache);
    const result = fs.readFileSync(destPath, 'utf-8');
    // Оригинальный контент сохранён, новая секция добавлена
    expect(result).toContain('Existing rules');
    expect(result).toContain('<!-- /skill-hub: test-skill -->');
    warnSpy.mockRestore();
  });
});

// ─── Multi-file skills ──────────────────────────────────────

describe('Copilot Adapter: multi-file skills', () => {
  test('install копирует доп. файлы в .github/skills/{name}/', async () => {
    const cacheDir = path.join(tmpCache, 'skills', 'test-skill');
    fs.writeFileSync(path.join(cacheDir, 'script.sh'), '#!/bin/bash\necho hello');
    fs.mkdirSync(path.join(cacheDir, 'templates'), { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'templates', 'tpl.txt'), 'template');

    const adapter = new CopilotAdapter(tmpProject, tmpHome);
    await adapter.install(mockSkill, 'project', tmpCache);

    // Marker-injection в copilot-instructions.md
    const content = fs.readFileSync(path.join(tmpProject, '.github', 'copilot-instructions.md'), 'utf-8');
    expect(content).toContain('<!-- skill-hub: test-skill -->');
    expect(content).toContain('<!-- additional files: .github/skills/test-skill/ -->');

    // Дополнительные файлы в отдельной директории
    const additionalDir = path.join(tmpProject, '.github', 'skills', 'test-skill');
    expect(fs.existsSync(path.join(additionalDir, 'script.sh'))).toBe(true);
    expect(fs.existsSync(path.join(additionalDir, 'templates', 'tpl.txt'))).toBe(true);
    // Основной файл НЕ скопирован в доп. директорию
    expect(fs.existsSync(path.join(additionalDir, 'SKILL.md'))).toBe(false);
  });

  test('install без доп. файлов — нет комментария additional files', async () => {
    const adapter = new CopilotAdapter(tmpProject, tmpHome);
    await adapter.install(mockSkill, 'project', tmpCache);

    const content = fs.readFileSync(path.join(tmpProject, '.github', 'copilot-instructions.md'), 'utf-8');
    expect(content).toContain('<!-- skill-hub: test-skill -->');
    expect(content).not.toContain('additional files');
  });

  test('remove удаляет marker-секцию И директорию доп. файлов', async () => {
    const cacheDir = path.join(tmpCache, 'skills', 'test-skill');
    fs.writeFileSync(path.join(cacheDir, 'script.sh'), '#!/bin/bash');

    const adapter = new CopilotAdapter(tmpProject, tmpHome);
    await adapter.install(mockSkill, 'project', tmpCache);
    await adapter.remove(mockSkill, 'project');

    const content = fs.readFileSync(path.join(tmpProject, '.github', 'copilot-instructions.md'), 'utf-8');
    expect(content).not.toContain('skill-hub: test-skill');
    expect(fs.existsSync(path.join(tmpProject, '.github', 'skills', 'test-skill'))).toBe(false);
  });
});
