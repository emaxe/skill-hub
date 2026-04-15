import { Command } from 'commander';
import readline from 'readline';
import chalk from 'chalk';
import { loadConfig, saveConfig, resolveConfig, saveResolvedConfig, saveGlobalFromProject, resetProjectToGlobal, initProjectConfig, SkillHubConfig, loadProjectExtensions, findProjectRoot } from '../config';
import { fullCatalogReset } from '../git';

const ALLOWED_KEYS: Array<keyof SkillHubConfig> = ['agent', 'defaultScope', 'registryUrl', 'project'];

export function makeConfigCommand(): Command {
  const cmd = new Command('config')
    .description('Управление настройками skill-hub');

  cmd
    .command('list')
    .description('Вывести все настройки')
    .action(() => {
      const { config, source } = resolveConfig();
      const sourceLabel = source === 'project' ? '📁 проектные' : '🌐 глобальные';
      console.log(chalk.bold(`\nНастройки skill-hub (${sourceLabel}):\n`));
      for (const key of ALLOWED_KEYS) {
        console.log(`  ${chalk.cyan(key)}: ${config[key]}`);
      }
      console.log();
    });

  cmd
    .command('get')
    .description('Получить значение настройки')
    .argument('<key>', `Ключ: ${ALLOWED_KEYS.join(', ')}`)
    .action((key: string) => {
      if (!ALLOWED_KEYS.includes(key as keyof SkillHubConfig)) {
        console.error(chalk.red(`Неизвестный ключ: ${key}`));
        console.error(`Допустимые ключи: ${ALLOWED_KEYS.join(', ')}`);
        process.exit(1);
      }
      const { config } = resolveConfig();
      console.log(config[key as keyof SkillHubConfig]);
    });

  cmd
    .command('set')
    .description('Установить значение настройки')
    .argument('<key>', `Ключ: ${ALLOWED_KEYS.join(', ')}`)
    .argument('<value>', 'Новое значение')
    .option('-y, --yes', 'Пропустить подтверждение при смене registryUrl')
    .action(async (key: string, value: string, opts: { yes?: boolean }) => {
      if (!ALLOWED_KEYS.includes(key as keyof SkillHubConfig)) {
        console.error(chalk.red(`Неизвестный ключ: ${key}`));
        console.error(`Допустимые ключи: ${ALLOWED_KEYS.join(', ')}`);
        process.exit(1);
      }
      const { config, source, projectRoot } = resolveConfig();

      if (key === 'registryUrl') {
        const extensions = loadProjectExtensions();
        if (extensions.length > 0 && !opts.yes) {
          const projRoot = findProjectRoot() || process.cwd();
          console.log(chalk.yellow(`\n⚠  Смена каталога приведёт к очистке списка расширений в .skill-hub.json:`));
          console.log(chalk.yellow(`   • ${extensions.length} расширений в проекте ${projRoot}\n`));
          console.log(chalk.yellow(`   Файлы расширений на диске останутся без изменений.\n`));

          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          const answer = await new Promise<string>(resolve => {
            rl.question('   Продолжить? (y/N) ', answer => {
              rl.close();
              resolve(answer.trim().toLowerCase());
            });
          });

          if (answer !== 'y' && answer !== 'yes' && answer !== 'д' && answer !== 'да') {
            console.log(chalk.yellow('Отменено.'));
            process.exit(0);
          }
        }
      }

      (config as any)[key] = value;
      saveResolvedConfig(config, source, projectRoot);
      console.log(chalk.green(`${key} = ${value}`));

      if (key === 'registryUrl') {
        fullCatalogReset();
        console.log(chalk.yellow('Кэш сброшен. При следующем запуске каталог будет загружен из нового URL.'));
      }
    });

  cmd
    .command('save-as-global')
    .description('Сохранить проектные настройки как глобальные')
    .action(() => {
      if (saveGlobalFromProject()) {
        console.log(chalk.green('Проектные настройки сохранены как глобальные.'));
      } else {
        console.error(chalk.red('Не найден проектный конфиг (.skill-hub.json).'));
        process.exit(1);
      }
    });

  cmd
    .command('reset-to-global')
    .description('Сбросить проектные настройки на глобальные')
    .action(() => {
      if (resetProjectToGlobal()) {
        console.log(chalk.green('Проектные настройки сброшены на глобальные.'));
      } else {
        console.error(chalk.red('Не найден корень проекта.'));
        process.exit(1);
      }
    });

  cmd
    .command('init')
    .description('Создать проектный конфиг из глобального')
    .action(() => {
      if (initProjectConfig()) {
        console.log(chalk.green('Проектный конфиг создан (.skill-hub.json).'));
      } else {
        const { source } = resolveConfig();
        if (source === 'project') {
          console.log(chalk.yellow('Проектный конфиг уже существует.'));
        } else {
          console.error(chalk.red('Не найден корень проекта.'));
          process.exit(1);
        }
      }
    });

  return cmd;
}
