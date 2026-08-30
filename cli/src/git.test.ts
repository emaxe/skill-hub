import { getCachePath, getCacheDirName, isCloned, resetCache, fullCatalogReset, normalizeGitUrl, injectCredentials, ensureCache, updateCache, cleanLegacyRootCache } from './git';
import simpleGit from 'simple-git';
import os from 'os';
import path from 'path';
import fs from 'fs';

jest.mock('simple-git', () => {
  return jest.fn();
});

jest.mock('./config', () => {
  const original = jest.requireActual('./config');
  return {
    ...original,
    loadProjectExtensions: jest.fn(),
    saveProjectExtensions: jest.fn(),
    findProjectRoot: jest.fn(() => '/mock/project'),
    resolveConfig: jest.fn(() => ({
      config: { registryUrl: 'https://github.com/test/catalog.git' },
      source: 'global' as const,
    })),
  };
});

import { loadProjectExtensions, saveProjectExtensions } from './config';
const mockLoad = loadProjectExtensions as jest.MockedFunction<typeof loadProjectExtensions>;
const mockSave = saveProjectExtensions as jest.MockedFunction<typeof saveProjectExtensions>;

describe('getCacheDirName and getCachePath', () => {
  test('getCachePath: возвращает путь внутри ~/.skill-hub/catalogs/', () => {
    const p = getCachePath();
    expect(p).toContain(path.join('.skill-hub', 'catalogs'));
    expect(p).toContain('catalog-');
  });

  test('getCacheDirName: генерирует разные директории для разных URL', () => {
    const dir1 = getCacheDirName('https://github.com/emaxe/skill-hub-catalog.git');
    const dir2 = getCacheDirName('https://github.com/company/internal-catalog.git');
    expect(dir1).not.toBe(dir2);
    expect(dir1).toContain('skill-hub-catalog-');
    expect(dir2).toContain('internal-catalog-');
  });

  test('getCachePath: изолирует разные репозитории в разные папки', () => {
    const url1 = 'https://github.com/emaxe/skill-hub-catalog.git';
    const url2 = 'https://gitlab.company.com/team/skills.git';
    const path1 = getCachePath(url1);
    const path2 = getCachePath(url2);
    expect(path1).not.toBe(path2);
    expect(path1).toContain('catalogs');
    expect(path2).toContain('catalogs');
  });

  test('getCachePath: URL с учетными данными и без возвращают один и тот же путь', () => {
    const clean = 'https://github.com/emaxe/skill-hub-catalog.git';
    const authed = 'https://user:token@github.com/emaxe/skill-hub-catalog.git';
    expect(getCachePath(clean)).toBe(getCachePath(authed));
  });
});

test('isCloned: false если директория не существует', () => {
  expect(isCloned('/non-existent-path-xyz-12345')).toBe(false);
});

test('isCloned: false если нет catalog.json', () => {
  const os_ = require('os');
  const path_ = require('path');
  const fs_ = require('fs');
  const tmp = path_.join(os_.tmpdir(), 'skill-hub-git-test-' + Date.now());
  fs_.mkdirSync(tmp);
  try {
    expect(isCloned(tmp)).toBe(false);
  } finally {
    fs_.rmdirSync(tmp, { recursive: true });
  }
});

