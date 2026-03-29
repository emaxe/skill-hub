import { Command } from 'commander';
import chalk from 'chalk';
import { AgentName } from '../catalog';
import { installMcp, getMcpConfigPath } from '../base-setup';

export function makeSetupMcpCommand(): Command {
  return new Command('setup-mcp')
    .description('Зарегистрировать MCP сервер для AI-агента')
    .option('--agent <agent>', 'Агент: claude-code, cursor', 'claude-code')
    .action(async (opts: { agent: string }) => {
      const agent = opts.agent as AgentName;
      const configPath = getMcpConfigPath(agent);
      if (configPath === null) {
        console.error(chalk.red(`Агент ${agent} не поддерживает MCP`));
        process.exit(1);
      }
      try {
        await installMcp(agent);
        console.log(chalk.green(`✓ MCP сервер зарегистрирован в ${configPath}`));
        console.log(chalk.dim('Перезапустите агента для применения изменений.'));
      } catch (err) {
        console.error(chalk.red(String(err)));
        process.exit(1);
      }
    });
}
