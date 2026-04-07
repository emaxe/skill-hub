import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import os from 'os';
import path from 'path';
import { loadCatalog, AgentName, ExtensionType, Extension, platformKey } from '../catalog';
import { detectAgent } from '../detect-agent';
import { getCachePath, ensureCache } from '../git';
import { createRegistry } from '../registry';
import { AgentAdapter } from '../adapters/types';
import { getAdapter } from '../adapters/get-adapter';

async function installExtension(
  ext: Extension,
  adapter: AgentAdapter,
  scope: 'global' | 'project',
  cachePath: string,
  reg: ReturnType<typeof createRegistry>
): Promise<void> {
  if (!ext.platforms[platformKey(adapter.agentName)]) {
    throw new Error(`Расширение "${ext.name}" не поддерживает агента ${adapter.agentName}`);
  }
  await adapter.install(ext, scope, cachePath);
  reg.add({
    type: ext.type, name: ext.name,
    version: ext.version || '0.0.0',
    agent: adapter.agentName, scope,
    path: adapter.getInstallPath(ext, scope),
  });
}

export function makeInstallCommand(): Command {
  return new Command('install')
    .description('Установить расширение')
    .argument('<name>', 'Имя расширения (или type:name)')
    .option('--agent <agent>', 'Агент: claude-code, cursor, copilot')
    .option('--global', 'Глобальная установка')
    .option('--project', 'Установка в текущий проект (по умолчанию)')
    .option('--local', 'Установка в текущий проект (alias для --project)')
    .action(async (nameArg: string, opts: { agent?: string; global?: boolean; project?: boolean; local?: boolean }) => {
      const spinner = ora('Обновление каталога...').start();
      try {
        await ensureCache();
        const cachePath = getCachePath();
        const catalog = loadCatalog(cachePath);
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

        const ext = catalog.extensions.find(e => e.name === name && (!type || e.type === type));
        if (!ext) {
          spinner.fail(chalk.red(`Расширение "${nameArg}" не найдено`));
          process.exit(1);
        }

        const adapter = getAdapter(agent);
        const reg = createRegistry(path.join(os.homedir(), '.skill-hub'));

        // Установить зависимости
        for (const dep of ext.dependencies) {
          let depType: ExtensionType | undefined;
          let depName = dep;
          if (dep.includes(':')) [depType, depName] = dep.split(':') as [ExtensionType, string];
          const depExt = catalog.extensions.find(e => e.name === depName && (!depType || e.type === depType));
          if (depExt && !reg.isInstalled(depExt.name, depExt.type, agent)) {
            spinner.text = `Устанавливаю зависимость: ${dep}`;
            await installExtension(depExt, adapter, scope, cachePath, reg);
          }
        }

        spinner.text = `Устанавливаю ${ext.type}:${ext.name}...`;
        await installExtension(ext, adapter, scope, cachePath, reg);
        spinner.succeed(chalk.green(`Установлен ${ext.type}:${ext.name} v${ext.version || '?'} (${agent}, ${scope})`));
      } catch (err) {
        spinner.fail(chalk.red(String(err)));
        process.exit(1);
      }
    });
}
