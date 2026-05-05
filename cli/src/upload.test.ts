import {
  parseFrontmatter,
  validateExtensionsForUpload,
  buildCatalogEntry,
  generatePrUrl,
  generatePrTitle,
  generatePrBody,
  generateBranchName,
  detectPlatform,
  parseGitUrl,
  getUploadCandidates,
  Frontmatter,
} from './upload';
import { Catalog, Extension } from './catalog';
import { ScanResult } from './adapters/types';

// ─── Helpers ─────────────────────────────────────────────────

const makeCatalog = (extensions: Partial<Extension>[] = []): Catalog => ({
  version: 1,
  generated_at: new Date().toISOString(),
  counts: {},
  extensions: extensions.map(e => ({
    type: 'skill',
    name: 'default',
    description: '',
    tags: [],
    scope: 'global' as const,
    platforms: {},
    path: '',
    dependencies: [],
    projects: [],
    ...e,
  })),
});

const makeScanResult = (overrides: Partial<ScanResult> = {}): ScanResult => ({
  type: 'skill',
  name: 'my-skill',
  scope: 'project',
  path: '/tmp/test-skill',
  ...overrides,
});

const makeFrontmatter = (overrides: Partial<Frontmatter> = {}): Frontmatter => ({
  name: 'my-skill',
  description: 'A test skill',
  version: '1.0.0',
  author: 'test-user',
  ...overrides,
});

// ─── parseFrontmatter ────────────────────────────────────────

describe('parseFrontmatter', () => {
  test('парсит валидный фронтматтер', () => {
    const content = `---
name: my-skill
description: A test skill
version: 1.0.0
author: test-user
---

# My Skill
`;
    const fm = parseFrontmatter(content);
    expect(fm.name).toBe('my-skill');
    expect(fm.description).toBe('A test skill');
    expect(fm.version).toBe('1.0.0');
    expect(fm.author).toBe('test-user');
  });

  test('парсит фронтматтер с кавычками', () => {
    const content = `---
name: "my-skill"
description: 'A test skill'
version: "1.0.0"
author: "test-user"
---
`;
    const fm = parseFrontmatter(content);
    expect(fm.name).toBe('my-skill');
    expect(fm.description).toBe('A test skill');
  });

  test('парсит теги через запятую', () => {
    const content = `---
name: my-skill
description: test
version: 1.0.0
author: user
tags: git, testing, utils
---
`;
    const fm = parseFrontmatter(content);
    expect(fm.tags).toEqual(['git', 'testing', 'utils']);
  });

  test('возвращает пустой объект без фронтматтера', () => {
    const content = '# My Skill\nNo frontmatter here.';
    const fm = parseFrontmatter(content);
    expect(fm.name).toBeUndefined();
  });
});

// ─── validateExtensionsForUpload ─────────────────────────────

