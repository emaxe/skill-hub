import fs from 'fs';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import os from 'os';
import path from 'path';
import { loadCatalog, AgentName, platformKey } from '../catalog';
import { detectAgent } from '../detect-agent';
import { getCachePath, updateCache } from '../git';
import { createRegistry } from '../registry';
import { getAdapter } from '../adapters/get-adapter';
import { updateSelf } from '../base-setup';
import { resolveConfig, loadProjectExtensions, findProjectRoot } from '../config';
import { ensureConventionsStructure } from '../conventions';

export function makeUpdateCommand(): Command {
  return new Command('update')
    .description('Обновить расширения и каталог')
    .argument('[name]', 'Имя конкретного расширения (необязательно)')
    .option('--agent <agent>', 'Агент: claude-code, cursor, copilot, codex')
    .option('--no-self', 'Не обновлять базовый скилл и MCP')
    .action(async (name: string | undefined, opts: { agent?: string; self: boolean }) => {
      const spinner = ora('Обновление каталога...').start();
      try {
        await updateCache();

        const { config } = resolveConfig();
        const agent = (opts.agent || config.agent || detectAgent()) as AgentName;
        const cachePath = getCachePath();
        const catalog = loadCatalog(cachePath);
        const reg = createRegistry(path.join(os.homedir(), '.skill-hub'));
        const adapter = getAdapter(agent);

        // Восстановление структуры agents-conventions (директории, симлинки, bootstrap)
        if (agent === 'agents-conventions' && !name) {
          spinner.text = 'Восстановление структуры conventions...';
          ensureConventionsStructure();
        }

        // Сверка с проектным конфигом: установить расширения из .skill-hub.json, отсутствующие на диске
        if (!name) {
          const projectRoot = findProjectRoot();
          const projectExtensions = loadProjectExtensions(projectRoot ?? undefined);
          if (projectExtensions.length > 0) {
            spinner.text = 'Проверка проектных расширений...';
            let restored = 0;
            for (const pe of projectExtensions) {
              const ext = catalog.extensions.find(e => e.name === pe.name && e.type === pe.type);
              if (!ext || !ext.platforms[platformKey(agent)]) continue;

              const destPath = adapter.getInstallPath(ext, pe.scope);
              const installed = reg.isInstalled(pe.name, pe.type, agent);
              const fileExists = fs.existsSync(destPath);

              if (!installed || !fileExists) {
                try {
                  await adapter.install(ext, pe.scope, cachePath);
                  reg.add({
                    type: ext.type,
                    name: ext.name,
                    version: ext.version || pe.version || '0.0.0',
                    agent,
                    scope: pe.scope,
                    path: destPath,
                    projects: ext.projects.length > 0 ? ext.projects : undefined,
                    tags: ext.tags.length > 0 ? ext.tags : undefined,
                  });
                  restored++;
                } catch {
                  // skip missing source files
                }
              }
            }
            if (restored > 0) {
              console.log(chalk.green(`  Восстановлено ${restored} расширений из .skill-hub.json`));
            }
          }
        }

        // Обновление всех установленных расширений до актуальных версий
        spinner.text = 'Обновление расширений...';
        const installed = reg.list(agent);
        let updated = 0;

        for (const record of installed) {
          if (name && record.name !== name) continue;
          if (record.scope === 'parent') continue;
          const ext = catalog.extensions.find(e => e.name === record.name && e.type === record.type);
          if (!ext || !ext.platforms[platformKey(agent)]) continue;
          try {
            await adapter.install(ext, record.scope, cachePath);
            reg.add({ ...record, version: ext.version || record.version });
            updated++;
          } catch {
            // skip missing source files
          }
        }

        spinner.succeed(chalk.green(`Обновлено ${updated} расширений (${agent})`));

        if (!name && opts.self) {
          spinner.start('Обновление базового скилла и MCP...');
          const selfResult = await updateSelf(agent);
          spinner.stop();
          console.log(selfResult.skill
            ? chalk.green('✓ base-skill обновлён')
            : chalk.dim('— base-skill не установлен, пропускаю'));
          console.log(selfResult.mcp
            ? chalk.green('✓ MCP обновлён')
            : chalk.dim('— MCP не настроен, пропускаю'));
        }
      } catch (err) {
        spinner.fail(chalk.red(String(err)));
        process.exit(1);
      }
    });
}
