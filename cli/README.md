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
| `help` / `-h` / `--help` | Справка по всем командам и вариантам запуска |

### Флаг `-a` / `-A` — быстрый запуск агента

```bash
skill-hub -a <agent> [аргументы для агента...]   # exec (по умолчанию)
skill-hub -A <agent> [аргументы для агента...]   # через temp-скрипт
```

Запускает AI-агент (`claude-code`, `cursor`, `copilot`) с настройками прокси из конфига.

- **`-a`** — shell `exec`: процесс skill-hub заменяется на агент. В `ps` виден только агент.
- **`-A`** — создаёт временный shell-скрипт с env-переменными и `exec`. Полезно для отладки.

Примеры:
```bash
skill-hub -a copilot                   # запустить copilot
skill-hub -a claude-code -p "fix bug"  # запустить claude с промптом
skill-hub -A copilot                   # через temp-скрипт (для отладки)
```

### Сокращения для update

```bash
skill-hub -u              # = skill-hub update
skill-hub -u git-helper   # = skill-hub update git-helper
skill-hub -U              # = skill-hub update (обновить всё, без аргументов)
```

### Флаг `--then` — цепочка команд

Разделяет две команды. Вторая запускается только после полного завершения первой:

```bash
skill-hub -U --then -a copilot          # обновить всё, затем запустить copilot
skill-hub update --then -a claude-code  # то же самое
```

## Интерактивный TUI

Запуск без аргументов (`skill-hub`) открывает полноэкранный интерфейс с вкладками: Каталог, Установленные, Настройки.

### Папки ИИ-агентов в .gitignore

В настройках TUI (вкладка «Настройки») можно включить автоматическое добавление папок ИИ-агентов в `.gitignore`. При включении:

- При старте TUI проверяются папки `.claude/`, `.cursor/`, `.github/`, `.codex/`, `.agents/`, `.cursorrules`
- Если какие-то из них есть в проекте, но отсутствуют в `.gitignore` — показывается диалог с предложением добавить
- При обновлении (`skill-hub -U`) пропущенные записи добавляются автоматически

Настройка хранится в публичном проектном конфиге (`.skill-hub.json`, поле `gitignoreAgentDirs`).

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