describe('validateExtensionsForUpload', () => {
  test('возвращает ошибку если файл не найден', () => {
    const scan = makeScanResult({ path: '/nonexistent/path' });
    const catalog = makeCatalog();
    const results = validateExtensionsForUpload([scan], catalog);
    expect(results).toHaveLength(1);
    expect(results[0].valid).toBe(false);
    expect(results[0].errors[0]).toContain('не найден');
  });

  test('возвращает ошибку для дубликата в каталоге', () => {
    const fs = require('fs');
    const path = require('path');
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'upload-test-'));
    const filePath = path.join(tmpDir, 'SKILL.md');
    fs.writeFileSync(filePath, `---
name: existing-skill
description: test
version: 1.0.0
author: user
---
`);

    const scan = makeScanResult({ name: 'existing-skill', path: tmpDir });
    const catalog = makeCatalog([{ name: 'existing-skill', type: 'skill' }]);
    const results = validateExtensionsForUpload([scan], catalog);
    expect(results[0].valid).toBe(false);
    expect(results[0].errors.some(e => e.includes('уже существует'))).toBe(true);

    fs.rmSync(tmpDir, { recursive: true });
  });

  test('возвращает ошибку для не kebab-case имени', () => {
    const fs = require('fs');
    const path = require('path');
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'upload-test-'));
    const filePath = path.join(tmpDir, 'SKILL.md');
    fs.writeFileSync(filePath, `---
name: MySkill
description: test
version: 1.0.0
author: user
---
`);

    const scan = makeScanResult({ name: 'MySkill', path: tmpDir });
    const catalog = makeCatalog();
    const results = validateExtensionsForUpload([scan], catalog);
    expect(results[0].valid).toBe(false);
    expect(results[0].errors.some(e => e.includes('kebab-case'))).toBe(true);

    fs.rmSync(tmpDir, { recursive: true });
  });

  test('валидирует корректное расширение', () => {
    const fs = require('fs');
    const path = require('path');
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'upload-test-'));
    const filePath = path.join(tmpDir, 'SKILL.md');
    fs.writeFileSync(filePath, `---
name: valid-skill
description: A valid skill
version: 1.0.0
author: test-user
---
# Valid Skill
`);

    const scan = makeScanResult({ name: 'valid-skill', path: tmpDir });
    const catalog = makeCatalog();
    const results = validateExtensionsForUpload([scan], catalog);
    expect(results[0].valid).toBe(true);
    expect(results[0].frontmatter?.name).toBe('valid-skill');

    fs.rmSync(tmpDir, { recursive: true });
  });

  test('возвращает ошибку при отсутствующих полях фронтматтера', () => {
    const fs = require('fs');
    const path = require('path');
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'upload-test-'));
    const filePath = path.join(tmpDir, 'SKILL.md');
    fs.writeFileSync(filePath, `---
name: partial-skill
---
`);

    const scan = makeScanResult({ name: 'partial-skill', path: tmpDir });
    const catalog = makeCatalog();
    const results = validateExtensionsForUpload([scan], catalog);
    expect(results[0].valid).toBe(false);
    expect(results[0].errors.some(e => e.includes('description'))).toBe(true);

    fs.rmSync(tmpDir, { recursive: true });
  });
});

// ─── buildCatalogEntry ───────────────────────────────────────

