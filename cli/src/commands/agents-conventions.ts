import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import readline from 'readline';
import { spawn } from 'child_process';
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

const AGENT_BINARIES: Record<string, string> = {
  'claude-code': 'claude',
  'cursor': 'agent',
  'copilot': 'copilot',
};

const AGENT_ARGS: Record<string, (targetAgent: AgentName) => string[]> = {
  'claude-code': (target) => ['--dangerously-skip-permissions', '-p', `run exit-agents skill. Target agent: ${target}`, '--allowedTools', 'shell(*), write'],
  'cursor': (target) => ['-p', '--force', `run exit-agents skill. Target agent: ${target}`],
  'copilot': (target) => ['-p', `run exit-agents skill. Target agent: ${target}`, '--no-ask-user', "--allow-tool=shell(*), write"],
};

function spawnAgent(agentName: string, targetAgent: AgentName): Promise<void> {
  return new Promise((resolve, reject) => {
    const binary = AGENT_BINARIES[agentName];
    const args = AGENT_ARGS[agentName](targetAgent);
    const child = spawn(binary, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Агент завершился с кодом ${code}`));
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
        await enableConventions();
        spinner.succeed(chalk.green('Режим agents-conventions включён'));
        console.log();
        console.log(chalk.cyan('Структура создана:'));
        console.log('  .agents/skills/    — скиллы');
        console.log('  .agents/rules/     — правила, агенты, команды');
        console.log('  Симлинки:          .claude/skills → .agents/skills');
        console.log('                     .github/skills → .agents/skills');
        console.log('                     .cursor/skills → .agents/skills');
        console.log();
        console.log(chalk.yellow('Следующий шаг:'));
        console.log('  Запустите AI-агент и попросите выполнить скилл init-agents');
        console.log('  для создания AGENTS.md и завершения настройки.');
      } catch (err) {
        spinner.fail(chalk.red(String(err)));
        process.exit(1);
      }
    });

  cmd.command('disable')
    .description('Выключить режим agents-conventions')
    .option('--agent <agent>', 'Целевой агент: claude-code, cursor, copilot')
    .option('--ai-agent <aiAgent>', 'AI-агент для запуска exit-agents (claude-code, cursor, copilot)')
    .option('--skip-agent', 'Пропустить AI-миграцию и выполнить только программную очистку')
    .action(async (opts: { agent?: string; aiAgent?: string; skipAgent?: boolean }) => {
      let targetAgent = opts.agent as AgentName | undefined;

      if (!targetAgent) {
        const answer = await askQuestion(
          'Целевой агент (claude-code/cursor/copilot): '
        );
        if (!['claude-code', 'cursor', 'copilot'].includes(answer)) {
          console.error(chalk.red('Неверный агент. Допустимые: claude-code, cursor, copilot'));
          process.exit(1);
        }
        targetAgent = answer as AgentName;
      }

      // Шаг 1: запуск AI-агента для интеллектуальной миграции (если не пропускаем)
      if (!opts.skipAgent) {
        let aiAgentName = opts.aiAgent;
        if (!aiAgentName) {
          const answer = await askQuestion(
            'AI-агент для запуска exit-agents (claude-code/cursor/copilot, Enter для пропуска): '
          );
          if (answer && ['claude-code', 'cursor', 'copilot'].includes(answer)) {
            aiAgentName = answer;
          }
        }

        if (aiAgentName && AGENT_BINARIES[aiAgentName]) {
          const spinner = ora(`Запускаю exit-agents через ${aiAgentName}...`).start();
          try {
            await spawnAgent(aiAgentName, targetAgent);
            spinner.succeed(chalk.green('Миграция через AI-агент завершена'));
          } catch (err) {
            spinner.fail(chalk.yellow(`Ошибка AI-миграции: ${String(err)}`));
            const cont = await askQuestion('Продолжить без AI-миграции? (y/n): ');
            if (cont !== 'y' && cont !== 'yes' && cont !== 'д' && cont !== 'да') {
              process.exit(1);
            }
          }
        }
      }

      // Шаг 2: программная очистка
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
