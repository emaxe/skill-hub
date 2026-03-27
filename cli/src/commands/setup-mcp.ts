import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';

export function makeSetupMcpCommand(): Command {
  return new Command('setup-mcp')
    .description('Зарегистрировать MCP сервер для AI-агента')
    .option('--agent <agent>', 'Агент: claude-code, cursor', 'claude-code')
    .action(async (opts: { agent: string }) => {
      if (opts.agent === 'claude-code') {
        const configPath = path.join(os.homedir(), '.claude', 'claude_desktop_config.json');
        let config: Record<string, unknown> = {};
        if (fs.existsSync(configPath)) {
          try {
            config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          } catch {
            config = {};
          }
        }

        const mcpServers = (config.mcpServers || {}) as Record<string, unknown>;
        mcpServers['skill-hub'] = {
          command: 'skill-hub-mcp',
          args: [],
        };
        config.mcpServers = mcpServers;

        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(chalk.green(`✓ MCP сервер зарегистрирован в ${configPath}`));
        console.log(chalk.dim('Перезапустите Claude Code для применения изменений.'));
      } else if (opts.agent === 'cursor') {
        const configPath = path.join(os.homedir(), '.cursor', 'mcp.json');
        let config: Record<string, unknown> = {};
        if (fs.existsSync(configPath)) {
          try {
            config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          } catch {
            config = {};
          }
        }

        const mcpServers = (config.mcpServers || {}) as Record<string, unknown>;
        mcpServers['skill-hub'] = {
          command: 'skill-hub-mcp',
          args: [],
        };
        config.mcpServers = mcpServers;

        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(chalk.green(`✓ MCP сервер зарегистрирован в ${configPath}`));
        console.log(chalk.dim('Перезапустите Cursor для применения изменений.'));
      } else {
        console.error(chalk.red(`Агент ${opts.agent} не поддерживает MCP`));
        process.exit(1);
      }
    });
}