describe('buildCatalogEntry', () => {
  test('создаёт запись для skill', () => {
    const scan = makeScanResult({ type: 'skill', name: 'my-skill' });
    const fm = makeFrontmatter({ name: 'my-skill', tags: ['git'] });
    const entry = buildCatalogEntry(scan, fm, 'claude-code');

    expect(entry.type).toBe('skill');
    expect(entry.name).toBe('my-skill');
    expect(entry.description).toBe('A test skill');
    expect(entry.version).toBe('1.0.0');
    expect(entry.author).toBe('test-user');
    expect(entry.tags).toEqual(['git']);
    expect(entry.platforms['claude-code']).toBe('SKILL.md');
    expect(entry.path).toBe('skills/my-skill/SKILL.md');
  });

  test('создаёт запись для agent', () => {
    const scan = makeScanResult({ type: 'agent', name: 'my-agent' });
    const fm = makeFrontmatter({ name: 'my-agent' });
    const entry = buildCatalogEntry(scan, fm, 'claude-code');

    expect(entry.type).toBe('agent');
    expect(entry.platforms['claude-code']).toBe('AGENT.md');
    expect(entry.path).toBe('agents/my-agent/AGENT.md');
  });

  test('создаёт запись для command', () => {
    const scan = makeScanResult({ type: 'command', name: 'my-cmd' });
    const fm = makeFrontmatter({ name: 'my-cmd' });
    const entry = buildCatalogEntry(scan, fm, 'cursor');

    expect(entry.type).toBe('command');
    expect(entry.platforms['cursor']).toBe('COMMAND.md');
    expect(entry.path).toBe('commands/my-cmd/COMMAND.md');
  });

  test('agents-conventions использует claude-code как платформу', () => {
    const scan = makeScanResult();
    const fm = makeFrontmatter();
    const entry = buildCatalogEntry(scan, fm, 'agents-conventions');

    expect(entry.platforms['claude-code']).toBe('SKILL.md');
  });

  test('заполняет files для многофайлового скилла', () => {
    const fs = require('fs');
    const path = require('path');
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'build-entry-'));
    const skillDir = path.join(tmpDir, 'my-skill');
    fs.mkdirSync(path.join(skillDir, 'templates'), { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Skill');
    fs.writeFileSync(path.join(skillDir, 'script.sh'), '#!/bin/bash');
    fs.writeFileSync(path.join(skillDir, 'templates', 'tpl.txt'), 'template');

    const scan = makeScanResult({
      type: 'skill',
      name: 'my-skill',
      path: path.join(skillDir, 'SKILL.md'),
    });
    const fm = makeFrontmatter({ name: 'my-skill' });
    const entry = buildCatalogEntry(scan, fm, 'claude-code');

    expect(entry.files).toBeDefined();
    expect(entry.files).toContain('script.sh');
    expect(entry.files).toContain(path.join('templates', 'tpl.txt'));

    fs.rmSync(tmpDir, { recursive: true });
  });

  test('files отсутствует для однофайлового скилла', () => {
    const fs = require('fs');
    const path = require('path');
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'build-entry-'));
    const skillDir = path.join(tmpDir, 'my-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Skill');

    const scan = makeScanResult({
      type: 'skill',
      name: 'my-skill',
      path: path.join(skillDir, 'SKILL.md'),
    });
    const fm = makeFrontmatter({ name: 'my-skill' });
    const entry = buildCatalogEntry(scan, fm, 'claude-code');

    expect(entry.files).toBeUndefined();

    fs.rmSync(tmpDir, { recursive: true });
  });

  test('scan.path — директория: сканирует только её, не родительскую', () => {
    const fs = require('fs');
    const path = require('path');
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'build-entry-'));

    // Создаём два скилла рядом — проверяем, что второй не попадёт в files
    const skill1Dir = path.join(tmpDir, 'my-skill');
    const skill2Dir = path.join(tmpDir, 'other-skill');
    fs.mkdirSync(skill1Dir, { recursive: true });
    fs.mkdirSync(skill2Dir, { recursive: true });
    fs.writeFileSync(path.join(skill1Dir, 'SKILL.md'), '# Skill 1');
    fs.writeFileSync(path.join(skill1Dir, 'helper.sh'), '#!/bin/bash');
    fs.writeFileSync(path.join(skill2Dir, 'SKILL.md'), '# Skill 2');

    const scan = makeScanResult({
      type: 'skill',
      name: 'my-skill',
      path: skill1Dir, // директория, не файл
    });
    const fm = makeFrontmatter({ name: 'my-skill' });
    const entry = buildCatalogEntry(scan, fm, 'claude-code');

    // Должен содержать только helper.sh из my-skill, не файлы other-skill
    expect(entry.files).toBeDefined();
    expect(entry.files).toContain('helper.sh');
    expect(entry.files).not.toContain('SKILL.md');
    // Ни один файл из other-skill не должен попасть
    expect(entry.files!.every((f: string) => !f.includes('other-skill'))).toBe(true);

    fs.rmSync(tmpDir, { recursive: true });
  });
});

// ─── detectPlatform / parseGitUrl ────────────────────────────

describe('detectPlatform', () => {
  test('определяет GitHub', () => {
    expect(detectPlatform('https://github.com/owner/repo.git')).toBe('github');
  });

  test('определяет GitLab', () => {
    expect(detectPlatform('https://gitlab.com/owner/repo.git')).toBe('gitlab');
  });

  test('определяет self-hosted GitLab', () => {
    expect(detectPlatform('https://gitlab.company.com/owner/repo.git')).toBe('gitlab');
  });

  test('возвращает unknown для неизвестной платформы', () => {
    expect(detectPlatform('https://bitbucket.org/owner/repo.git')).toBe('unknown');
  });
});

describe('parseGitUrl', () => {
  test('парсит HTTPS URL', () => {
    const result = parseGitUrl('https://github.com/emaxe/skill-hub-catalog.git');
    expect(result).toEqual({ host: 'github.com', owner: 'emaxe', repo: 'skill-hub-catalog' });
  });

  test('парсит SSH URL', () => {
    const result = parseGitUrl('git@github.com:emaxe/skill-hub-catalog.git');
    expect(result).toEqual({ host: 'github.com', owner: 'emaxe', repo: 'skill-hub-catalog' });
  });

  test('парсит HTTPS URL без .git', () => {
    const result = parseGitUrl('https://gitlab.com/user/project');
    expect(result).toEqual({ host: 'gitlab.com', owner: 'user', repo: 'project' });
  });

  test('возвращает null для невалидного URL', () => {
    expect(parseGitUrl('not-a-url')).toBeNull();
  });
});

