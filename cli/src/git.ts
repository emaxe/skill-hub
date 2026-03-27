import os from 'os';
import path from 'path';
import fs from 'fs';
import simpleGit from 'simple-git';

// TODO: заменить на реальный URL репозитория после публикации
const REPO_URL = 'https://github.com/skillhub-io/skillhub.git';

export function getCachePath(): string {
  return path.join(os.homedir(), '.skill-hub');
}

export function isCloned(cachePath = getCachePath()): boolean {
  return fs.existsSync(path.join(cachePath, 'catalog.json'));
}

export async function ensureCache(cachePath = getCachePath()): Promise<void> {
  if (!isCloned(cachePath)) {
    console.log('Downloading extension catalog...');
    await simpleGit().clone(REPO_URL, cachePath, ['--depth', '1']);
  }
}

export async function updateCache(cachePath = getCachePath()): Promise<void> {
  if (!isCloned(cachePath)) {
    await ensureCache(cachePath);
    return;
  }
  const git = simpleGit(cachePath);
  await git.pull('origin', 'main', ['--ff-only']);
}
