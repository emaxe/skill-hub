import { Command } from 'commander';
import chalk from 'chalk';
import { loadCatalog, AgentName, ExtensionType } from '../catalog';
import { detectAgent } from '../detect-agent';
import { getCachePath, ensureCache } from '../git';

export function makeInfoCommand(): Command {
  return new Command('info')
    .description('Информация о расширении')
    .argument('<name>', 'Имя расширения (или type:name)')
    .option('--agent <agent>', 'Агент: claude-code, cursor, copilot')
    .action(async (nameArg: string, opts: { agent?: string }) => {
      await ensureCache();
      const catalog = loadCatalog(getCachePath());
      const agent = (opts.agent || detectAgent()) as AgentName;

      let type: ExtensionType | undefined;
      let name = nameArg;
      if (nameArg.includes(':')) {
        [type, name] = nameArg.split(':') as [ExtensionType, string];
      }

      const ext = catalog.extensions.find(e =>
        e.name === name && (!type || e.type === type)
      );

      if (!ext) {
        console.error(chalk.red(`Расширение "${nameArg}" не найдено`));
        process.exit(1);
      }

      console.log(chalk.bold(`\n${ext.type}: ${ext.name}`) + `  v${ext.version || '?'}`);
      console.log(ext.description);
      console.log();
      console.log(`  Автор:    ${ext.author || '—'}`);
      console.log(`  Scope:    ${ext.scope}`);
      console.log(`  Теги:     ${ext.tags.join(', ') || '—'}`);
      console.log();
      console.log('  Поддерживаемые агенты:');
      for (const [ag, file] of Object.entries(ext.platforms)) {
        if (file) {
          const current = ag === agent ? chalk.green(' ← текущий') : '';
          console.log(`    ${ag}: ${file}${current}`);
        }
      }
      if (ext.dependencies.length) {
        console.log(`\n  Зависимости: ${ext.dependencies.join(', ')}`);
      }
      console.log();
    });
}