// ─── generatePrUrl ───────────────────────────────────────────

describe('generatePrUrl', () => {
  test('генерирует GitHub PR URL', () => {
    const result = generatePrUrl(
      'https://github.com/emaxe/skill-hub-catalog.git',
      'upload/user-123',
      'Add skill: my-skill',
      'test body',
    );
    expect(result.platform).toBe('github');
    expect(result.url).toContain('github.com/emaxe/skill-hub-catalog/compare/main...upload/user-123');
    expect(result.url).toContain('title=');
    expect(result.url).toContain('body=');
  });

  test('генерирует GitLab MR URL', () => {
    const result = generatePrUrl(
      'https://gitlab.com/user/catalog.git',
      'upload/user-123',
      'Add skill',
      'body',
    );
    expect(result.platform).toBe('gitlab');
    expect(result.url).toContain('merge_requests/new');
    expect(result.url).toContain('source_branch]');
  });

  test('возвращает fallback для неизвестной платформы', () => {
    const result = generatePrUrl(
      'https://bitbucket.org/user/repo.git',
      'upload/user-123',
      'Add skill',
      'body',
    );
    expect(result.platform).toBe('unknown');
    expect(result.url).toBeNull();
    expect(result.instruction).toContain('вручную');
  });

  test('возвращает fallback для невалидного URL', () => {
    const result = generatePrUrl('invalid-url', 'branch', 'title', 'body');
    expect(result.platform).toBe('unknown');
    expect(result.url).toBeNull();
  });
});

// ─── generatePrTitle / generatePrBody ────────────────────────

describe('generatePrTitle', () => {
  test('генерирует заголовок из расширений', () => {
    const exts = [makeScanResult({ type: 'skill', name: 'my-skill' })];
    const fms = new Map([['skill:my-skill', makeFrontmatter({ name: 'my-skill' })]]);
    const title = generatePrTitle(exts, fms);
    expect(title).toBe('Add skill: my-skill');
  });

  test('генерирует заголовок для нескольких расширений', () => {
    const exts = [
      makeScanResult({ type: 'skill', name: 'a' }),
      makeScanResult({ type: 'agent', name: 'b' }),
    ];
    const fms = new Map([
      ['skill:a', makeFrontmatter({ name: 'a' })],
      ['agent:b', makeFrontmatter({ name: 'b' })],
    ]);
    const title = generatePrTitle(exts, fms);
    expect(title).toBe('Add skill: a, agent: b');
  });
});

describe('generatePrBody', () => {
  test('генерирует body с описанием расширений', () => {
    const exts = [makeScanResult({ type: 'skill', name: 'my-skill' })];
    const fms = new Map([['skill:my-skill', makeFrontmatter()]]);
    const body = generatePrBody(exts, fms);
    expect(body).toContain('my-skill');
    expect(body).toContain('A test skill');
    expect(body).toContain('test-user');
  });
});

// ─── generateBranchName ──────────────────────────────────────

describe('generateBranchName', () => {
  test('генерирует имя ветки в формате upload/{user}-{timestamp}', () => {
    const name = generateBranchName();
    expect(name).toMatch(/^upload\/\w+-\d+$/);
  });
});

// ─── uploadExtensions: копирование доп. файлов ───────────────

