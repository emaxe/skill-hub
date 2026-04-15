import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import readline from 'readline';
import { AgentName } from '../catalog';
import { enableConventions, disableConventions, getConventionsStatus } from '../conventions';

function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

export function makeAgentsConventionsCommand(): Command {
  const cmd = new Command('agents-conventions')
    .description('Управление режимом agents-conventions (единая .agents/ директория)');

  cmd.command('enable')
    .description('Включить режим agents-conventions')
    .action(async () => {
      const spinner = ora('Включаю agents-conventions...').start();
      try {
        const result = await enableConventions();
        spinner.succeed(chalk.green('Режим agents-conventions включён'));
        console.log();
        console.log(chalk.cyan('Структура создана:'));
        console.log('  .agents/skills/    — скиллы');
        console.log('  .agents/rules/     — правила');
        console.log('  AGENTS.md          — индекс правил');
        console.log('  Симлинки:          .claude/skills → .agents/skills');
        console.log('                     .github/skills → .agents/skills');
        console.log('                     .cursor/skills → .agents/skills');
        console.log('                     .codex/skills  → .agents/skills');
        if (result.needsAutoAnalysis) {
          console.log();
          console.log(chalk.yellow('Корневые конфиги не найдены.'));
          console.log('  Для автоанализа проекта запустите AI-агент и попросите');
          console.log('  создать .agents/rules/project-rules.md с описанием проекта.');
        }
      } catch (err) {
        spinner.fail(chalk.red(String(err)));
        process.exit(1);
      }
    });

  cmd.command('disable')
    .description('Выключить режим agents-conventions')
    .option('--agent <agent>', 'Целевой агент: claude-code, cursor, copilot, codex')
    .action(async (opts: { agent?: string }) => {
      let targetAgent = opts.agent as AgentName | undefined;

      if (!targetAgent) {
        const answer = await askQuestion(
          'Целевой агент (claude-code/cursor/copilot/codex): '
        );
        if (!['claude-code', 'cursor', 'copilot', 'codex'].includes(answer)) {
          console.error(chalk.red('Неверный агент. Допустимые: claude-code, cursor, copilot, codex'));
          process.exit(1);
        }
        targetAgent = answer as AgentName;
      }

      const spinner = ora('Выключаю agents-conventions...').start();
      try {
        await disableConventions(
          targetAgent,
          process.cwd(),
          async () => {
            spinner.stop();
            const answer = await askQuestion(
              'Удалить .agents/ и AGENTS.md? (y/n): '
            );
            return answer === 'y' || answer === 'yes' || answer === 'д' || answer === 'да';
          }
        );
        spinner.succeed(chalk.green(`Режим agents-conventions выключен. Агент: ${targetAgent}`));
      } catch (err) {
        spinner.fail(chalk.red(String(err)));
        process.exit(1);
      }
    });

  cmd.command('status')
    .description('Показать статус режима agents-conventions')
    .action(() => {
      const status = getConventionsStatus();

      console.log(chalk.bold('AGENTS-CONVENTIONS Mode'));
      console.log();
      console.log(`  Режим:       ${status.active ? chalk.green('активен') : chalk.gray('неактивен')}`);
      console.log(`  .agents/:    ${status.hasAgentsDir ? chalk.green('есть') : chalk.gray('нет')}`);
      console.log(`  Расширений:  ${status.extensionCount}`);
      console.log();

      console.log(chalk.bold('Симлинки:'));
      for (const s of status.symlinks) {
        const label = s.valid ? chalk.green('✓') : s.exists ? chalk.yellow('⚠ не симлинк') : chalk.gray('✗');
        console.log(`  ${label} ${s.path}`);
      }
      console.log();

      console.log(chalk.bold('Указатели:'));
      for (const p of status.pointers) {
        const label = p.exists ? chalk.green('✓') : chalk.gray('✗');
        console.log(`  ${label} ${p.path}`);
      }
    });

  return cmd;
}
