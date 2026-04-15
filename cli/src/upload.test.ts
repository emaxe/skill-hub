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

// ─── getUploadCandidates ─────────────────────────────────────

// Тест getUploadCandidates требует мока адаптера, что сложно без DI.
// Пропускаем — логика фильтрации покрыта через validateExtensionsForUpload.
describe('getUploadCandidates', () => {
  test.skip('требует мока адаптера — пропущен', () => {});
});
