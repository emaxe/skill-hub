import os from 'os';
import path from 'path';
import fs from 'fs';
import simpleGit from 'simple-git';
import { resolveConfig, loadProjectExtensions, saveProjectExtensions, findProjectRoot } from './config';

export function getRegistryUrl(): string {
  return resolveConfig().config.registryUrl;
}

export function getCachePath(): string {
  return path.join(os.homedir(), '.skill-hub');
}

export function isCloned(cachePath = getCachePath()): boolean {
  return fs.existsSync(path.join(cachePath, '.git'));
}

/** Полностью удаляет кеш каталога — используется при смене registryUrl */
export function resetCache(cachePath = getCachePath()): void {
  if (fs.existsSync(cachePath)) {
    fs.rmSync(cachePath, { recursive: true, force: true });
  }
}

/**
 * Полный сброс при смене каталога: очищает массив extensions в .skill-hub.json
 * (если проект найден), затем удаляет кеш каталога.
 * Ошибки при очистке конфига выводят warning, но не блокируют сброс кеша.
 */
export function fullCatalogReset(cachePath = getCachePath()): void {
  try {
    const extensions = loadProjectExtensions();
    if (extensions.length > 0) {
      saveProjectExtensions([]);
    }
  } catch (err: any) {
    console.warn(`⚠  Не удалось очистить extensions в .skill-hub.json: ${err.message || err}`);
  }
  resetCache(cachePath);
}

/**
 * Гарантирует наличие локального кеша каталога.
 * Клонирует репозиторий при первом запуске, делает pull если отсутствует catalog.json,
 * пересоздаёт кеш если registryUrl изменился.
 */
export async function ensureCache(cachePath = getCachePath()): Promise<void> {
  const registryUrl = getRegistryUrl();

  // Если клон есть, проверяем совпадение origin с текущим registryUrl
  if (isCloned(cachePath)) {
    try {
      const git = simpleGit(cachePath);
      const currentOrigin = (await git.remote(['get-url', 'origin']))?.trim();
      if (currentOrigin && currentOrigin !== registryUrl) {
        console.log('Registry URL changed, resetting cache...');
        resetCache(cachePath);
      }
    } catch {
      // не удалось проверить origin — продолжаем
    }
  }

  if (!isCloned(cachePath)) {
    // Если директория существует без .git — удаляем и клонируем заново
    if (fs.existsSync(cachePath)) {
      fs.rmSync(cachePath, { recursive: true, force: true });
    }

    console.log('Downloading extension catalog...');
    try {
      await simpleGit().clone(registryUrl, cachePath, ['--depth', '1']);
    } catch (err: any) {
      throw new Error(
        `Failed to clone skill-hub repository.\n` +
        `Check your internet connection and that ${registryUrl} is accessible.\n` +
        `Details: ${err.message || err}`
      );
    }
  }

  // Клон есть, но catalog.json отсутствует — пробуем pull
  if (!fs.existsSync(path.join(cachePath, 'catalog.json'))) {
    try {
      const git = simpleGit(cachePath);
      await git.pull('origin', 'main', ['--ff-only']);
    } catch {
      // pull не помог — игнорируем, проверим ниже
    }

    if (!fs.existsSync(path.join(cachePath, 'catalog.json'))) {
      throw new Error(
        `catalog.json not found in the remote repository.\n` +
        `The repository may be empty or missing the catalog.\n` +
        `Ensure ${registryUrl} contains a valid catalog.json on the main branch.`
      );
    }
  }
}

/** Обновляет кеш каталога (git pull). Если кеш отсутствует — вызывает ensureCache */
export async function updateCache(cachePath = getCachePath()): Promise<void> {
  if (!isCloned(cachePath)) {
    await ensureCache(cachePath);
    return;
  }

  const registryUrl = getRegistryUrl();

  try {
    const git = simpleGit(cachePath);
    await git.pull('origin', 'main', ['--ff-only']);
  } catch (err: any) {
    throw new Error(
      `Failed to update skill-hub cache.\n` +
      `Check your internet connection and that ${registryUrl} is accessible.\n` +
      `Details: ${err.message || err}`
    );
  }

  if (!fs.existsSync(path.join(cachePath, 'catalog.json'))) {
    throw new Error(
      `catalog.json not found after update.\n` +
      `The remote repository may be missing the catalog file.`
    );
  }
}
