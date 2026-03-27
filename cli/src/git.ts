import os from 'os';
import path from 'path';
import fs from 'fs';
import simpleGit from 'simple-git';

const REPO_URL = 'https://github.com/emaxe/skill-hub.git';

export function getCachePath(): string {
  return path.join(os.homedir(), '.skill-hub');
}

export function isCloned(cachePath = getCachePath()): boolean {
  return fs.existsSync(path.join(cachePath, '.git'));
}

export async function ensureCache(cachePath = getCachePath()): Promise<void> {
  if (!isCloned(cachePath)) {
    // Если директория существует без .git — удаляем и клонируем заново
    if (fs.existsSync(cachePath)) {
      fs.rmSync(cachePath, { recursive: true, force: true });
    }

    console.log('Downloading extension catalog...');
    try {
      await simpleGit().clone(REPO_URL, cachePath, ['--depth', '1']);
    } catch (err: any) {
      throw new Error(
        `Failed to clone skill-hub repository.\n` +
        `Check your internet connection and that ${REPO_URL} is accessible.\n` +
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
        `Ensure ${REPO_URL} contains a valid catalog.json on the main branch.`
      );
    }
  }
}

export async function updateCache(cachePath = getCachePath()): Promise<void> {
  if (!isCloned(cachePath)) {
    await ensureCache(cachePath);
    return;
  }

  try {
    const git = simpleGit(cachePath);
    await git.pull('origin', 'main', ['--ff-only']);
  } catch (err: any) {
    throw new Error(
      `Failed to update skill-hub cache.\n` +
      `Check your internet connection and that ${REPO_URL} is accessible.\n` +
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
