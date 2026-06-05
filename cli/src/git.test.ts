import { getCachePath, isCloned, resetCache, fullCatalogReset, normalizeGitUrl, injectCredentials, ensureCache } from './git';
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

test('getCachePath: возвращает ~/.skill-hub', () => {
  expect(getCachePath()).toBe(path.join(os.homedir(), '.skill-hub'));
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

  test('при наличии расширений — очищает extensions и удаляет содержимое кеша, но сохраняет директорию', () => {
    mockLoad.mockReturnValue([
      { type: 'skill', name: 'test-skill', version: '1.0.0', scope: 'project' },
    ]);

    // Создаём файлы, имитирующие git-клон
    fs.writeFileSync(path.join(tmpDir, 'catalog.json'), '{}');
    fs.mkdirSync(path.join(tmpDir, '.git'));

    fullCatalogReset(tmpDir);

    expect(mockSave).toHaveBeenCalledWith([]);
    // Директория осталась, но содержимое git-клона удалено
    expect(fs.existsSync(tmpDir)).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'catalog.json'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.git'))).toBe(false);
  });

  test('при отсутствии расширений — не вызывает saveProjectExtensions, но сбрасывает кеш', () => {
    mockLoad.mockReturnValue([]);
    fs.writeFileSync(path.join(tmpDir, 'catalog.json'), '{}');

    fullCatalogReset(tmpDir);

    expect(mockSave).not.toHaveBeenCalled();
    expect(fs.existsSync(tmpDir)).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'catalog.json'))).toBe(false);
  });

  test('при ошибке очистки конфига — выводит warning, кеш всё равно сбрасывается', () => {
    mockLoad.mockImplementation(() => { throw new Error('test error'); });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    fs.writeFileSync(path.join(tmpDir, 'catalog.json'), '{}');

    try {
      fullCatalogReset(tmpDir);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('test error'));
      expect(fs.existsSync(tmpDir)).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'catalog.json'))).toBe(false);
    } finally {
      warnSpy.mockRestore();
    }
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

  test('сохраняет installed.json при сбросе кеша', () => {
    fs.writeFileSync(path.join(tmpDir, 'installed.json'), '{"version":3,"installations":[]}');
    fs.writeFileSync(path.join(tmpDir, 'catalog.json'), '{}');
    fs.mkdirSync(path.join(tmpDir, '.git'));

    resetCache(tmpDir);

    expect(fs.existsSync(path.join(tmpDir, 'installed.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'catalog.json'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.git'))).toBe(false);
  });

  test('сохраняет bootstrap/ при сбросе кеша', () => {
    const bootstrapDir = path.join(tmpDir, 'bootstrap', 'init-agents');
    fs.mkdirSync(bootstrapDir, { recursive: true });
    fs.writeFileSync(path.join(bootstrapDir, 'SKILL.md'), '# test');
    fs.mkdirSync(path.join(tmpDir, '.git'));
    fs.mkdirSync(path.join(tmpDir, 'skills'));

    resetCache(tmpDir);

    expect(fs.existsSync(path.join(bootstrapDir, 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.git'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'skills'))).toBe(false);
  });

  test('удаляет .git, catalog.json, skills/ и прочее содержимое git-клона', () => {
    fs.mkdirSync(path.join(tmpDir, '.git'));
    fs.writeFileSync(path.join(tmpDir, 'catalog.json'), '{}');
    fs.mkdirSync(path.join(tmpDir, 'skills'));
    fs.mkdirSync(path.join(tmpDir, 'agents'));
    fs.mkdirSync(path.join(tmpDir, 'schema'));

    resetCache(tmpDir);

    expect(fs.existsSync(path.join(tmpDir, '.git'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'catalog.json'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'skills'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'agents'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'schema'))).toBe(false);
    expect(fs.existsSync(tmpDir)).toBe(true);
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
    fs.mkdirSync(cachePath, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(cachePath)) {
      fs.rmSync(cachePath, { recursive: true, force: true });
    }
  });

  test('клонирует во временный каталог и переносит содержимое, оставляя защищённые файлы', async () => {
    fs.writeFileSync(path.join(cachePath, 'installed.json'), '{"version":3}');

    // Имитируем git clone: создаём файлы во временной директории
    mockClone.mockImplementation(async (_url: string, target: string, _opts: any[]) => {
      fs.mkdirSync(path.join(target, '.git'), { recursive: true });
      fs.writeFileSync(path.join(target, 'catalog.json'), '{}');
    });

    await ensureCache(cachePath);

    // Защищённые файлы остались
    expect(fs.existsSync(path.join(cachePath, 'installed.json'))).toBe(true);
    // Содержимое клона перенесено
    expect(fs.existsSync(path.join(cachePath, '.git'))).toBe(true);
    expect(fs.existsSync(path.join(cachePath, 'catalog.json'))).toBe(true);
    // Временная директория удалена
    expect(mockClone).toHaveBeenCalledTimes(1);
    const tmpDir = mockClone.mock.calls[0][1];
    expect(fs.existsSync(tmpDir)).toBe(false);
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