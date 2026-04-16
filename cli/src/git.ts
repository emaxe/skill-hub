import os from 'os';
import path from 'path';
import fs from 'fs';
import simpleGit from 'simple-git';
import { resolveConfig, loadProjectExtensions, saveProjectExtensions, findProjectRoot } from './config';

/** Ошибка аутентификации git — кидается когда требуются учётные данные */
export class GitAuthError extends Error {
  constructor(public readonly url: string) {
    super(`Требуется аутентификация для ${url}`);
    this.name = 'GitAuthError';
  }
}

/** Определяет, является ли сообщение об ошибке ошибкой аутентификации git */
function isAuthError(msg: string): boolean {
  return (
    msg.includes('could not read Username') ||
    msg.includes('could not read Password') ||
    msg.includes('Authentication failed') ||
    msg.includes('Invalid username or password') ||
    msg.includes('terminal prompts disabled') ||
    msg.includes('HTTP Basic: Access denied') ||
    msg.includes('remote: Repository not found') ||
    msg.includes('could not read') && msg.includes('credential')
  );
}

/**
 * Встраивает учётные данные в HTTPS URL.
 * Например: https://github.com/… → https://user:pass@github.com/…
 * Для SSH URL возвращает URL без изменений.
 */
export function injectCredentials(url: string, username: string, password: string): string {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' || u.protocol === 'http:') {
      u.username = encodeURIComponent(username);
      u.password = encodeURIComponent(password);
      return u.toString();
    }
  } catch {
    // не HTTPS URL (например SSH) — возвращаем как есть
  }
  return url;
}

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
 * Бросает GitAuthError если репозиторий требует аутентификации.
 */
export async function ensureCache(cachePath = getCachePath()): Promise<void> {
  const registryUrl = getRegistryUrl();
  await ensureCacheWithUrl(registryUrl, cachePath);
}

/**
 * Гарантирует наличие кеша каталога с явными учётными данными.
 * Используется для повтора после GitAuthError с данными пользователя.
 */
export async function ensureCacheWithCredentials(
  username: string,
  password: string,
  cachePath = getCachePath()
): Promise<void> {
  const registryUrl = getRegistryUrl();
  const authedUrl = injectCredentials(registryUrl, username, password);
  await ensureCacheWithUrl(authedUrl, cachePath);
}

/**
 * Внутренняя реализация ensureCache с явным URL (может содержать учётные данные).
 */
async function ensureCacheWithUrl(registryUrl: string, cachePath: string): Promise<void> {
  const publicUrl = getRegistryUrl(); // для сообщений об ошибках (без credentials)

  // Если клон есть, проверяем совпадение origin с текущим registryUrl
  if (isCloned(cachePath)) {
    try {
      const git = simpleGit(cachePath);
      const currentOrigin = (await git.remote(['get-url', 'origin']))?.trim();
      if (currentOrigin && currentOrigin !== publicUrl) {
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
      const msg = String(err.message || err);
      if (isAuthError(msg)) throw new GitAuthError(publicUrl);
      throw new Error(
        `Failed to clone skill-hub repository.\n` +
        `Check your internet connection and that ${publicUrl} is accessible.\n` +
        `Details: ${msg}`
      );
    }
  }

  // Клон есть, но catalog.json отсутствует — пробуем pull
  if (!fs.existsSync(path.join(cachePath, 'catalog.json'))) {
    try {
      const git = simpleGit(cachePath);
      await git.pull('origin', 'main', ['--ff-only']);
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (isAuthError(msg)) throw new GitAuthError(publicUrl);
      // pull не помог — игнорируем, проверим ниже
    }

    if (!fs.existsSync(path.join(cachePath, 'catalog.json'))) {
      throw new Error(
        `catalog.json not found in the remote repository.\n` +
        `The repository may be empty or missing the catalog.\n` +
        `Ensure ${publicUrl} contains a valid catalog.json on the main branch.`
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
    const msg = String(err.message || err);
    if (isAuthError(msg)) throw new GitAuthError(registryUrl);
    throw new Error(
      `Failed to update skill-hub cache.\n` +
      `Check your internet connection and that ${registryUrl} is accessible.\n` +
      `Details: ${msg}`
    );
  }

  if (!fs.existsSync(path.join(cachePath, 'catalog.json'))) {
    throw new Error(
      `catalog.json not found after update.\n` +
      `The remote repository may be missing the catalog file.`
    );
  }
}
