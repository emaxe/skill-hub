#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const system_check_1 = require("./system-check");
/**
 * Транслирует сокращения -u / -U в команду update.
 * -u [name] → update [name]
 * -U        → update (без аргументов, обновить всё)
 */
function translateShortcuts(argv) {
    const prefix = argv.slice(0, 2);
    const args = argv.slice(2);
    const result = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '-U') {
            result.push('update');
        }
        else if (args[i] === '-u') {
            result.push('update');
            // -u принимает необязательный аргумент (имя расширения)
            if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
                result.push(args[++i]);
            }
        }
        else {
            result.push(args[i]);
        }
    }
    return [...prefix, ...result];
}
/**
 * Выполнить одну skill-hub команду по переданному argv.
 */
async function executeArgs(argv) {
    argv = translateShortcuts(argv);
    // Ранний перехват флага -a / -A <agent> — запуск AI-агента с прокси
    const agentFlagIdx = Math.max(argv.indexOf('-a'), argv.indexOf('-A'));
    const launchMode = argv.includes('-A') ? 'script' : 'exec';
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
        const { launchAgent } = require('./agent-launcher');
        launchAgent(agentName, extraArgs, launchMode);
        return;
    }
    // help / -h / --help — пропускаем в Commander, не запускаем TUI
    const userArgs = argv.slice(2);
    const isHelp = userArgs.includes('help') || userArgs.includes('-h') || userArgs.includes('--help');
    // If no arguments provided — launch TUI
    if (argv.length <= 2 && !isHelp) {
        const { startTUI } = await Promise.resolve().then(() => __importStar(require('./tui')));
        await startTUI();
        return;
    }
    const { Command } = require('commander');
    const { makeSearchCommand } = require('./commands/search');
    const { makeListCommand } = require('./commands/list');
    const { makeInfoCommand } = require('./commands/info');
    const { makeInstallCommand } = require('./commands/install');
    const { makeRemoveCommand } = require('./commands/remove');
    const { makeMoveCommand } = require('./commands/move');
    const { makeUpdateCommand } = require('./commands/update');
    const { makeSetupMcpCommand } = require('./commands/setup-mcp');
    const { makeConfigCommand } = require('./commands/config');
    const { makeAgentsConventionsCommand } = require('./commands/agents-conventions');
    const program = new Command();
    program
        .name('skill-hub')
        .description('Extension manager for AI coding agents (Claude Code, Cursor, Copilot)')
        .version('0.1.7');
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
  skill-hub -U --then -a copilot           Обновить всё, затем запустить Copilot`);
    await program.parseAsync(argv);
}
// Точка входа: поддержка --then для цепочки команд
(async () => {
    // Проверка системных зависимостей перед любыми командами
    const depErrors = (0, system_check_1.checkSystemDependencies)();
    if ((0, system_check_1.printDependencyErrors)(depErrors)) {
        process.exit(1);
    }
    const thenIdx = process.argv.indexOf('--then');
    try {
        if (thenIdx !== -1) {
            const firstArgv = [...process.argv.slice(0, 2), ...process.argv.slice(2, thenIdx)];
            const secondArgv = [...process.argv.slice(0, 2), ...process.argv.slice(thenIdx + 1)];
            await executeArgs(firstArgv);
            await executeArgs(secondArgv);
        }
        else {
            await executeArgs(process.argv);
        }
    }
    catch (err) {
        console.error(`\nError: ${err.message}`);
        process.exit(1);
    }
})();
