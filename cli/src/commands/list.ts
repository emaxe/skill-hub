import { Command } from 'commander';
import chalk from 'chalk';
import os from 'os';
import path from 'path';
import { AgentName, ExtensionType } from '../catalog';
import { detectAgent } from '../detect-agent';
import { createRegistry } from '../registry';
import { ClaudeCodeAdapter } from '../adapters/claude-code';
import { CursorAdapter } from '../adapters/cursor';
import { CopilotAdapter } from '../adapters/copilot';
import { AgentAdapter } from '../adapters/types';

interface ListEntry {
  type: ExtensionType;
  name: string;
  version: string;
  scope: 'global' | 'project';
  source: 'registry' | 'filesystem';
}

function getAdapter(agent: AgentName): AgentAdapter {
  if (agent === 'cursor') return new CursorAdapter();
  if (agent === 'copilot') return new CopilotAdapter();
  return new ClaudeCodeAdapter();
}

export function makeListCommand(): Command {
  return new Command('list')
    .description('Список установленных расширений')
    .option('--agent <agent>', 'Агент: claude-code, cursor, copilot')
    .option('--type <type>', 'Тип: skill, agent, command')
    .action((opts: { agent?: string; type?: string }) => {
      const agent = (opts.agent || detectAgent()) as AgentName;
      const reg = createRegistry(path.join(os.homedir(), '.skill-hub'));
      const registryItems = reg.list(agent, opts.type as ExtensionType);

      const map = new Map<string, ListEntry>();

      for (const r of registryItems) {
        map.set(`${r.name}:${r.type}:${r.scope}`, {
          type: r.type, name: r.name, version: r.version, scope: r.scope, source: 'registry',
        });
      }

      try {
        const adapter = getAdapter(agent);
        for (const s of adapter.scanInstalled()) {
          if (opts.type && s.type !== opts.type) continue;
          const key = `${s.name}:${s.type}:${s.scope}`;
          if (!map.has(key)) {
            map.set(key, { type: s.type, name: s.name, version: '?', scope: s.scope, source: 'filesystem' });
          }
        }
      } catch { /* scan failure is silent — registry data is still shown */ }

      const entries = [...map.values()];

      if (entries.length === 0) {
        console.log(chalk.yellow(`Нет установленных расширений для ${agent}`));
        return;
      }

      console.log(chalk.bold(`\nУстановленные расширения (${agent}):\n`));
      for (const r of entries) {
        const typeLabel = r.type === 'agent' ? chalk.blue('[agent]')
          : r.type === 'command' ? chalk.magenta('[cmd]') : chalk.green('[skill]');
        const sourceTag = r.source === 'filesystem'
          ? ` ${chalk.dim('[manual]')}`
          : ` ${chalk.dim('[skill-hub]')}`;
        console.log(`  ${typeLabel} ${chalk.bold(r.name)}  v${r.version}  ${chalk.dim(r.scope)}${sourceTag}`);
      }
      console.log();
    });
}
