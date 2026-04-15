import { Command } from 'commander';
import chalk from 'chalk';
import os from 'os';
import path from 'path';
import { AgentName, ExtensionType } from '../catalog';
import { detectAgent } from '../detect-agent';
import { createRegistry } from '../registry';
import { getAdapter } from '../adapters/get-adapter';
import { EffectiveScope, filterRecordsByDirectory } from '../path-filter';

interface ListEntry {
  type: ExtensionType;
  name: string;
  version: string;
  scope: 'global' | 'project' | 'parent';
  effectiveScope: EffectiveScope;
  source: 'registry' | 'filesystem';
}

export function makeListCommand(): Command {
  return new Command('list')
    .description('Список установленных расширений')
    .option('--agent <agent>', 'Агент: claude-code, cursor, copilot, codex')
    .option('--type <type>', 'Тип: skill, agent, command')
    .option('--limit <n>', 'Максимум результатов на страницу', '10')
    .option('--offset <n>', 'Пропустить первые N результатов', '0')
    .action((opts: { agent?: string; type?: string; limit?: string; offset?: string }) => {
      const agent = (opts.agent || detectAgent()) as AgentName;
      const reg = createRegistry(path.join(os.homedir(), '.skill-hub'));
      const registryItems = reg.list(agent, opts.type as ExtensionType);

      const cwd = process.cwd();
      const homeDir = os.homedir();
      const filtered = filterRecordsByDirectory(registryItems, cwd, homeDir);

      const map = new Map<string, ListEntry>();

      for (const { record: r, effectiveScope } of filtered) {
        map.set(`${r.name}:${r.scope}`, {
          type: r.type, name: r.name, version: r.version, scope: r.scope, effectiveScope, source: 'registry',
        });
      }

      try {
        const adapter = getAdapter(agent);
        for (const s of adapter.scanInstalled()) {
          if (opts.type && s.type !== opts.type) continue;
          const key = `${s.name}:${s.scope}`;
          if (!map.has(key)) {
            map.set(key, { type: s.type, name: s.name, version: '?', scope: s.scope, effectiveScope: s.scope, source: 'filesystem' });
          }
        }
      } catch { /* scan failure is silent — registry data is still shown */ }

      const allEntries = [...map.values()];
      const total = allEntries.length;
      const limit = Math.max(1, parseInt(opts.limit || '10', 10) || 10);
      const offset = Math.max(0, parseInt(opts.offset || '0', 10) || 0);
      const entries = allEntries.slice(offset, offset + limit);

      if (total === 0) {
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
        const scopeColor = r.effectiveScope === 'global' ? chalk.green
          : r.effectiveScope === 'parent' ? chalk.cyan
          : chalk.yellow;
        console.log(`  ${typeLabel} ${chalk.bold(r.name)}  v${r.version}  ${scopeColor(r.effectiveScope)}${sourceTag}`);
      }
      console.log();
      if (total > limit) {
        console.log(chalk.dim(`Показано ${entries.length} из ${total} (offset=${offset}, limit=${limit})`));
      }
    });
}
