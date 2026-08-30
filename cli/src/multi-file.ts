/**
 * Утилиты для работы с многофайловыми расширениями.
 * Копирование директорий, проверка наличия дополнительных файлов.
 */

import fs from 'fs';
import path from 'path';

/** Максимальный размер директории расширения (1 МБ) */
export const MAX_EXTENSION_DIR_SIZE = 1024 * 1024;

/** Файлы и директории, которые всегда исключаются при копировании/сканировании расширений */
export const DEFAULT_IGNORE = new Set([
  '.git', 'node_modules', '.DS_Store', 'Thumbs.db',
  'catalog.json', 'installed.json',
]);

/**
 * Вычисляет путь к директории расширения в кеше каталога.
 * Обратная совместимость: ext.path может быть путём к файлу (skills/name/SKILL.md)
 * или к директории (skills/name). Определяем по наличию расширения .md/.mdc.
 */
export function getExtensionDirRel(extPath: string): string {
  const ext = path.extname(extPath).toLowerCase();
  if (ext === '.md' || ext === '.mdc') {
    return path.dirname(extPath);
  }
  return extPath;
}

/** Расширения бинарных файлов (запрещены для загрузки, кроме изображений) */
const BINARY_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.class', '.pyc', '.pyo', '.o', '.obj', '.a', '.lib',
  '.wasm', '.node',
]);

/**
 * Рекурсивно копирует содержимое директории расширения.
 * Пропускает: .skillignore, symlinks, DEFAULT_IGNORE.
 */
export function copyExtensionDir(src: string, dest: string, ignore?: string[]): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === '.skillignore') continue;
    if (DEFAULT_IGNORE.has(entry.name)) continue;
    if (ignore?.includes(entry.name)) continue;
    if (entry.isSymbolicLink()) continue;

    const srcEntry = path.join(src, entry.name);
    const destEntry = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyExtensionDir(srcEntry, destEntry, ignore);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcEntry, destEntry);
    }
  }
}

/**
 * Копирует все файлы из директории расширения, кроме основного .md и .skillignore.
 * Используется адаптерами, которые трансформируют основной файл (Cursor)
 * или используют marker-injection (Copilot, Codex).
 */
export function copyAdditionalFiles(srcDir: string, destDir: string, mainFile: string): void {
  if (!fs.existsSync(srcDir)) return;

  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.name === mainFile) continue;
    if (entry.name === '.skillignore') continue;
    if (entry.isSymbolicLink()) continue;

    const srcEntry = path.join(srcDir, entry.name);
    const destEntry = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyExtensionDir(srcEntry, destEntry);
    } else if (entry.isFile()) {
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(srcEntry, destEntry);
    }
  }
}

/**
 * Проверяет наличие дополнительных файлов у расширения в каталоге.
 * @param extPath - значение ext.path (путь к основному файлу или директории)
 * @param cachePath - корень кеша каталога
 */
export function hasAdditionalFiles(extPath: string, cachePath: string): boolean {
  const dir = path.join(cachePath, getExtensionDirRel(extPath));
  if (!fs.existsSync(dir)) return false;
  const entries = fs.readdirSync(dir).filter(e => e !== '.skillignore');
  return entries.length > 1;
}

/**
 * Возвращает список дополнительных файлов расширения (относительные пути).
 * Основной файл не включается в список.
 * @param extPath - значение ext.path (путь к основному файлу или директории)
 * @param cachePath - корень кеша каталога
 * @param mainFile - имя основного файла (SKILL.md, AGENT.md, COMMAND.md)
 */
export function listExtensionFiles(extPath: string, cachePath: string, mainFile?: string): string[] {
  const main = mainFile || path.basename(extPath);
  const dir = path.join(cachePath, getExtensionDirRel(extPath));
  if (!fs.existsSync(dir)) return [];

  const files: string[] = [];
  collectFiles(dir, dir, main, files);
  return files;
}

/** Рекурсивно собирает относительные пути файлов */
function collectFiles(base: string, current: string, mainFile: string, result: string[]): void {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.name === '.skillignore') continue;
    if (DEFAULT_IGNORE.has(entry.name)) continue;
    if (entry.isSymbolicLink()) continue;

    const full = path.join(current, entry.name);
    const rel = path.relative(base, full);

    if (entry.isDirectory()) {
      collectFiles(base, full, mainFile, result);
    } else if (entry.isFile()) {
      // Пропускаем основной файл только в корне директории
      if (current === base && entry.name === mainFile) continue;
      result.push(rel);
    }
  }
}

/**
 * Вычисляет суммарный размер директории расширения в байтах.
 */
export function getExtensionDirSize(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  let total = 0;

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (DEFAULT_IGNORE.has(entry.name)) continue;
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += getExtensionDirSize(full);
    } else if (entry.isFile()) {
      total += fs.statSync(full).size;
    }
  }

  return total;
}

/**
 * Проверяет наличие бинарных файлов в директории расширения.
 * Возвращает список путей к бинарным файлам.
 */
export function findBinaryFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];
  const binaries: string[] = [];

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      if (DEFAULT_IGNORE.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (BINARY_EXTENSIONS.has(ext)) {
          binaries.push(path.relative(dirPath, full));
        }
      }
    }
  }

  walk(dirPath);
  return binaries;
}

/**
 * Читает .skillignore и возвращает список паттернов для исключения.
 */
export function readSkillIgnore(dirPath: string): string[] {
  const ignorePath = path.join(dirPath, '.skillignore');
  if (!fs.existsSync(ignorePath)) return [];
  return fs.readFileSync(ignorePath, 'utf-8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
}
