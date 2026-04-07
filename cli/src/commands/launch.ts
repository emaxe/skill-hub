import { Command } from 'commander';
import { spawn } from 'child_process';
import chalk from 'chalk';
import { resolveConfig } from '../config';

const AGENT_BINARIES: Record<string, string> = {
  'claude-code': 'claude',
  'cursor':      'cursor',
  'copilot':     'copilot',
};

export function makeLaunchCommand(): Command {
  return new Command('launch')
    .description('Запустить AI-агент (с прокси, если настроен)')
    .argument('<agent>', `Агент: ${Object.keys(AGENT_BINARIES).join(', ')}`)
    .allowUnknownOption()
    .action((agentName: string) => {
      const binary = AGENT_BINARIES[agentName];
      if (!binary) {
        console.error(chalk.red(`Неизвестный агент: ${agentName}`));
        console.error(`Допустимые: ${Object.keys(AGENT_BINARIES).join(', ')}`);
        process.exit(1);
      }

      const { config } = resolveConfig();
      const aiAgents = config.aiAgents;
      const agentCfg = aiAgents.agents[agentName as keyof typeof aiAgents.agents];

      const env = { ...process.env };

      if (agentCfg?.useProxy && aiAgents.proxy) {
        const proxy = aiAgents.proxy;
        env.http_proxy  = proxy;
        env.https_proxy = proxy;
        env.all_proxy   = proxy;
        console.log(chalk.cyan(`Прокси: ${proxy}`));
      }

      // Все аргументы после имени агента пробрасываются напрямую
      const extraArgs = process.argv.slice(4);

      if (extraArgs.length > 0) {
        console.log(chalk.gray(`Запуск: ${binary} ${extraArgs.join(' ')}`));
      } else {
        console.log(chalk.gray(`Запуск: ${binary}`));
      }

      const child = spawn(binary, extraArgs, {
        env,
        stdio: 'inherit',
        shell: false,
      });

      child.on('error', (err) => {
        console.error(chalk.red(`Ошибка запуска ${binary}: ${err.message}`));
        process.exit(1);
      });

      child.on('exit', (code) => {
        process.exit(code ?? 0);
      });
    });
}
