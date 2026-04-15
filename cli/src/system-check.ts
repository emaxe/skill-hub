/**
 * Проверка системных зависимостей при старте CLI.
 * Верифицирует наличие обязательных внешних инструментов (git, Node.js >= 18).
 * Опциональные инструменты (open, xdg-open, ai-агенты) не проверяются — они нужны
 * только для конкретных команд и обрабатываются локально в точке использования.
 */
import { spawnSync } from 'child_process';
import chalk from 'chalk';
import { isWindows, isMac } from './platform';

/** Результат проверки одной зависимости */
export interface CheckResult {
  /** Название инструмента */
  name: string;
  /** true — найден и версия подходит */
  ok: boolean;
  /** Инструкции по установке (только если ok === false) */
  installInstructions?: string;
}

/** Минимальная требуемая мажорная версия Node.js */
const MIN_NODE_MAJOR = 18;

/**
 * Инструкции по установке git для текущей платформы.
 */
function gitInstallInstructions(): string {
  if (isMac) {
    return [
      '  macOS:',
      '    brew install git',
      '    или: xcode-select --install',
    ].join('\n');
  }
  if (isWindows) {
    return [
      '  Windows:',
      '    winget install Git.Git',
      '    или скачайте: https://git-scm.com/download/win',
    ].join('\n');
  }
  // Linux
  return [
    '  Linux (Debian/Ubuntu):',
    '    sudo apt install git',
    '  Linux (Fedora/RHEL):',
    '    sudo dnf install git',
  ].join('\n');
}

/**
 * Инструкции по установке Node.js >= 18 для текущей платформы.
 */
function nodeInstallInstructions(): string {
  if (isMac) {
    return [
      '  macOS:',
      '    brew install node',
      '    или через nvm: nvm install 18 && nvm use 18',
    ].join('\n');
  }
  if (isWindows) {
    return [
      '  Windows:',
      '    winget install OpenJS.NodeJS',
      '    или скачайте: https://nodejs.org',
    ].join('\n');
  }
  // Linux
  return [
    '  Linux (через nvm — рекомендуется):',
    '    nvm install 18 && nvm use 18',
    '  Linux (Debian/Ubuntu):',
    '    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -',
    '    sudo apt install -y nodejs',
  ].join('\n');
}

/**
 * Проверить наличие git в системе.
 */
function checkGit(): CheckResult {
  const result = spawnSync('git', ['--version'], { stdio: 'pipe' });
  if (result.error || result.status !== 0) {
    return {
      name: 'git',
      ok: false,
      installInstructions: gitInstallInstructions(),
    };
  }
  return { name: 'git', ok: true };
}

/**
 * Проверить версию Node.js (должна быть >= 18).
 */
function checkNodeVersion(): CheckResult {
  const major = parseInt(process.version.slice(1), 10);
  if (major < MIN_NODE_MAJOR) {
    return {
      name: `Node.js >= ${MIN_NODE_MAJOR} (текущая: ${process.version})`,
      ok: false,
      installInstructions: nodeInstallInstructions(),
    };
  }
  return { name: 'Node.js', ok: true };
}

/**
 * Проверить все обязательные системные зависимости.
 * Возвращает массив результатов только для проваленных проверок.
 * Если SKILL_HUB_SKIP_CHECKS=1 — возвращает пустой массив (для CI/скриптов).
 */
export function checkSystemDependencies(): CheckResult[] {
  if (process.env.SKILL_HUB_SKIP_CHECKS === '1') {
    return [];
  }

  const checks = [checkGit(), checkNodeVersion()];
  return checks.filter(c => !c.ok);
}

/**
 * Напечатать ошибки системных зависимостей в stderr.
 * @returns true если есть ошибки (нужно завершить процесс)
 */
export function printDependencyErrors(errors: CheckResult[]): boolean {
  if (errors.length === 0) return false;

  console.error('');
  for (const err of errors) {
    console.error(chalk.red(`✗ ${err.name} не найден`));
    if (err.installInstructions) {
      console.error('');
      console.error(chalk.yellow('  Установите:'));
      console.error(chalk.yellow(err.installInstructions));
    }
    console.error('');
  }

  return true;
}
