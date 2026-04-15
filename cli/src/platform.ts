/**
 * Хелпер платформы — кроссплатформенные утилиты.
 * Централизует проверки `process.platform` для Windows-совместимости.
 */
import path from 'path';
import os from 'os';

/** Windows (win32) */
export const isWindows = process.platform === 'win32';

/** macOS (darwin) */
export const isMac = process.platform === 'darwin';

/** Linux */
export const isLinux = process.platform === 'linux';

/**
 * Возвращает путь к AppData (Windows) или fallback.
 * На Windows: `%APPDATA%` или `~/AppData/Roaming`.
 * На других ОС: `~/.config` (XDG default).
 */
export function getAppData(): string {
  if (isWindows) {
    return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  }
  return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
}

/**
 * Сравнение путей с учётом платформы.
 * На Windows — case-insensitive + нормализация разделителей.
 * На Unix — точное сравнение после нормализации.
 */
export function pathsEqual(a: string, b: string): boolean {
  const na = path.normalize(a);
  const nb = path.normalize(b);
  if (isWindows) {
    return na.toLowerCase() === nb.toLowerCase();
  }
  return na === nb;
}
