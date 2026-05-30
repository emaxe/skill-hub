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
import fs from 'fs';
import { searchSkillssh, downloadSkillssh, skillsshToExtension, SkillsshSearchResult, isSkillsshRef, parseSkillsshRef, writeSkillsshFilesToTmp } from '../skillssh';
import { installExtension as managerInstall } from '../extension-manager';


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
    projects: ext.projects.length > 0 ? ext.projects : undefined,
    tags: ext.tags.length > 0 ? ext.tags : undefined,
  });
}

export function makeInstallCommand(): Command {
  return new Command('install')
    .description('Установить расширение')
    .argument('<name>', 'Имя расширения (или type:name)')
    .option('--agent <agent>', 'Агент: claude-code, cursor, copilot, codex')
    .option('--global', 'Глобальная установка')
    .option('--project', 'Установка в текущий проект (по умолчанию)')
    .option('--local', 'Установка в текущий проект (alias для --project)')
    .action(async (nameArg: string, opts: { agent?: string; global?: boolean; project?: boolean; local?: boolean }) => {
      const spinner = ora().start();
      try {
        const agent = (opts.agent || detectAgent()) as AgentName;
        const scope = opts.global ? 'global' : 'project';

        if (agent === 'agents-conventions' && scope === 'global') {
          spinner.fail(chalk.red('agents-conventions поддерживает только project scope'));
          process.exit(1);
        }

        // --- skills.sh установка (не требует кеша каталога) ---
        if (isSkillsshRef(nameArg)) {
          spinner.text = 'Поиск на skills.sh...';
          const ref = parseSkillsshRef(nameArg);

          let skill: SkillsshSearchResult;

          if (ref.slug && ref.source) {
            // Fully qualified: skillssh:owner/repo@slug
            skill = { id: ref.slug, name: ref.slug, description: '', source: ref.source, installs: 0 };
          } else if (ref.source && !ref.slug) {
            // Partial: skillssh:owner/repo — search and interactive select
            const results = (await searchSkillssh(ref.source, 20)).filter(r => r.source === ref.source);
            if (results.length === 0) {
              spinner.fail(chalk.red(`Скиллы не найдены для ${ref.source}`));
              process.exit(1);
            }
            if (results.length === 1) {
              skill = results[0];
            } else {
              console.log(chalk.bold('\nНайдено несколько скиллов:\n'));
              results.forEach((r, i) => console.log(`  ${i + 1}. ${r.id} — ${r.description || 'нет описания'}`));
              console.log(chalk.yellow('\nУкажите конкретный скилл: skill-hub install skillssh:owner/repo@slug'));
              process.exit(0);
            }
          } else if (ref.slug && !ref.source) {
            // Just slug: search by slug
            const results = await searchSkillssh(ref.slug, 20);
            const exactMatches = results.filter(r => r.id === ref.slug);
            if (exactMatches.length === 0) {
              spinner.fail(chalk.red(`Скилл "${ref.slug}" не найден на skills.sh`));
              process.exit(1);
            }
            if (exactMatches.length > 1) {
              console.log(chalk.bold('\nНайдено несколько скиллов с таким slug:\n'));
              exactMatches.forEach((r, i) => console.log(`  ${i + 1}. ${r.source}@${r.id} — ${r.description || 'нет описания'}`));
              console.log(chalk.yellow('\nУкажите полный путь: skill-hub install skillssh:owner/repo@slug'));
              process.exit(0);
            }
            skill = exactMatches[0];
          } else {
            spinner.fail(chalk.red(`Неверный формат skills.sh ссылки: ${nameArg}`));
            process.exit(1);
          }

          spinner.text = `Загрузка ${skill.id}...`;
          const download = await downloadSkillssh(skill.source, skill.id);
          const tmpDir = writeSkillsshFilesToTmp(download, skill.id);

          const ext = skillsshToExtension(skill, download.hash);
          const adapter = getAdapter(agent);
          const registryDir = path.join(os.homedir(), '.skill-hub');

          spinner.text = `Установка ${ext.name}...`;
          await managerInstall(ext, agent, scope, registryDir, tmpDir);

          // Cleanup tmp dir (best effort)
          try { fs.rmSync(tmpDir, { recursive: true }); } catch {}

          spinner.succeed(chalk.green(`Установлен ${ext.type}:${ext.name} (${agent}, ${scope}) [skills.sh]`));
          return;
        }

        // --- Каталог установка (требует кеш) ---
        spinner.text = 'Обновление каталога...';
        await ensureCache();
        const cachePath = getCachePath();
        const catalog = loadCatalog(cachePath);

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

        if (hasProjectConfig()) {
          for (const dep of ext.dependencies) {
            let depType: ExtensionType | undefined;
            let depName = dep;
            if (dep.includes(':')) [depType, depName] = dep.split(':') as [ExtensionType, string];
            const depExt = catalog.extensions.find(e => e.name === depName && (!depType || e.type === depType));
            if (depExt) {
              addProjectExtension({ type: depExt.type, name: depExt.name, version: depExt.version, scope });
            }
          }
          addProjectExtension({ type: ext.type, name: ext.name, version: ext.version, scope });
        }

        spinner.succeed(chalk.green(`Установлен ${ext.type}:${ext.name} v${ext.version || '?'} (${agent}, ${scope})`));
      } catch (err) {
        spinner.fail(chalk.red(String(err)));
        process.exit(1);
      }
    });
}
