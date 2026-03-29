import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, saveConfig, SkillHubConfig } from '../config';
import { resetCache } from '../git';

const ALLOWED_KEYS: Array<keyof SkillHubConfig> = ['agent', 'defaultScope', 'registryUrl'];

export function makeConfigCommand(): Command {
  const cmd = new Command('config')
    .description('Управление настройками skill-hub');

  cmd
    .command('list')
    .description('Вывести все настройки')
    .action(() => {
      const config = loadConfig();
      console.log(chalk.bold('\nНастройки skill-hub:\n'));
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
      const config = loadConfig();
      console.log(config[key as keyof SkillHubConfig]);
    });

  cmd
    .command('set')
    .description('Установить значение настройки')
    .argument('<key>', `Ключ: ${ALLOWED_KEYS.join(', ')}`)
    .argument('<value>', 'Новое значение')
    .action((key: string, value: string) => {
      if (!ALLOWED_KEYS.includes(key as keyof SkillHubConfig)) {
        console.error(chalk.red(`Неизвестный ключ: ${key}`));
        console.error(`Допустимые ключи: ${ALLOWED_KEYS.join(', ')}`);
        process.exit(1);
      }
      const config = loadConfig();
      (config as any)[key] = value;
      saveConfig(config);
      console.log(chalk.green(`${key} = ${value}`));

      if (key === 'registryUrl') {
        resetCache();
        console.log(chalk.yellow('Кэш сброшен. При следующем запуске каталог будет загружен из нового URL.'));
      }
    });

  return cmd;
}