describe('fullCatalogReset', () => {
  let tmpDir: string;

  beforeEach(() => {
    mockLoad.mockReset();
    mockSave.mockReset();
    tmpDir = path.join(os.tmpdir(), 'skill-hub-reset-test-' + Date.now());
    fs.mkdirSync(tmpDir);
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('при наличии расширений — очищает extensions и удаляет кеш каталога', () => {
    mockLoad.mockReturnValue([
      { type: 'skill', name: 'test-skill', version: '1.0.0', scope: 'project' },
    ]);

    // Создаём файлы, имитирующие git-клон
    fs.writeFileSync(path.join(tmpDir, 'catalog.json'), '{}');
    fs.mkdirSync(path.join(tmpDir, '.git'));

    fullCatalogReset(tmpDir);

    expect(mockSave).toHaveBeenCalledWith([]);
    expect(fs.existsSync(tmpDir)).toBe(false);
  });

  test('при отсутствии расширений — не вызывает saveProjectExtensions, но сбрасывает кеш', () => {
    mockLoad.mockReturnValue([]);
    fs.writeFileSync(path.join(tmpDir, 'catalog.json'), '{}');

    fullCatalogReset(tmpDir);

    expect(mockSave).not.toHaveBeenCalled();
    expect(fs.existsSync(tmpDir)).toBe(false);
  });

  test('при ошибке очистки конфига — выводит warning, кеш всё равно сбрасывается', () => {
    mockLoad.mockImplementation(() => { throw new Error('test error'); });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    fs.writeFileSync(path.join(tmpDir, 'catalog.json'), '{}');

    try {
      fullCatalogReset(tmpDir);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('test error'));
      expect(fs.existsSync(tmpDir)).toBe(false);
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('cleanLegacyRootCache', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), 'skill-hub-legacy-test-' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('сохраняет config.json, installed.json, bootstrap/ и catalogs/', () => {
    fs.writeFileSync(path.join(tmpDir, 'config.json'), '{"agent":"claude-code"}');
    fs.writeFileSync(path.join(tmpDir, 'installed.json'), '{"version":3,"installations":[]}');
    const bootstrapDir = path.join(tmpDir, 'bootstrap', 'init-agents');
    fs.mkdirSync(bootstrapDir, { recursive: true });
    fs.writeFileSync(path.join(bootstrapDir, 'SKILL.md'), '# test');
    const catalogsDir = path.join(tmpDir, 'catalogs', 'cat-1');
    fs.mkdirSync(catalogsDir, { recursive: true });

    // Устаревшие файлы клона в корне
    fs.mkdirSync(path.join(tmpDir, '.git'));
    fs.writeFileSync(path.join(tmpDir, 'catalog.json'), '{}');
    fs.mkdirSync(path.join(tmpDir, 'skills'));
    fs.mkdirSync(path.join(tmpDir, 'rules'));

    cleanLegacyRootCache(tmpDir);

    expect(fs.existsSync(path.join(tmpDir, 'config.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'installed.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'bootstrap', 'init-agents', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'catalogs', 'cat-1'))).toBe(true);

    // Удалены устаревшие файлы
    expect(fs.existsSync(path.join(tmpDir, '.git'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'catalog.json'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'skills'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'rules'))).toBe(false);
  });

  test('ничего не делает если .git отсутствует в корне', () => {
    fs.writeFileSync(path.join(tmpDir, 'config.json'), '{}');
    cleanLegacyRootCache(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, 'config.json'))).toBe(true);
  });
});

describe('resetCache', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), 'skill-hub-resetcache-test-' + Date.now());
    fs.mkdirSync(tmpDir);
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('удаляет директорию кеша конкретного каталога', () => {
    fs.mkdirSync(path.join(tmpDir, '.git'));
    fs.writeFileSync(path.join(tmpDir, 'catalog.json'), '{}');

    resetCache(tmpDir);

    expect(fs.existsSync(tmpDir)).toBe(false);
  });

  test('корректно работает если директория не существует', () => {
    const nonExistent = path.join(os.tmpdir(), 'skill-hub-nonexist-' + Date.now());
    expect(() => resetCache(nonExistent)).not.toThrow();
  });
});

describe('normalizeGitUrl', () => {
  test('удаляет username и password из HTTPS URL', () => {
    const url = 'https://user:token123@github.com/emaxe/skill-hub-catalog.git';
    expect(normalizeGitUrl(url)).toBe('https://github.com/emaxe/skill-hub-catalog.git');
  });

  test('удаляет только username из HTTPS URL', () => {
    const url = 'https://user@github.com/emaxe/skill-hub-catalog.git';
    expect(normalizeGitUrl(url)).toBe('https://github.com/emaxe/skill-hub-catalog.git');
  });

  test('не меняет URL без credentials', () => {
    const url = 'https://github.com/emaxe/skill-hub-catalog.git';
    expect(normalizeGitUrl(url)).toBe(url);
  });

  test('SSH URL возвращается без изменений', () => {
    const url = 'git@github.com:emaxe/skill-hub-catalog.git';
    expect(normalizeGitUrl(url)).toBe(url);
  });

  test('невалидный URL возвращается без изменений', () => {
    const url = 'not-a-valid-url';
    expect(normalizeGitUrl(url)).toBe(url);
  });

  test('обрабатывает URL-encoded credentials', () => {
    const url = 'https://user%40email:p%40ss@github.com/org/repo.git';
    expect(normalizeGitUrl(url)).toBe('https://github.com/org/repo.git');
  });

  test('нормализованные URL с credentials и без — совпадают', () => {
    const clean = 'https://github.com/emaxe/skill-hub-catalog.git';
    const authed = 'https://myuser:mytoken@github.com/emaxe/skill-hub-catalog.git';
    expect(normalizeGitUrl(authed)).toBe(normalizeGitUrl(clean));
  });
});

describe('injectCredentials + normalizeGitUrl roundtrip', () => {
  test('injected credentials нормализуются обратно к оригинальному URL', () => {
    const original = 'https://github.com/emaxe/skill-hub-catalog.git';
    const injected = injectCredentials(original, 'user', 'token123');
    expect(injected).not.toBe(original);
    expect(normalizeGitUrl(injected)).toBe(normalizeGitUrl(original));
  });
});

