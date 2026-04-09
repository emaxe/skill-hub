# skill-hub

Менеджер расширений для AI coding-агентов — **Claude Code**, **Cursor**, **Copilot**.

Единый CLI и MCP-сервер для поиска, установки и управления переиспользуемыми расширениями: **skills**, **agents** и **commands**.

## Установка

```bash
npm install -g @emaxe/skill-hub
```

## Поддерживаемые агенты

| Агент | Автодетект | MCP-конфиг |
|-------|-----------|------------|
| **Claude Code** | по умолчанию | `~/.claude/claude_desktop_config.json` |
| **Cursor** | `CURSOR_TRACE` / `.cursor/` | `~/.cursor/mcp.json` |
| **Copilot** | `GITHUB_COPILOT` | `~/.copilot/mcp-config.json` |

Агент определяется автоматически или задаётся через конфиг: `skill-hub config set agent cursor`.

## Быстрый старт

```bash
# Настроить MCP-сервер (claude-code | cursor | copilot)
skill-hub setup-mcp --agent claude-code

# Поиск расширений
skill-hub search "тестирование"

# Установить расширение
skill-hub install skill:feature-planning

# Список установленных
skill-hub list
```

## CLI-команды

| Команда | Описание |
|---------|----------|
| `search <query>` | Поиск расширений в каталоге |
| `install <type:name>` | Установка расширения (с разрешением зависимостей) |
| `remove <type:name>` | Удаление расширения |
| `move <type:name>` | Перемещение между scope (global / project) |
| `list` | Список установленных расширений |
| `info <type:name>` | Информация о расширении |
| `update [name]` | Обновление расширений и кеша каталога |
| `setup-mcp --agent <agent>` | Настройка MCP-сервера |
| `config <subcommand>` | Управление конфигом (list, get, set, init, save-as-global, reset-to-global) |
| `agents-conventions <cmd>` | Режим agents-conventions (enable, disable, status) |
| `launch <agent>` | Запуск AI-агента с настройками прокси |

## Интерактивный TUI

Запуск без аргументов (`skill-hub`) открывает полноэкранный интерфейс с вкладками: Каталог, Установленные, Настройки.

## MCP-сервер

Пакет включает MCP-сервер с инструментами (все поддерживают параметр `agent`):

- `search_extensions` — поиск по каталогу (фильтр по агенту)
- `install_extension` — установка расширения для выбранного агента
- `remove_extension` — удаление расширения
- `move_extension` — перемещение между scope (global / project)
- `list_extensions` — список установленных
- `suggest_extensions` — рекомендации расширений для проекта
- `get_extension_info` — подробная информация о расширении со статусом установки

## Локальная разработка

Для тестирования без публикации в npm:

```bash
# Из директории cli/ — собрать и залинковать глобально
cd cli && npm run build && npm link

# Тестировать как обычно
skill-hub search git

# Удалить глобальный линк
npm unlink -g @emaxe/skill-hub
```

При изменениях в исходниках достаточно пересобрать (`npm run build`) — линк обновится автоматически.

## Ссылки

- [Репозиторий](https://github.com/emaxe/skill-hub)
- [Каталог расширений](https://github.com/emaxe/skill-hub-catalog) — создание своих расширений см. `docs/` в каталоге

## Лицензия

MIT
