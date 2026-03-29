import os from 'os';
import path from 'path';
import fs from 'fs';
import simpleGit from 'simple-git';
import { loadConfig } from './config';

export function getRegistryUrl(): string {
  return loadConfig().registryUrl;
}

export function getCachePath(): string {
  return path.join(os.homedir(), '.skill-hub');
}

export function isCloned(cachePath = getCachePath()): boolean {
  return fs.existsSync(path.join(cachePath, '.git'));
}

export function resetCache(cachePath = getCachePath()): void {
  if (fs.existsSync(cachePath)) {
    fs.rmSync(cachePath, { recursive: true, force: true });
  }
}

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
