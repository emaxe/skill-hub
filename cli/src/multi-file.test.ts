import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  copyExtensionDir,
  copyAdditionalFiles,
  hasAdditionalFiles,
  listExtensionFiles,
  getExtensionDirSize,
  findBinaryFiles,
  readSkillIgnore,
  getExtensionDirRel,
} from './multi-file';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'multi-file-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── getExtensionDirRel ─────────────────────────────────────

describe('getExtensionDirRel', () => {
  test('путь к файлу .md → dirname', () => {
    expect(getExtensionDirRel('skills/my-skill/SKILL.md')).toBe('skills/my-skill');
  });

  test('путь к файлу .mdc → dirname', () => {
    expect(getExtensionDirRel('skills/my-skill/SKILL.mdc')).toBe('skills/my-skill');
  });

  test('путь к директории → без изменений', () => {
    expect(getExtensionDirRel('skills/my-skill')).toBe('skills/my-skill');
  });

  test('пустой путь', () => {
    expect(getExtensionDirRel('')).toBe('');
  });
});

// ─── copyExtensionDir ───────────────────────────────────────

describe('copyExtensionDir', () => {
  test('копирует файлы рекурсивно', () => {
    const src = path.join(tmpDir, 'src');
    const dest = path.join(tmpDir, 'dest');

    fs.mkdirSync(path.join(src, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(src, 'SKILL.md'), '# Skill');
    fs.writeFileSync(path.join(src, 'script.sh'), '#!/bin/bash');
    fs.writeFileSync(path.join(src, 'sub', 'data.json'), '{}');

    copyExtensionDir(src, dest);

    expect(fs.existsSync(path.join(dest, 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'script.sh'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'sub', 'data.json'))).toBe(true);
    expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf-8')).toBe('# Skill');
  });

  test('пропускает .skillignore', () => {
    const src = path.join(tmpDir, 'src');
    const dest = path.join(tmpDir, 'dest');

    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(path.join(src, 'SKILL.md'), '# Skill');
    fs.writeFileSync(path.join(src, '.skillignore'), 'temp/');

    copyExtensionDir(src, dest);

    expect(fs.existsSync(path.join(dest, 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(dest, '.skillignore'))).toBe(false);
  });

  test('пропускает файлы из ignore-списка', () => {
    const src = path.join(tmpDir, 'src');
    const dest = path.join(tmpDir, 'dest');

    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(path.join(src, 'SKILL.md'), '# Skill');
    fs.writeFileSync(path.join(src, 'temp.log'), 'log');

    copyExtensionDir(src, dest, ['temp.log']);

    expect(fs.existsSync(path.join(dest, 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'temp.log'))).toBe(false);
  });

  test('пропускает symlinks', () => {
    const src = path.join(tmpDir, 'src');
    const dest = path.join(tmpDir, 'dest');
    const target = path.join(tmpDir, 'target');

    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(path.join(src, 'SKILL.md'), '# Skill');
    fs.writeFileSync(target, 'target content');
    fs.symlinkSync(target, path.join(src, 'link.txt'));

    copyExtensionDir(src, dest);

    expect(fs.existsSync(path.join(dest, 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'link.txt'))).toBe(false);
  });
});

// ─── copyAdditionalFiles ────────────────────────────────────

describe('copyAdditionalFiles', () => {
  test('копирует всё кроме основного файла', () => {
    const src = path.join(tmpDir, 'src');
    const dest = path.join(tmpDir, 'dest');

    fs.mkdirSync(path.join(src, 'templates'), { recursive: true });
    fs.writeFileSync(path.join(src, 'SKILL.md'), '# Skill');
    fs.writeFileSync(path.join(src, 'script.sh'), '#!/bin/bash');
    fs.writeFileSync(path.join(src, 'templates', 'tpl.txt'), 'template');

    copyAdditionalFiles(src, dest, 'SKILL.md');

    expect(fs.existsSync(path.join(dest, 'SKILL.md'))).toBe(false);
    expect(fs.existsSync(path.join(dest, 'script.sh'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'templates', 'tpl.txt'))).toBe(true);
  });

  test('не падает если директория не существует', () => {
    expect(() => copyAdditionalFiles('/nonexistent', '/dest', 'SKILL.md')).not.toThrow();
  });

  test('не копирует ничего если только основной файл', () => {
    const src = path.join(tmpDir, 'src');
    const dest = path.join(tmpDir, 'dest');

    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(path.join(src, 'SKILL.md'), '# Skill');

    copyAdditionalFiles(src, dest, 'SKILL.md');

    expect(fs.existsSync(dest)).toBe(false);
  });
});

// ─── hasAdditionalFiles ─────────────────────────────────────

describe('hasAdditionalFiles', () => {
  test('true если есть дополнительные файлы (file path)', () => {
    const cache = path.join(tmpDir, 'cache');
    fs.mkdirSync(path.join(cache, 'skills', 'my-skill'), { recursive: true });
    fs.writeFileSync(path.join(cache, 'skills', 'my-skill', 'SKILL.md'), '# Skill');
    fs.writeFileSync(path.join(cache, 'skills', 'my-skill', 'script.sh'), '#!/bin/bash');

    expect(hasAdditionalFiles('skills/my-skill/SKILL.md', cache)).toBe(true);
  });

  test('true если есть дополнительные файлы (dir path)', () => {
    const cache = path.join(tmpDir, 'cache');
    fs.mkdirSync(path.join(cache, 'skills', 'my-skill'), { recursive: true });
    fs.writeFileSync(path.join(cache, 'skills', 'my-skill', 'SKILL.md'), '# Skill');
    fs.writeFileSync(path.join(cache, 'skills', 'my-skill', 'script.sh'), '#!/bin/bash');

    expect(hasAdditionalFiles('skills/my-skill', cache)).toBe(true);
  });

  test('false если только основной файл', () => {
    const cache = path.join(tmpDir, 'cache');
    fs.mkdirSync(path.join(cache, 'skills', 'my-skill'), { recursive: true });
    fs.writeFileSync(path.join(cache, 'skills', 'my-skill', 'SKILL.md'), '# Skill');

    expect(hasAdditionalFiles('skills/my-skill/SKILL.md', cache)).toBe(false);
  });

  test('false если директория не существует', () => {
    expect(hasAdditionalFiles('skills/nonexistent/SKILL.md', tmpDir)).toBe(false);
  });

  test('.skillignore не считается дополнительным файлом', () => {
    const cache = path.join(tmpDir, 'cache');
    fs.mkdirSync(path.join(cache, 'skills', 'my-skill'), { recursive: true });
    fs.writeFileSync(path.join(cache, 'skills', 'my-skill', 'SKILL.md'), '# Skill');
    fs.writeFileSync(path.join(cache, 'skills', 'my-skill', '.skillignore'), 'temp/');

    expect(hasAdditionalFiles('skills/my-skill/SKILL.md', cache)).toBe(false);
  });
});

// ─── listExtensionFiles ─────────────────────────────────────

describe('listExtensionFiles', () => {
  test('возвращает дополнительные файлы (file path)', () => {
    const cache = path.join(tmpDir, 'cache');
    fs.mkdirSync(path.join(cache, 'skills', 'my-skill', 'templates'), { recursive: true });
    fs.writeFileSync(path.join(cache, 'skills', 'my-skill', 'SKILL.md'), '# Skill');
    fs.writeFileSync(path.join(cache, 'skills', 'my-skill', 'script.sh'), '#!/bin/bash');
    fs.writeFileSync(path.join(cache, 'skills', 'my-skill', 'templates', 'tpl.txt'), 'template');

    const files = listExtensionFiles('skills/my-skill/SKILL.md', cache);
    expect(files).toContain('script.sh');
    expect(files).toContain(path.join('templates', 'tpl.txt'));
    expect(files).not.toContain('SKILL.md');
  });

  test('возвращает дополнительные файлы (dir path)', () => {
    const cache = path.join(tmpDir, 'cache');
    fs.mkdirSync(path.join(cache, 'skills', 'my-skill'), { recursive: true });
    fs.writeFileSync(path.join(cache, 'skills', 'my-skill', 'SKILL.md'), '# Skill');
    fs.writeFileSync(path.join(cache, 'skills', 'my-skill', 'script.sh'), '#!/bin/bash');

    const files = listExtensionFiles('skills/my-skill', cache, 'SKILL.md');
    expect(files).toContain('script.sh');
    expect(files).not.toContain('SKILL.md');
  });

  test('пустой массив если нет дополнительных файлов', () => {
    const cache = path.join(tmpDir, 'cache');
    fs.mkdirSync(path.join(cache, 'skills', 'my-skill'), { recursive: true });
    fs.writeFileSync(path.join(cache, 'skills', 'my-skill', 'SKILL.md'), '# Skill');

    const files = listExtensionFiles('skills/my-skill/SKILL.md', cache);
    expect(files).toEqual([]);
  });

  test('пустой массив если директория не существует', () => {
    expect(listExtensionFiles('skills/nope/SKILL.md', tmpDir)).toEqual([]);
  });
});

// ─── getExtensionDirSize ────────────────────────────────────

describe('getExtensionDirSize', () => {
  test('подсчитывает суммарный размер', () => {
    const dir = path.join(tmpDir, 'ext');
    fs.mkdirSync(path.join(dir, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'a.txt'), 'hello');       // 5 bytes
    fs.writeFileSync(path.join(dir, 'sub', 'b.txt'), 'world'); // 5 bytes

    const size = getExtensionDirSize(dir);
    expect(size).toBe(10);
  });

  test('0 если директория не существует', () => {
    expect(getExtensionDirSize('/nonexistent')).toBe(0);
  });
});

// ─── findBinaryFiles ────────────────────────────────────────

describe('findBinaryFiles', () => {
  test('находит бинарные файлы', () => {
    const dir = path.join(tmpDir, 'ext');
    fs.mkdirSync(path.join(dir, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), '# Skill');
    fs.writeFileSync(path.join(dir, 'app.exe'), 'binary');
    fs.writeFileSync(path.join(dir, 'sub', 'lib.dll'), 'binary');

    const binaries = findBinaryFiles(dir);
    expect(binaries).toContain('app.exe');
    expect(binaries).toContain(path.join('sub', 'lib.dll'));
    expect(binaries).not.toContain('SKILL.md');
  });

  test('пустой массив если нет бинарников', () => {
    const dir = path.join(tmpDir, 'ext');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), '# Skill');
    fs.writeFileSync(path.join(dir, 'script.sh'), '#!/bin/bash');

    expect(findBinaryFiles(dir)).toEqual([]);
  });

  test('пустой массив если директория не существует', () => {
    expect(findBinaryFiles('/nonexistent')).toEqual([]);
  });
});

// ─── readSkillIgnore ────────────────────────────────────────

describe('readSkillIgnore', () => {
  test('читает паттерны из .skillignore', () => {
    const dir = path.join(tmpDir, 'ext');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.skillignore'), 'temp/\n# comment\n\nbuild/\n');

    const patterns = readSkillIgnore(dir);
    expect(patterns).toEqual(['temp/', 'build/']);
  });

  test('пустой массив если файл отсутствует', () => {
    expect(readSkillIgnore(tmpDir)).toEqual([]);
  });
});
