import { Command } from 'commander';
import chalk from 'chalk';
import { loadCatalog, searchExtensions, AgentName, ExtensionType } from '../catalog';
import { detectAgent } from '../detect-agent';
import { getCachePath, ensureCache } from '../git';
import { resolveProject } from '../config';
import { searchSkillsshWithMeta } from '../skillssh';

export function makeSearchCommand(): Command {
  return new Command('search')
    .description('Поиск расширений в каталоге')
    .argument('[query]', 'Поисковый запрос (имя, тег, описание)', '')
    .option('--agent <agent>', 'Агент: claude-code, cursor, copilot, codex')
    .option('--type <type>', 'Тип: skill, agent, command')
    .option('--limit <n>', 'Максимум результатов на страницу', '10')
    .option('--offset <n>', 'Пропустить первые N результатов', '0')
    .option('--project <project>', 'Фильтр по проекту')
    .option('--source <source>', 'Источник: catalog (default), skillssh')
    .action(async (query: string, opts: { agent?: string; type?: string; limit?: string; offset?: string; project?: string; source?: string }) => {
      if (opts.source === 'skillssh') {
        const limit = Math.max(1, parseInt(opts.limit || '10', 10) || 10);
        const offset = Math.max(0, parseInt(opts.offset || '0', 10) || 0);
        const { skills, count } = await searchSkillsshWithMeta(query, limit + offset);
        const total = count;
        const page = skills.slice(offset, offset + limit);

        if (total === 0) {
          console.log(chalk.yellow('Скиллы не найдены на skills.sh'));
          return;
        }
        console.log(chalk.bold(`\nНайдено ${total} скиллов на skills.sh:\n`));
        for (const skill of page) {
          console.log(`  ${chalk.green('[skill]')} ${chalk.bold(skill.id)}  ${chalk.dim(skill.source || '')}  ${skill.installs ? chalk.yellow(`${skill.installs} installs`) : ''}`);
          console.log(`    ${skill.description || 'нет описания'}`);
          console.log();
        }
        if (total > limit) {
          console.log(chalk.dim(`Показано ${page.length} из ${total} (offset=${offset}, limit=${limit})`));
        }
        return;
      }

      await ensureCache();
      const catalog = loadCatalog(getCachePath());
      const agent = (opts.agent || detectAgent()) as AgentName;
      const rp = resolveProject();
      const project = opts.project ?? rp.project;
      const allResults = searchExtensions(catalog, query, agent, opts.type as ExtensionType, project);
      const total = allResults.length;
      const limit = Math.max(1, parseInt(opts.limit || '10', 10) || 10);
      const offset = Math.max(0, parseInt(opts.offset || '0', 10) || 0);
      const results = allResults.slice(offset, offset + limit);

      if (total === 0) {
        console.log(chalk.yellow('Расширения не найдены'));
        return;
      }

      console.log(chalk.bold(`\nНайдено ${total} расширений для ${agent}:\n`));
      for (const ext of results) {
        const typeLabel = ext.type === 'agent' ? chalk.blue('[agent]')
          : ext.type === 'command' ? chalk.magenta('[cmd]') : chalk.green('[skill]');
        console.log(`  ${typeLabel} ${chalk.bold(ext.name)}  v${ext.version || '?'}`);
        console.log(`    ${ext.description}`);
        if (ext.tags.length) console.log(`    ${chalk.dim(ext.tags.join(', '))}`);
        console.log();
      }
      if (total > limit) {
        console.log(chalk.dim(`Показано ${results.length} из ${total} (offset=${offset}, limit=${limit})`));
      }
    });
}
