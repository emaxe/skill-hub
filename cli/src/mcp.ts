import os from 'os';
import path from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadCatalog, searchExtensions, filterByAgent, filterByProject, scoreExtensions, platformKey, AgentName, ExtensionType } from './catalog';
import { detectAgent } from './detect-agent';
import { getCachePath, ensureCache } from './git';
import { createRegistry } from './registry';
import { getAdapter } from './adapters/get-adapter';
import { filterRecordsByDirectory } from './path-filter';
import { hasProjectConfig, addProjectExtension, removeProjectExtension, resolveProject, resolveConfig } from './config';

// MCP-сервер skill-hub — предоставляет 7 инструментов для AI-агентов через stdio транспорт.
// Инструменты: search, install, remove, move, list, suggest, get_info.

// Безопасное приведение к string (unknown → string | undefined)
function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

// --- Запуск сервера ---
export async function startMcpServer(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const server: any = new Server(
    { name: 'skill-hub', version: '0.1.18' },
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
              agent: { type: 'string', enum: ['claude-code', 'cursor', 'copilot', 'codex', 'agents-conventions'], description: 'Фильтр по агенту' },
              type: { type: 'string', enum: ['skill', 'agent', 'command'], description: 'Фильтр по типу' },
              limit: { type: 'number', description: 'Макс. количество результатов (по умолчанию 10)' },
              offset: { type: 'number', description: 'Пропустить первые N результатов (по умолчанию 0)' },
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
              agent: { type: 'string', enum: ['claude-code', 'cursor', 'copilot', 'codex', 'agents-conventions'], description: 'Агент' },
              scope: { type: 'string', enum: ['global', 'project'], description: 'Область установки (по умолчанию: project)' },
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
              agent: { type: 'string', enum: ['claude-code', 'cursor', 'copilot', 'codex', 'agents-conventions'], description: 'Агент' },
              scope: { type: 'string', enum: ['global', 'project'], description: 'Область установки (по умолчанию: project)' },
              delete_from_disk: { type: 'boolean', description: 'Удалить файлы с диска (по умолчанию: true). false = только из реестра' },
            },
            required: ['name'],
          },
        },
        {
          name: 'move_extension',
          description: 'Перенести расширение между scope (global ↔ project)',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Имя расширения (или type:name)' },
              agent: { type: 'string', enum: ['claude-code', 'cursor', 'copilot', 'codex', 'agents-conventions'], description: 'Агент' },
              to: { type: 'string', enum: ['global', 'project'], description: 'Целевой scope' },
            },
            required: ['name', 'to'],
          },
        },
        {
          name: 'list_extensions',
          description: 'Список установленных расширений',
          inputSchema: {
            type: 'object',
            properties: {
              agent: { type: 'string', enum: ['claude-code', 'cursor', 'copilot', 'codex', 'agents-conventions'], description: 'Фильтр по агенту' },
              type: { type: 'string', enum: ['skill', 'agent', 'command'], description: 'Фильтр по типу' },
              limit: { type: 'number', description: 'Макс. количество результатов (по умолчанию 10)' },
              offset: { type: 'number', description: 'Пропустить первые N результатов (по умолчанию 0)' },
            },
          },
        },
        {
          name: 'suggest_extensions',
          description: 'Порекомендовать расширения для проекта на основе его контекста. Агент сам читает package.json, README.md (первые 50 строк), список файлов корня и CLAUDE.md/.cursorrules (если есть), затем передаёт как context.',
          inputSchema: {
            type: 'object',
            properties: {
              context: {
                type: 'string',
                description: 'Контекст проекта: содержимое package.json, первые строки README, список файлов — всё в одной строке',
              },
              agent: {
                type: 'string',
                enum: ['claude-code', 'cursor', 'copilot', 'codex', 'agents-conventions'],
                description: 'Фильтр по агенту (по умолчанию: автодетект)',
              },
              limit: {
                type: 'number',
                description: 'Максимум рекомендаций (по умолчанию: 5)',
              },
            },
            required: ['context'],
          },
        },
        {
          name: 'get_extension_info',
          description: 'Получить полную информацию о расширении, включая статус установки',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Имя расширения (или type:name, например skill:git-helper)',
              },
              agent: {
                type: 'string',
                enum: ['claude-code', 'cursor', 'copilot', 'codex', 'agents-conventions'],
                description: 'Агент для проверки статуса установки (по умолчанию: автодетект)',
              },
            },
            required: ['name'],
          },
        },
      ],
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    const { name, arguments: args = {} } = request.params;
    const a = args as Record<string, unknown>;

    // --- search_extensions ---
    if (name === 'search_extensions') {
      try {
        await ensureCache();
        const cachePath = getCachePath();
        const catalog = loadCatalog(cachePath);
        // Определяем project: из аргументов MCP или из конфига
        const rp = resolveProject();
        const projectFilter = str(a.project) ?? rp.project;
        const allResults = searchExtensions(
          catalog,
          str(a.query) || '',
          str(a.agent) as AgentName | undefined,
          str(a.type) as ExtensionType | undefined,
          projectFilter
        );
        const total = allResults.length;
        const limit = typeof a.limit === 'number' && a.limit > 0 ? a.limit : 10;
        const offset = typeof a.offset === 'number' && a.offset >= 0 ? a.offset : 0;
        const results = allResults.slice(offset, offset + limit);
        return {
          content: [{ type: 'text', text: JSON.stringify({ results, total, limit, offset }, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${String(err)}` }],
          isError: true,
        };
      }
    }

    // --- install_extension ---
    if (name === 'install_extension') {
      try {
        await ensureCache();
        const cachePath = getCachePath();
        const catalog = loadCatalog(cachePath);
        const agent = (str(a.agent) || detectAgent()) as AgentName;
        const scope = (str(a.scope) === 'global' ? 'global' : 'project') as 'global' | 'project';
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

        // agents-conventions работает только в project scope (нет глобальной директории)
        if (agent === 'agents-conventions' && scope === 'global') {
          return {
            content: [{ type: 'text', text: 'agents-conventions поддерживает только project scope' }],
            isError: true,
          };
        }

        const adapter = getAdapter(agent);
        if (!ext.platforms[platformKey(agent)]) {
          return {
            content: [{ type: 'text', text: `Расширение "${ext.name}" не поддерживает агента ${agent}` }],
            isError: true,
          };
        }

        const reg = createRegistry(path.join(os.homedir(), '.skill-hub'));

        // Разрешение зависимостей: ищем каждую в каталоге и устанавливаем до основного расширения
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
              projects: depExt.projects.length > 0 ? depExt.projects : undefined,
              tags: depExt.tags.length > 0 ? depExt.tags : undefined,
            });
          }
        }

        await adapter.install(ext, scope, cachePath);
        reg.add({
          type: ext.type, name: ext.name,
          version: ext.version || '0.0.0',
          agent, scope,
          path: adapter.getInstallPath(ext, scope),
          projects: ext.projects.length > 0 ? ext.projects : undefined,
          tags: ext.tags.length > 0 ? ext.tags : undefined,
        });

        if (hasProjectConfig()) {
          for (const dep of ext.dependencies) {
            let depType: ExtensionType | undefined;
            let depName = dep;
            if (dep.includes(':')) {
              const parts = dep.split(':');
              depType = parts[0] as ExtensionType;
              depName = parts[1];
            }
            const depExt = catalog.extensions.find(e => e.name === depName && (!depType || e.type === depType));
            if (depExt) {
              addProjectExtension({ type: depExt.type, name: depExt.name, version: depExt.version, scope });
            }
          }
          addProjectExtension({ type: ext.type, name: ext.name, version: ext.version, scope });
        }

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

    // --- remove_extension ---
    if (name === 'remove_extension') {
      try {
        const agent = (str(a.agent) || detectAgent()) as AgentName;
        const scope = (str(a.scope) === 'global' ? 'global' : 'project') as 'global' | 'project';
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

        const deleteFromDisk = a.delete_from_disk !== false;

        if (deleteFromDisk) {
          const adapter = getAdapter(agent);
          await adapter.remove(ext, scope);
        }

        const reg = createRegistry(path.join(os.homedir(), '.skill-hub'));
        reg.remove(ext.name, ext.type, agent);

        if (hasProjectConfig()) {
          removeProjectExtension(ext.name, ext.type);
        }

        const suffix = deleteFromDisk ? '' : ' (файлы сохранены)';
        return {
          content: [{ type: 'text', text: `Удалён ${ext.type}:${ext.name} (${agent})${suffix}` }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Ошибка удаления: ${String(err)}` }],
          isError: true,
        };
      }
    }

    // --- move_extension ---
    if (name === 'move_extension') {
      try {
        await ensureCache();
        const cachePath = getCachePath();
        const catalog = loadCatalog(cachePath);
        const agent = (str(a.agent) || detectAgent()) as AgentName;
        const to = str(a.to) as 'global' | 'project';
        if (to !== 'global' && to !== 'project') {
          return {
            content: [{ type: 'text', text: 'Параметр "to" обязателен: "global" или "project"' }],
            isError: true,
          };
        }
        const from: 'global' | 'project' = to === 'global' ? 'project' : 'global';
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

        if (agent === 'agents-conventions' && to === 'global') {
          return {
            content: [{ type: 'text', text: 'agents-conventions поддерживает только project scope' }],
            isError: true,
          };
        }

        const adapter = getAdapter(agent);
        if (!ext.platforms[platformKey(agent)]) {
          return {
            content: [{ type: 'text', text: `Расширение "${ext.name}" не поддерживает агента ${agent}` }],
            isError: true,
          };
        }
        if (!adapter.isInstalled(ext, from)) {
          return {
            content: [{ type: 'text', text: `Расширение "${ext.name}" не установлено в scope "${from}"` }],
            isError: true,
          };
        }

        const reg = createRegistry(path.join(os.homedir(), '.skill-hub'));
        await adapter.install(ext, to, cachePath);
        await adapter.remove(ext, from);
        reg.add({
          type: ext.type, name: ext.name,
          version: ext.version || '0.0.0',
          agent, scope: to,
          path: adapter.getInstallPath(ext, to),
        });

        if (hasProjectConfig()) {
          addProjectExtension({ type: ext.type, name: ext.name, version: ext.version, scope: to });
        }

        return {
          content: [{ type: 'text', text: `Перенесён ${ext.type}:${ext.name} из ${from} в ${to} (${agent})` }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Ошибка переноса: ${String(err)}` }],
          isError: true,
        };
      }
    }

    // --- list_extensions ---
    if (name === 'list_extensions') {
      try {
        const agent = (str(a.agent) || detectAgent()) as AgentName;
        const typeFilter = str(a.type) as ExtensionType | undefined;
        const reg = createRegistry(path.join(os.homedir(), '.skill-hub'));
        const registryItems = reg.list(agent, typeFilter);

        const cwd = process.cwd();
        const homeDir = os.homedir();
        const filtered = filterRecordsByDirectory(registryItems, cwd, homeDir);

        interface ListEntry {
          type: ExtensionType;
          name: string;
          version: string;
          scope: 'global' | 'project' | 'parent';
          effectiveScope: string;
          source: 'skill-hub' | 'manual';
        }

        // Объединяем реестр и файловую систему; дедупликация по name:scope
        const map = new Map<string, ListEntry>();
        for (const { record: r, effectiveScope } of filtered) {
          map.set(`${r.name}:${r.scope}`, {
            type: r.type, name: r.name, version: r.version, scope: r.scope, effectiveScope, source: 'skill-hub',
          });
        }

        try {
          const adapter = getAdapter(agent);
          for (const s of adapter.scanInstalled()) {
            if (typeFilter && s.type !== typeFilter) continue;
            const key = `${s.name}:${s.scope}`;
            if (!map.has(key)) {
              map.set(key, { type: s.type, name: s.name, version: '?', scope: s.scope, effectiveScope: s.scope, source: 'manual' });
            }
          }
        } catch { /* scan failure is silent — registry data is still shown */ }

        const allEntries = [...map.values()];
        const total = allEntries.length;
        const limit = typeof a.limit === 'number' && a.limit > 0 ? a.limit : 10;
        const offset = typeof a.offset === 'number' && a.offset >= 0 ? a.offset : 0;
        const entries = allEntries.slice(offset, offset + limit);
        return {
          content: [{ type: 'text', text: JSON.stringify({ results: entries, total, limit, offset }, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${String(err)}` }],
          isError: true,
        };
      }
    }

    // --- suggest_extensions ---
    if (name === 'suggest_extensions') {
      try {
        await ensureCache();
        const cachePath = getCachePath();
        const catalog = loadCatalog(cachePath);
        const agent = (str(a.agent) || detectAgent()) as AgentName;
        const limit = typeof a.limit === 'number' && a.limit > 0 ? a.limit : 5;
        const context = str(a.context) || '';

        const agentExtensions = filterByAgent(catalog.extensions, agent);
        // Фильтрация по проекту
        const rp = resolveProject();
        const projectFiltered = filterByProject(agentExtensions, rp.project);

        const reg = createRegistry(path.join(os.homedir(), '.skill-hub'));
        const cwd = process.cwd();
        const homeDir = os.homedir();
        const filteredInstalled = filterRecordsByDirectory(reg.list(agent), cwd, homeDir);
        const installedNames = new Set(filteredInstalled.map(({ record }) => record.name));
        const notInstalled = projectFiltered.filter(ext => !installedNames.has(ext.name));

        // Ранжирование по контексту: scoreExtensions сопоставляет теги/описания с содержимым проекта
        const scored = scoreExtensions(notInstalled, context);
        const top = scored.slice(0, limit);

        const suggestions = top.map(s => ({
          type: s.extension.type,
          name: s.extension.name,
          description: s.extension.description,
          tags: s.extension.tags,
          scope: s.extension.scope,
          version: s.extension.version || '?',
          score: s.score,
          matchReasons: s.matchReasons,
        }));

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              suggestions,
              total_candidates: notInstalled.length,
              agent,
              note: 'Чтобы установить все: вызови install_extension для каждого name из suggestions со scope: "project"',
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${String(err)}` }],
          isError: true,
        };
      }
    }

    // --- get_extension_info ---
    if (name === 'get_extension_info') {
      try {
        await ensureCache();
        const cachePath = getCachePath();
        const catalog = loadCatalog(cachePath);
        const agent = (str(a.agent) || detectAgent()) as AgentName;
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

        const reg = createRegistry(path.join(os.homedir(), '.skill-hub'));
        const cwd = process.cwd();
        const homeDir = os.homedir();
        const allRecords = reg.list(agent);
        const filteredRecords = filterRecordsByDirectory(allRecords, cwd, homeDir);
        const match = filteredRecords.find(({ record: r }) => r.name === ext.name && r.type === ext.type);
        const installed = !!match;
        const record = match?.record;

        const result = {
          type: ext.type,
          name: ext.name,
          description: ext.description,
          tags: ext.tags,
          author: ext.author || null,
          version: ext.version || '?',
          scope: ext.scope,
          platforms: ext.platforms,
          dependencies: ext.dependencies,
          files: ext.files || [],
          installed,
          installed_scope: record?.scope || null,
          effectiveScope: match?.effectiveScope || null,
          installed_at: record?.installed_at || null,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
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
