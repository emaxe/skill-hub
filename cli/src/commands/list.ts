import { Command } from 'commander';
import chalk from 'chalk';
import os from 'os';
import path from 'path';
import { AgentName, ExtensionType } from '../catalog';
import { detectAgent } from '../detect-agent';
import { createRegistry } from '../registry';

export function makeListCommand(): Command {
  return new Command('list')
    .description('Список установленных расширений')
    .option('--agent <agent>', 'Агент: claude-code, cursor, copilot')
    .option('--type <type>', 'Тип: skill, agent, command')
    .action((opts: { agent?: string; type?: string }) => {
      const agent = (opts.agent || detectAgent()) as AgentName;
      const reg = createRegistry(path.join(os.homedir(), '.skill-hub'));
      const installed = reg.list(agent, opts.type as ExtensionType);

      if (installed.length === 0) {
        console.log(chalk.yellow(`Нет установленных расширений для ${agent}`));
        return;
      }

      console.log(chalk.bold(`\nУстановленные расширения (${agent}):\n`));
      for (const r of installed) {
        const typeLabel = r.type === 'agent' ? chalk.blue('[agent]')
          : r.type === 'command' ? chalk.magenta('[cmd]') : chalk.green('[skill]');
        console.log(`  ${typeLabel} ${chalk.bold(r.name)}  v${r.version}  ${chalk.dim(r.scope)}`);
      }
      console.log();
    });
}
