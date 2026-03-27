import os from 'os';
import path from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadCatalog, searchExtensions, AgentName, ExtensionType } from './catalog';
import { detectAgent } from './detect-agent';
import { getCachePath, ensureCache } from './git';
import { createRegistry } from './registry';
import { ClaudeCodeAdapter } from './adapters/claude-code';
import { CursorAdapter } from './adapters/cursor';
import { CopilotAdapter } from './adapters/copilot';
import { AgentAdapter } from './adapters/types';

function getAdapter(agent: AgentName): AgentAdapter {
  if (agent === 'cursor') return new CursorAdapter();
  if (agent === 'copilot') return new CopilotAdapter();
  return new ClaudeCodeAdapter();
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    { name: 'skill-hub', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'search_extensions',
          description: 'Поиск расширений в каталоге skill-hub',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Поисковый запрос (имя, описание, тег)' },
              agent: { type: 'string', enum: ['claude-code', 'cursor', 'copilot'], description: 'Фильтр по агенту' },
              type: { type: 'string', enum: ['skill', 'agent', 'command'], description: 'Фильтр по типу' },
            },
          },
        },
        {
          name: 'install_extension',
          description: 'Установить расширение из каталога skill-hub',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Имя расширения (или type:name, например skill:git-helper)' },
              agent: { type: 'string', enum: ['claude-code', 'cursor', 'copilot'], description: 'Агент' },
              scope: { type: 'string', enum: ['global', 'project'], description: 'Область установки (по умолчанию: global)' },
            },
            required: ['name'],
          },
        },
        {
          name: 'remove_extension',
          description: 'Удалить установленное расширение',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Имя расширения (или type:name)' },
              agent: { type: 'string', enum: ['claude-code', 'cursor', 'copilot'], description: 'Агент' },
              scope: { type: 'string', enum: ['global', 'project'], description: 'Область установки (по умолчанию: global)' },
            },
            required: ['name'],
          },
        },
        {
          name: 'list_extensions',
          description: 'Список установленных расширений',
          inputSchema: {
            type: 'object',
            properties: {
              agent: { type: 'string', enum: ['claude-code', 'cursor', 'copilot'], description: 'Фильтр по агенту' },
              type: { type: 'string', enum: ['skill', 'agent', 'command'], description: 'Фильтр по типу' },
            },
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const a = args as Record<string, unknown>;

    if (name === 'search_extensions') {
      try {
        await ensureCache();
        const cachePath = getCachePath();
        const catalog = loadCatalog(cachePath);
        const results = searchExtensions(
          catalog,
          str(a.query) || '',
          str(a.agent) as AgentName | undefined,
          str(a.type) as ExtensionType | undefined
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${String(err)}` }],
          isError: true,
        };
      }
    }

    if (name === 'install_extension') {
      try {
        await ensureCache();
        const cachePath = getCachePath();
        const catalog = loadCatalog(cachePath);
        const agent = (str(a.agent) || detectAgent()) as AgentName;
        const scope = (str(a.scope) === 'project' ? 'project' : 'global') as 'global' | 'project';
        const nameArg = str(a.name) || '';

        let type: ExtensionType | undefined;
        let extName = nameArg;
        if (nameArg.includes(':')) {
          const parts = nameArg.split(':');
          type = parts[0] as ExtensionType;
          extName = parts[1];
        }

        const ext = catalog.extensions.find(e => e.name === extName && (!type || e.type === type));
        if (!ext) {
          return {
            content: [{ type: 'text', text: `Расширение "${nameArg}" не найдено в каталоге` }],
            isError: true,
          };
        }

        const adapter = getAdapter(agent);
        if (!ext.platforms[adapter.agentName]) {
          return {
            content: [{ type: 'text', text: `Расширение "${ext.name}" не поддерживает агента ${adapter.agentName}` }],
            isError: true,
          };
        }

        const reg = createRegistry(path.join(os.homedir(), '.skill-hub'));

        for (const dep of ext.dependencies) {
          let depType: ExtensionType | undefined;
          let depName = dep;
          if (dep.includes(':')) {
            const parts = dep.split(':');
            depType = parts[0] as ExtensionType;
            depName = parts[1];
          }
          const depExt = catalog.extensions.find(e => e.name === depName && (!depType || e.type === depType));
          if (depExt && !reg.isInstalled(depExt.name, depExt.type, agent)) {
            await adapter.install(depExt, scope, cachePath);
            reg.add({
              type: depExt.type, name: depExt.name,
              version: depExt.version || '0.0.0',
              agent, scope,
              path: adapter.getInstallPath(depExt, scope),
            });
          }
        }

        await adapter.install(ext, scope, cachePath);
        reg.add({
          type: ext.type, name: ext.name,
          version: ext.version || '0.0.0',
          agent, scope,
          path: adapter.getInstallPath(ext, scope),
        });

        return {
          content: [{ type: 'text', text: `Установлен ${ext.type}:${ext.name} v${ext.version || '?'} (${agent}, ${scope})` }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Ошибка установки: ${String(err)}` }],
          isError: true,
        };
      }
    }

    if (name === 'remove_extension') {
      try {
        const agent = (str(a.agent) || detectAgent()) as AgentName;
        const scope = (str(a.scope) === 'project' ? 'project' : 'global') as 'global' | 'project';
        const nameArg = str(a.name) || '';

        let type: ExtensionType | undefined;
        let extName = nameArg;
        if (nameArg.includes(':')) {
          const parts = nameArg.split(':');
          type = parts[0] as ExtensionType;
          extName = parts[1];
        }

        const cachePath = getCachePath();
        const catalog = loadCatalog(cachePath);
        const ext = catalog.extensions.find(e => e.name === extName && (!type || e.type === type));
        if (!ext) {
          return {
            content: [{ type: 'text', text: `Расширение не найдено: ${nameArg}` }],
            isError: true,
          };
        }

        const adapter = getAdapter(agent);
        await adapter.remove(ext, scope);

        const reg = createRegistry(path.join(os.homedir(), '.skill-hub'));
        reg.remove(ext.name, ext.type, agent);

        return {
          content: [{ type: 'text', text: `Удалён ${ext.type}:${ext.name} (${agent})` }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Ошибка удаления: ${String(err)}` }],
          isError: true,
        };
      }
    }

    if (name === 'list_extensions') {
      try {
        const reg = createRegistry(path.join(os.homedir(), '.skill-hub'));
        const items = reg.list(
          str(a.agent) as AgentName | undefined,
          str(a.type) as ExtensionType | undefined
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(items, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${String(err)}` }],
          isError: true,
        };
      }
    }

    return {
      content: [{ type: 'text', text: `Неизвестный инструмент: ${name}` }],
      isError: true,
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