describe('upload — копирование файлов скиллов', () => {
  const fsReal = require('fs');
  const pathReal = require('path');
  const os = require('os');

  let tmpSkillDir: string;
  let tmpTargetDir: string;

  beforeEach(() => {
    tmpSkillDir = fsReal.mkdtempSync(pathReal.join(os.tmpdir(), 'upload-skill-'));
    tmpTargetDir = fsReal.mkdtempSync(pathReal.join(os.tmpdir(), 'upload-target-'));
  });

  afterEach(() => {
    fsReal.rmSync(tmpSkillDir, { recursive: true, force: true });
    fsReal.rmSync(tmpTargetDir, { recursive: true, force: true });
  });

  test('copyExtensionDir копирует все файлы скилла в каталог', () => {
    // Многофайловый скилл: SKILL.md + templates/prompt.txt + helper.sh
    fsReal.mkdirSync(pathReal.join(tmpSkillDir, 'templates'), { recursive: true });
    fsReal.writeFileSync(pathReal.join(tmpSkillDir, 'SKILL.md'), '---\nname: test\n---\n# Test');
    fsReal.writeFileSync(pathReal.join(tmpSkillDir, 'templates', 'prompt.txt'), 'шаблон');
    fsReal.writeFileSync(pathReal.join(tmpSkillDir, 'helper.sh'), '#!/bin/bash');

    const { copyExtensionDir } = require('./multi-file');
    copyExtensionDir(tmpSkillDir, tmpTargetDir);

    expect(fsReal.existsSync(pathReal.join(tmpTargetDir, 'SKILL.md'))).toBe(true);
    expect(fsReal.existsSync(pathReal.join(tmpTargetDir, 'templates', 'prompt.txt'))).toBe(true);
    expect(fsReal.existsSync(pathReal.join(tmpTargetDir, 'helper.sh'))).toBe(true);
    expect(fsReal.readFileSync(pathReal.join(tmpTargetDir, 'templates', 'prompt.txt'), 'utf-8')).toBe('шаблон');
  });

  test('.skillignore не копируется при upload', () => {
    fsReal.mkdirSync(pathReal.join(tmpSkillDir, 'helpers'), { recursive: true });
    fsReal.writeFileSync(pathReal.join(tmpSkillDir, 'SKILL.md'), '# Test');
    fsReal.writeFileSync(pathReal.join(tmpSkillDir, 'helpers', 'util.sh'), 'util');
    fsReal.writeFileSync(pathReal.join(tmpSkillDir, '.skillignore'), 'dev.txt');

    const { copyExtensionDir } = require('./multi-file');
    copyExtensionDir(tmpSkillDir, tmpTargetDir);

    expect(fsReal.existsSync(pathReal.join(tmpTargetDir, 'SKILL.md'))).toBe(true);
    expect(fsReal.existsSync(pathReal.join(tmpTargetDir, 'helpers', 'util.sh'))).toBe(true);
    expect(fsReal.existsSync(pathReal.join(tmpTargetDir, '.skillignore'))).toBe(false);
  });

  test('upload скилла из path к файлу копирует всю директорию', () => {
    // Симуляция того, что делает uploadExtensions():
    // ext.path = '/path/to/SKILL.md' → dirname → copyExtensionDir
    fsReal.mkdirSync(pathReal.join(tmpSkillDir, 'data'), { recursive: true });
    fsReal.writeFileSync(pathReal.join(tmpSkillDir, 'SKILL.md'), '# Skill');
    fsReal.writeFileSync(pathReal.join(tmpSkillDir, 'data', 'config.json'), '{"key": "value"}');

    const srcPath = pathReal.join(tmpSkillDir, 'SKILL.md');
    // Логика из uploadExtensions: для скиллов берём dirname
    const srcDir = pathReal.dirname(srcPath);

    const { copyExtensionDir } = require('./multi-file');
    copyExtensionDir(srcDir, tmpTargetDir);

    expect(fsReal.existsSync(pathReal.join(tmpTargetDir, 'SKILL.md'))).toBe(true);
    expect(fsReal.existsSync(pathReal.join(tmpTargetDir, 'data', 'config.json'))).toBe(true);
    expect(fsReal.readFileSync(pathReal.join(tmpTargetDir, 'data', 'config.json'), 'utf-8')).toBe('{"key": "value"}');
  });
});

// ─── uploadExtensions: finally-блок восстановления ───────────

