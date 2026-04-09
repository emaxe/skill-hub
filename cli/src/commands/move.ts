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
import { hasProjectConfig, addProjectExtension } from '../config';

export async function moveExtension(
  ext: Extension,
  adapter: AgentAdapter,
  from: 'global' | 'project',
  to: 'global' | 'project',
  cachePath: string,
  reg: ReturnType<typeof createRegistry>
): Promise<void> {
  if (!ext.platforms[platformKey(adapter.agentName)]) {
    throw new Error(`Расширение "${ext.name}" не поддерживает агента ${adapter.agentName}`);
  }
  if (!adapter.isInstalled(ext, from)) {
    throw new Error(`Расширение "${ext.name}" не установлено в scope "${from}"`);
  }
  await adapter.install(ext, to, cachePath);
  await adapter.remove(ext, from);
  reg.add({
    type: ext.type, name: ext.name,
    version: ext.version || '0.0.0',
    agent: adapter.agentName, scope: to,
    path: adapter.getInstallPath(ext, to),
  });
}

export function makeMoveCommand(): Command {
  return new Command('move')
    .description('Перенести расширение между scope (global ↔ project)')
    .argument('<name>', 'Имя расширения (или type:name)')
    .option('--agent <agent>', 'Агент: claude-code, cursor, copilot')
    .option('--to-global', 'Перенести в глобальный scope')
    .option('--to-project', 'Перенести в проектный scope')
    .option('--to-local', 'Перенести в проектный scope (alias для --to-project)')
    .action(async (nameArg: string, opts: { agent?: string; toGlobal?: boolean; toProject?: boolean; toLocal?: boolean }) => {
      const spinner = ora('Обновление каталога...').start();
      try {
        const toProject = opts.toProject || opts.toLocal;
        if (!opts.toGlobal && !toProject) {
          spinner.fail(chalk.red('Укажите направление: --to-global или --to-project'));
          process.exit(1);
        }
        const to: 'global' | 'project' = opts.toGlobal ? 'global' : 'project';
        const from: 'global' | 'project' = to === 'global' ? 'project' : 'global';

        await ensureCache();
        const cachePath = getCachePath();
        const catalog = loadCatalog(cachePath);
        const agent = (opts.agent || detectAgent()) as AgentName;

        if (agent === 'agents-conventions' && opts.toGlobal) {
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

        spinner.text = `Переношу ${ext.type}:${ext.name} из ${from} в ${to}...`;
        await moveExtension(ext, adapter, from, to, cachePath, reg);

        if (hasProjectConfig()) {
          addProjectExtension({ type: ext.type, name: ext.name, version: ext.version, scope: to });
        }

        spinner.succeed(chalk.green(`Перенесён ${ext.type}:${ext.name} из ${from} в ${to} (${agent})`));
      } catch (err) {
        spinner.fail(chalk.red(String(err)));
        process.exit(1);
      }
    });
}
