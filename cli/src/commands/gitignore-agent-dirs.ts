/**
 * CLI-команда `skill-hub gitignore-agent-dirs` — управление настройкой gitignoreAgentDirs.
 *
 * Subcommands:
 *   enable   — включить настройку и добавить папки ИИ-агентов в .gitignore
 *   disable  — выключить настройку и удалить секцию skill-hub из .gitignore
 *   status   — показать текущее состояние
 */
import { Command } from 'commander';
import chalk from 'chalk';
import { findProjectRoot, loadGitignoreAgentDirs, saveGitignoreAgentDirs } from '../config';
import { getMissingGitignoreEntries, addAgentDirsToGitignore, removeAgentDirsFromGitignore, getExistingAgentEntries } from '../gitignore-agents';

export function makeGitignoreAgentDirsCommand(): Command {
  const cmd = new Command('gitignore-agent-dirs')
    .description('Управление автодобавлением папок ИИ-агентов в .gitignore');

  cmd.command('enable')
    .description('Включить настройку и добавить папки ИИ-агентов в .gitignore')
    .action(() => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Проектный конфиг не найден. Запустите команду из корня проекта со .skill-hub.json'));
        process.exit(1);
      }

      saveGitignoreAgentDirs(true, projectRoot);
      console.log(chalk.green('✓ Настройка gitignoreAgentDirs включена'));

      const missing = getMissingGitignoreEntries(projectRoot);
      if (missing.length > 0) {
        addAgentDirsToGitignore(projectRoot, missing);
        console.log(chalk.green(`✓ Добавлено в .gitignore: ${missing.join(', ')}`));
      } else {
        console.log(chalk.dim('— Все папки уже присутствуют в .gitignore'));
      }
    });

  cmd.command('disable')
    .description('Выключить настройку и удалить секцию skill-hub из .gitignore')
    .action(() => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Проектный конфиг не найден. Запустите команду из корня проекта со .skill-hub.json'));
        process.exit(1);
      }

      saveGitignoreAgentDirs(false, projectRoot);
      console.log(chalk.green('✓ Настройка gitignoreAgentDirs выключена'));

      removeAgentDirsFromGitignore(projectRoot);
      console.log(chalk.dim('— Секция skill-hub удалена из .gitignore (если была)'));
    });

  cmd.command('status')
    .description('Показать текущее состояние настройки gitignoreAgentDirs')
    .action(() => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.log(chalk.yellow('Проектный конфиг не найден'));
        return;
      }

      const enabled = loadGitignoreAgentDirs(projectRoot);
      console.log(`gitignoreAgentDirs: ${enabled ? chalk.green('включено') : chalk.dim('выключено')}`);
      console.log(`Корень проекта: ${projectRoot}`);

      const existing = getExistingAgentEntries(projectRoot);
      if (existing.length > 0) {
        const missing = getMissingGitignoreEntries(projectRoot);
        console.log('');
        console.log('Папки ИИ-агентов в проекте:');
        for (const entry of existing) {
          const inGitignore = !missing.includes(entry);
          const status = inGitignore ? chalk.green('✓') : chalk.yellow('✗');
          console.log(`  ${status} ${entry}${inGitignore ? '' : '  (нет в .gitignore)'}`);
        }
      } else {
        console.log(chalk.dim('Папки ИИ-агентов в проекте не найдены'));
      }
    });

  return cmd;
}