describe('ensureCache', () => {
  let cachePath: string;
  const mockClone = jest.fn();
  const mockRemote = jest.fn();
  const mockPull = jest.fn();

  beforeEach(() => {
    mockClone.mockClear();
    mockRemote.mockClear();
    mockPull.mockClear();
    (simpleGit as unknown as jest.Mock).mockReturnValue({
      clone: mockClone,
      remote: mockRemote,
      pull: mockPull,
    });
    cachePath = path.join(os.tmpdir(), 'skill-hub-ensurecache-test-' + Date.now());
  });

  afterEach(() => {
    if (fs.existsSync(cachePath)) {
      fs.rmSync(cachePath, { recursive: true, force: true });
    }
  });

  test('клонирует напрямую в целевую директорию каталога', async () => {
    mockClone.mockImplementation(async (_url: string, target: string, _opts: any[]) => {
      fs.mkdirSync(path.join(target, '.git'), { recursive: true });
      fs.writeFileSync(path.join(target, 'catalog.json'), '{}');
    });

    await ensureCache(cachePath);

    expect(mockClone).toHaveBeenCalledWith(
      'https://github.com/test/catalog.git',
      cachePath,
      ['--depth', '1']
    );
    expect(fs.existsSync(path.join(cachePath, '.git'))).toBe(true);
    expect(fs.existsSync(path.join(cachePath, 'catalog.json'))).toBe(true);
  });

  test('не клонирует если .git уже существует и origin совпадает', async () => {
    fs.mkdirSync(path.join(cachePath, '.git'), { recursive: true });
    fs.writeFileSync(path.join(cachePath, 'catalog.json'), '{}');
    mockRemote.mockResolvedValue('https://github.com/test/catalog.git\n');

    await ensureCache(cachePath);

    expect(mockClone).not.toHaveBeenCalled();
    expect(mockPull).not.toHaveBeenCalled();
  });

  test('кидает GitAuthError при ошибке аутентификации', async () => {
    mockClone.mockRejectedValue(new Error('could not read Username'));

    await expect(ensureCache(cachePath)).rejects.toThrow('Требуется аутентификация');
  });

  test('кидает обычную ошибку при других проблемах клонирования', async () => {
    mockClone.mockRejectedValue(new Error('network timeout'));

    await expect(ensureCache(cachePath)).rejects.toThrow(/Failed to clone/);
  });
});

describe('updateCache and multi-repo isolation', () => {
  let tmpBase: string;
  const mockClone = jest.fn();
  const mockRemote = jest.fn();
  const mockPull = jest.fn();

  beforeEach(() => {
    mockClone.mockClear();
    mockRemote.mockClear();
    mockPull.mockClear();
    (simpleGit as unknown as jest.Mock).mockReturnValue({
      clone: mockClone,
      remote: mockRemote,
      pull: mockPull,
    });
    tmpBase = path.join(os.tmpdir(), 'skill-hub-multirepo-test-' + Date.now());
    fs.mkdirSync(tmpBase, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tmpBase)) {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  test('updateCache выполняет git pull если клон существует и origin совпадает', async () => {
    const cachePath = path.join(tmpBase, 'repo-a');
    fs.mkdirSync(path.join(cachePath, '.git'), { recursive: true });
    fs.writeFileSync(path.join(cachePath, 'catalog.json'), '{}');
    mockRemote.mockResolvedValue('https://github.com/test/catalog.git\n');

    await updateCache(cachePath);

    expect(mockPull).toHaveBeenCalledWith('origin', 'main', ['--ff-only']);
  });

  test('несколько репозиториев имеют независимые кеши и не перезаписывают друг друга', async () => {
    const urlA = 'https://github.com/orgA/catalogA.git';
    const urlB = 'https://github.com/orgB/catalogB.git';

    const pathA = getCachePath(urlA);
    const pathB = getCachePath(urlB);

    expect(pathA).not.toBe(pathB);

    // Имитируем наличие обоих клонированных репозиториев
    fs.mkdirSync(path.join(pathA, '.git'), { recursive: true });
    fs.writeFileSync(path.join(pathA, 'catalog.json'), '{"name":"catalogA"}');

    fs.mkdirSync(path.join(pathB, '.git'), { recursive: true });
    fs.writeFileSync(path.join(pathB, 'catalog.json'), '{"name":"catalogB"}');

    // Проверяем, что оба существуют независимо
    expect(isCloned(pathA)).toBe(true);
    expect(isCloned(pathB)).toBe(true);

    const contentA = fs.readFileSync(path.join(pathA, 'catalog.json'), 'utf-8');
    const contentB = fs.readFileSync(path.join(pathB, 'catalog.json'), 'utf-8');

    expect(JSON.parse(contentA).name).toBe('catalogA');
    expect(JSON.parse(contentB).name).toBe('catalogB');

    // Сброс одного кеша не затрагивает другой
    resetCache(pathA);
    expect(fs.existsSync(pathA)).toBe(false);
    expect(fs.existsSync(pathB)).toBe(true);
    expect(isCloned(pathB)).toBe(true);

    // Очистка
    resetCache(pathB);
  });
});