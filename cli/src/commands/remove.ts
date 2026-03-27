import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import os from 'os';
import path from 'path';
import { loadCatalog, AgentName, ExtensionType } from '../catalog';
import { detectAgent } from '../detect-agent';
import { getCachePath } from '../git';
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

export function makeRemoveCommand(): Command {
  return new Command('remove')
    .aliases(['uninstall', 'rm'])
    .description('Удалить расширение')
    .argument('<name>', 'Имя расширения (или type:name)')
    .option('--agent <agent>', 'Агент: claude-code, cursor, copilot')
    .option('--global', 'Удалить глобальную установку')
    .option('--project', 'Удалить проектную установку')
    .action(async (nameArg: string, opts: { agent?: string; global?: boolean; project?: boolean }) => {
      const spinner = ora('Удаление...').start();
      try {
        const agent = (opts.agent || detectAgent()) as AgentName;
        const scope = opts.project ? 'project' : 'global';

        let type: ExtensionType | undefined;
        let name = nameArg;
        if (nameArg.includes(':')) {
          [type, name] = nameArg.split(':') as [ExtensionType, string];
        }

        const catalog = loadCatalog(getCachePath());
        const ext = catalog.extensions.find(e => e.name === name && (!type || e.type === type));
        if (!ext) {
          spinner.fail(chalk.red(`Расширение не найдено: ${nameArg}`));
          process.exit(1);
        }

        const adapter = getAdapter(agent);
        await adapter.remove(ext, scope);

        const reg = createRegistry(path.join(os.homedir(), '.skill-hub'));
        reg.remove(ext.name, ext.type, agent);

        spinner.succeed(chalk.green(`Удалён ${ext.type}:${ext.name} (${agent})`));
      } catch (err) {
        spinner.fail(chalk.red(String(err)));
        process.exit(1);
      }
    });
}
