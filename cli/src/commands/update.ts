import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import os from 'os';
import path from 'path';
import { loadCatalog, AgentName } from '../catalog';
import { detectAgent } from '../detect-agent';
import { getCachePath, updateCache } from '../git';
import { createRegistry } from '../registry';
import { ClaudeCodeAdapter } from '../adapters/claude-code';
import { CursorAdapter } from '../adapters/cursor';
import { CopilotAdapter } from '../adapters/copilot';
import { AgentAdapter } from '../adapters/types';

function getAdapter(agent: AgentName): AgentAdapter {
  if (agent === 'cursor') return new CursorAdapter();
  if (agent === 'copilot') return new CopilotAdapter();
  return new ClaudeCodeAdapter();
}

export function makeUpdateCommand(): Command {
  return new Command('update')
    .description('Обновить расширения и каталог')
    .argument('[name]', 'Имя конкретного расширения (необязательно)')
    .option('--agent <agent>', 'Агент: claude-code, cursor, copilot')
    .action(async (name: string | undefined, opts: { agent?: string }) => {
      const spinner = ora('Обновление каталога...').start();
      try {
        await updateCache();
        spinner.text = 'Обновление расширений...';

        const agent = (opts.agent || detectAgent()) as AgentName;
        const cachePath = getCachePath();
        const catalog = loadCatalog(cachePath);
        const reg = createRegistry(path.join(os.homedir(), '.skill-hub'));
        const installed = reg.list(agent);
        const adapter = getAdapter(agent);
        let updated = 0;

        for (const record of installed) {
          if (name && record.name !== name) continue;
          const ext = catalog.extensions.find(e => e.name === record.name && e.type === record.type);
          if (!ext || !ext.platforms[agent]) continue;
          try {
            await adapter.install(ext, record.scope, cachePath);
            reg.add({ ...record, version: ext.version || record.version });
            updated++;
          } catch {
            // skip missing source files
          }
        }

        spinner.succeed(chalk.green(`Обновлено ${updated} расширений (${agent})`));
      } catch (err) {
        spinner.fail(chalk.red(String(err)));
        process.exit(1);
      }
    });
}
