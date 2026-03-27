import { Command } from 'commander';
import chalk from 'chalk';
import { loadCatalog, searchExtensions, AgentName, ExtensionType } from '../catalog';
import { detectAgent } from '../detect-agent';
import { getCachePath, ensureCache } from '../git';

export function makeSearchCommand(): Command {
  return new Command('search')
    .description('Поиск расширений в каталоге')
    .argument('[query]', 'Поисковый запрос (имя, тег, описание)', '')
    .option('--agent <agent>', 'Агент: claude-code, cursor, copilot')
    .option('--type <type>', 'Тип: skill, agent, command')
    .action(async (query: string, opts: { agent?: string; type?: string }) => {
      await ensureCache();
      const catalog = loadCatalog(getCachePath());
      const agent = (opts.agent || detectAgent()) as AgentName;
      const results = searchExtensions(catalog, query, agent, opts.type as ExtensionType);

      if (results.length === 0) {
        console.log(chalk.yellow('Расширения не найдены'));
        return;
      }

      console.log(chalk.bold(`\nНайдено ${results.length} расширений для ${agent}:\n`));
      for (const ext of results) {
        const typeLabel = ext.type === 'agent' ? chalk.blue('[agent]')
          : ext.type === 'command' ? chalk.magenta('[cmd]') : chalk.green('[skill]');
        console.log(`  ${typeLabel} ${chalk.bold(ext.name)}  v${ext.version || '?'}`);
        console.log(`    ${ext.description}`);
        if (ext.tags.length) console.log(`    ${chalk.dim(ext.tags.join(', '))}`);
        console.log();
      }
    });
}
