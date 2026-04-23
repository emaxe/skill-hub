#!/usr/bin/env node

import { checkSystemDependencies, printDependencyErrors } from './system-check';

/**
 * Транслирует сокращения -u / -U в команду update.
 * -u [name] → update [name]
 * -U        → update (без аргументов, обновить всё)
 */
function translateShortcuts(argv: string[]): string[] {
  const prefix = argv.slice(0, 2);
  const args = argv.slice(2);
  const result: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-U') {
      result.push('update');
    } else if (args[i] === '-u') {
      result.push('update');
      // -u принимает необязательный аргумент (имя расширения)
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        result.push(args[++i]);
      }
    } else {
      result.push(args[i]);
    }
  }

  return [...prefix, ...result];
}

/**
 * Выполнить одну skill-hub команду по переданному argv.
 */
async function executeArgs(argv: string[]): Promise<void> {
  argv = translateShortcuts(argv);

  // Ранний перехват флага -a / -A <agent> — запуск AI-агента с прокси
  const agentFlagIdx = Math.max(argv.indexOf('-a'), argv.indexOf('-A'));
  const launchMode = argv.includes('-A') ? 'script' as const : 'exec' as const;
  if (agentFlagIdx !== -1) {
    const agentName = argv[agentFlagIdx + 1];
    if (!agentName || agentName.startsWith('-')) {
      console.error('Использование: skill-hub -a|-A <agent> [аргументы для агента...]');
      console.error('  -a  запуск через exec (по умолчанию)');
      console.error('  -A  запуск через temp-скрипт');
      console.error('Агенты: claude-code, cursor, copilot, codex');
      process.exit(1);
    }
    const extraArgs = argv.filter((_, i) => i > 1 && i !== agentFlagIdx && i !== agentFlagIdx + 1);
    const { launchAgent } = require('./agent-launcher') as typeof import('./agent-launcher');
    launchAgent(agentName, extraArgs, launchMode);
    return;
  }

  // help / -h / --help — пропускаем в Commander, не запускаем TUI
  const userArgs = argv.slice(2);
  const isHelp = userArgs.includes('help') || userArgs.includes('-h') || userArgs.includes('--help');

  // If no arguments provided — launch TUI
  if (argv.length <= 2 && !isHelp) {
    const { startTUI } = await import('./tui');
    await startTUI();
    return;
  }

  const { Command } = require('commander') as typeof import('commander');
  const { makeSearchCommand } = require('./commands/search') as typeof import('./commands/search');
  const { makeListCommand } = require('./commands/list') as typeof import('./commands/list');
  const { makeInfoCommand } = require('./commands/info') as typeof import('./commands/info');
  const { makeInstallCommand } = require('./commands/install') as typeof import('./commands/install');
  const { makeRemoveCommand } = require('./commands/remove') as typeof import('./commands/remove');
  const { makeMoveCommand } = require('./commands/move') as typeof import('./commands/move');
  const { makeUpdateCommand } = require('./commands/update') as typeof import('./commands/update');
  const { makeSetupMcpCommand } = require('./commands/setup-mcp') as typeof import('./commands/setup-mcp');
  const { makeConfigCommand } = require('./commands/config') as typeof import('./commands/config');
  const { makeAgentsConventionsCommand } = require('./commands/agents-conventions') as typeof import('./commands/agents-conventions');
  const { makeGitignoreAgentDirsCommand } = require('./commands/gitignore-agent-dirs') as typeof import('./commands/gitignore-agent-dirs');

  const program = new Command();
  program
    .name('skill-hub')
    .description('Extension manager for AI coding agents (Claude Code, Cursor, Copilot)')
    .version('0.1.16');

  program.addCommand(makeSearchCommand());
  program.addCommand(makeListCommand());
  program.addCommand(makeInfoCommand());
  program.addCommand(makeInstallCommand());
  program.addCommand(makeRemoveCommand());
  program.addCommand(makeMoveCommand());
  program.addCommand(makeUpdateCommand());
  program.addCommand(makeSetupMcpCommand());
  program.addCommand(makeConfigCommand());
  program.addCommand(makeAgentsConventionsCommand());
  program.addCommand(makeGitignoreAgentDirsCommand());

  program.addHelpText('after', `
Дополнительные возможности:

  Интерактивный TUI:
    skill-hub                              Запуск полноэкранного интерфейса (без аргументов)

  Запуск AI-агента:
    skill-hub -a <agent> [аргументы...]    Запуск агента через exec
    skill-hub -A <agent> [аргументы...]    Запуск агента через temp-скрипт
    Агенты: claude-code, cursor, copilot, codex

  Сокращения для update:
    skill-hub -u [name]                    = skill-hub update [name]
    skill-hub -U                           = skill-hub update

  Цепочка команд:
    skill-hub <cmd1> --then <cmd2>         Выполнить cmd2 после завершения cmd1

Примеры:
  skill-hub search git                     Поиск расширений
  skill-hub install skill:git-helper       Установить скилл
  skill-hub -a claude-code -p "fix bug"    Запустить Claude Code
  skill-hub -U --then -a copilot           Обновить всё, затем запустить Copilot
  skill-hub gitignore-agent-dirs enable    Добавить папки агентов в .gitignore
  skill-hub gitignore-agent-dirs disable   Убрать папки агентов из .gitignore`);

  await program.parseAsync(argv);
}

// Точка входа: поддержка --then для цепочки команд
(async () => {
  // Проверка системных зависимостей перед любыми командами
  const depErrors = checkSystemDependencies();
  if (printDependencyErrors(depErrors)) {
    process.exit(1);
  }

  const thenIdx = process.argv.indexOf('--then');
  try {
    if (thenIdx !== -1) {
      const firstArgv  = [...process.argv.slice(0, 2), ...process.argv.slice(2, thenIdx)];
      const secondArgv = [...process.argv.slice(0, 2), ...process.argv.slice(thenIdx + 1)];
      await executeArgs(firstArgv);
      await executeArgs(secondArgv);
    } else {
      await executeArgs(process.argv);
    }
  } catch (err: unknown) {
    console.error(`\nError: ${(err as Error).message}`);
    process.exit(1);
  }
})();