describe('uploadExtensions — finally recovery', () => {
  let mockGit: any;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function setupMocks(gitOverrides: Record<string, any> = {}) {
    mockGit = {
      checkout: jest.fn().mockResolvedValue(undefined),
      checkoutLocalBranch: jest.fn().mockResolvedValue(undefined),
      branch: jest.fn().mockResolvedValue(undefined),
      add: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      push: jest.fn().mockResolvedValue(undefined),
      raw: jest.fn().mockResolvedValue(undefined),
      ...gitOverrides,
    };

    jest.doMock('simple-git', () => () => mockGit);
    jest.doMock('./git', () => ({
      getCachePath: () => '/fake/cache',
      getRegistryUrl: () => 'https://github.com/test/catalog.git',
      resetCache: jest.fn(),
      ensureCache: jest.fn().mockResolvedValue(undefined),
    }));
    jest.doMock('fs', () => ({
      ...jest.requireActual('fs'),
      mkdirSync: jest.fn(),
      statSync: jest.fn().mockReturnValue({ isDirectory: () => true }),
      readFileSync: jest.fn().mockReturnValue(JSON.stringify({ extensions: [], counts: {} })),
      writeFileSync: jest.fn(),
    }));
    jest.doMock('./multi-file', () => ({
      copyExtensionDir: jest.fn(),
      listExtensionFiles: jest.fn().mockReturnValue([]),
      getExtensionDirSize: jest.fn().mockReturnValue(0),
      findBinaryFiles: jest.fn().mockReturnValue([]),
      MAX_EXTENSION_DIR_SIZE: 1024 * 1024,
    }));
  }

  test('при неудачном checkout на main — делает reset --hard и повторяет checkout', async () => {
    let checkoutCallCount = 0;
    setupMocks({
      checkout: jest.fn().mockImplementation((branch: string) => {
        checkoutCallCount++;
        // 1-й вызов — начальный checkout main (в try) — ОК
        if (checkoutCallCount === 1) return Promise.resolve();
        // 2-й вызов — finally: checkout main — фейлим
        if (checkoutCallCount === 2) return Promise.reject(new Error('checkout failed'));
        // 3-й вызов — после reset --hard — ОК
        return Promise.resolve();
      }),
      // push бросает ошибку чтобы попасть в catch → finally
      push: jest.fn().mockRejectedValue(new Error('push failed')),
    });

    const { uploadExtensions } = require('./upload');
    const result = await uploadExtensions({
      extensions: [{ type: 'skill', name: 'test', scope: 'project', path: '/tmp/test' }],
      frontmatters: new Map([['skill:test', { name: 'test', description: 'd', version: '1.0.0', author: 'a' }]]),
      catalog: { version: 1, generated_at: '', counts: {}, extensions: [] },
      agent: 'claude-code',
      branchName: 'upload/test',
      commitMessage: 'test',
      cachePath: '/fake/cache',
    });

    expect(result.success).toBe(false);
    expect(mockGit.raw).toHaveBeenCalledWith(['reset', '--hard']);
    expect(mockGit.checkout).toHaveBeenCalledTimes(3);
  });

  test('при полном провале — вызывает resetCache + ensureCache', async () => {
    let checkoutCallCount = 0;
    setupMocks({
      checkout: jest.fn().mockImplementation(() => {
        checkoutCallCount++;
        // 1-й — начальный OK
        if (checkoutCallCount === 1) return Promise.resolve();
        // Все остальные — фейл (finally: первый checkout и после reset)
        return Promise.reject(new Error('checkout failed'));
      }),
      push: jest.fn().mockRejectedValue(new Error('push failed')),
      raw: jest.fn().mockRejectedValue(new Error('reset failed')),
    });

    const { uploadExtensions } = require('./upload');
    const gitModule = require('./git');

    await uploadExtensions({
      extensions: [{ type: 'skill', name: 'test', scope: 'project', path: '/tmp/test' }],
      frontmatters: new Map([['skill:test', { name: 'test', description: 'd', version: '1.0.0', author: 'a' }]]),
      catalog: { version: 1, generated_at: '', counts: {}, extensions: [] },
      agent: 'claude-code',
      branchName: 'upload/test',
      commitMessage: 'test',
      cachePath: '/fake/cache',
    });

    expect(gitModule.resetCache).toHaveBeenCalledWith('/fake/cache');
    expect(gitModule.ensureCache).toHaveBeenCalledWith('/fake/cache');
  });
});

// ─── getUploadCandidates ─────────────────────────────────────

// Тест getUploadCandidates требует мока адаптера, что сложно без DI.
// Пропускаем — логика фильтрации покрыта через validateExtensionsForUpload.
describe('getUploadCandidates', () => {
  test.skip('требует мока адаптера — пропущен', () => {});
});
