import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import os from 'os';
import path from 'path';
import { loadCatalog, AgentName, ExtensionType } from '../catalog';
import { detectAgent } from '../detect-agent';
import { getCachePath } from '../git';
import { createRegistry } from '../registry';
import { getAdapter } from '../adapters/get-adapter';
import { hasProjectConfig, removeProjectExtension } from '../config';

export function makeRemoveCommand(): Command {
  return new Command('remove')
    .aliases(['uninstall', 'rm'])
    .description('Удалить расширение')
    .argument('<name>', 'Имя расширения (или type:name)')
    .option('--agent <agent>', 'Агент: claude-code, cursor, copilot')
    .option('--global', 'Удалить глобальную установку')
    .option('--project', 'Удалить проектную установку')
    .option('--local', 'Удалить проектную установку (alias для --project)')
    .option('--keep-files', 'Удалить только из реестра, оставить файлы на диске')
    .action(async (nameArg: string, opts: { agent?: string; global?: boolean; project?: boolean; local?: boolean; keepFiles?: boolean }) => {
      const spinner = ora('Удаление...').start();
      try {
        const agent = (opts.agent || detectAgent()) as AgentName;
        const scope = opts.global ? 'global' : 'project';

        if (agent === 'agents-conventions' && scope === 'global') {
          spinner.fail(chalk.red('agents-conventions поддерживает только project scope'));
          process.exit(1);
        }

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

        if (!opts.keepFiles) {
          const adapter = getAdapter(agent);
          await adapter.remove(ext, scope);
        }

        const reg = createRegistry(path.join(os.homedir(), '.skill-hub'));
        reg.remove(ext.name, ext.type, agent);

        if (hasProjectConfig()) {
          removeProjectExtension(ext.name, ext.type);
        }

        const suffix = opts.keepFiles ? ', файлы сохранены' : '';
        spinner.succeed(chalk.green(`Удалён ${ext.type}:${ext.name} (${agent}, ${scope}${suffix})`));
      } catch (err) {
        spinner.fail(chalk.red(String(err)));
        process.exit(1);
      }
    });
}
