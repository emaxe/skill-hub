import fs from 'fs';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import os from 'os';
import path from 'path';
import { loadCatalog, AgentName, platformKey, Extension } from '../catalog';
import { downloadSkillssh, skillsshToExtension } from '../skillssh';
import { detectAgent } from '../detect-agent';
import { getCachePath, updateCache } from '../git';
import { createRegistry } from '../registry';
import { getAdapter } from '../adapters/get-adapter';
import { updateSelf } from '../base-setup';
import { resolveConfig, loadProjectExtensions, findProjectRoot, loadGitignoreAgentDirs } from '../config';
import { ensureConventionsStructure } from '../conventions';
import { getMissingGitignoreEntries, addAgentDirsToGitignore } from '../gitignore-agents';

function parseSkillsshSource(source: string): { source: string; slug: string } | null {
  const prefix = 'skillssh:';
  if (!source.startsWith(prefix)) return null;
  const rest = source.slice(prefix.length);
  const atIdx = rest.lastIndexOf('@');
  if (atIdx === -1) return null;
  return { source: rest.slice(0, atIdx), slug: rest.slice(atIdx + 1) };
}

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
              const destPath = adapter.getInstallPath({ type: pe.type, name: pe.name, description: '', tags: [], scope: 'both', platforms: {}, path: '', dependencies: [], projects: [] } as Extension, pe.scope);
              const installed = reg.isInstalled(pe.name, pe.type, agent);
              const fileExists = fs.existsSync(destPath);

              if (!installed || !fileExists) {
                // Source-aware restore for skills.sh
                if (pe.source?.startsWith('skillssh:')) {
                  const ref = parseSkillsshSource(pe.source);
                  if (ref) {
                    try {
                      const download = await downloadSkillssh(ref.source, ref.slug);
                      const ext = skillsshToExtension(
                        { id: ref.slug, name: ref.slug, description: '', source: ref.source, installs: 0 },
                        download.hash,
                      );
                      const tmpDir = path.join(os.homedir(), '.skill-hub', 'tmp', `skillssh-restore-${ref.slug}-${Date.now()}`);
                      for (const file of download.files) {
                        const filePath = path.join(tmpDir, file.path);
                        fs.mkdirSync(path.dirname(filePath), { recursive: true });
                        fs.writeFileSync(filePath, file.contents, 'utf-8');
                      }
                      await adapter.install(ext, pe.scope, tmpDir);
                      reg.add({
                        type: pe.type,
                        name: pe.name,
                        version: download.hash,
                        agent,
                        scope: pe.scope,
                        path: destPath,
                        source: pe.source,
                      });
                      try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
                      restored++;
                    } catch {
                      // skip failed skillssh restores
                    }
                  }
                  continue;
                }

                const ext = catalog.extensions.find(e => e.name === pe.name && e.type === pe.type);
                if (!ext || !ext.platforms[platformKey(agent)]) continue;
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
              console.log(chalk.green(`  Восстановлено ${restored} расширений из проектного конфига`));
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

          // Source-aware update for skills.sh
          if (record.source?.startsWith('skillssh:')) {
            const ref = parseSkillsshSource(record.source);
            if (!ref) continue;
            try {
              const download = await downloadSkillssh(ref.source, ref.slug);
              if (download.hash !== record.version) {
                spinner.text = `Обновление ${record.name} (skills.sh)...`;
                const ext = skillsshToExtension(
                  { id: ref.slug, name: ref.slug, description: '', source: ref.source, installs: 0 },
                  download.hash,
                );
                const tmpDir = path.join(os.homedir(), '.skill-hub', 'tmp', `skillssh-update-${ref.slug}-${Date.now()}`);
                for (const file of download.files) {
                  const filePath = path.join(tmpDir, file.path);
                  fs.mkdirSync(path.dirname(filePath), { recursive: true });
                  fs.writeFileSync(filePath, file.contents, 'utf-8');
                }
                await adapter.install(ext, record.scope, tmpDir);
                reg.add({ ...record, version: download.hash, path: adapter.getInstallPath(ext, record.scope) });
                try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
                updated++;
              }
            } catch {
              // skip failed skillssh updates silently
            }
            continue;
          }

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

        // Проверка настройки gitignoreAgentDirs
        if (!name) {
          const projectRoot = findProjectRoot();
          if (projectRoot && loadGitignoreAgentDirs(projectRoot)) {
            const missing = getMissingGitignoreEntries(projectRoot);
            if (missing.length > 0) {
              addAgentDirsToGitignore(projectRoot, missing);
              console.log(chalk.green(`✓ Добавлено в .gitignore: ${missing.join(', ')}`));
            }
          }
        }
      } catch (err) {
        spinner.fail(chalk.red(String(err)));
        process.exit(1);
      }
    });
}
