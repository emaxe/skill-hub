# skill-hub

Extension manager for AI coding agents — Claude Code, Cursor, Copilot.

Центральный репозиторий переиспользуемых расширений: **skills**, **agents** и **commands**, расширяющих возможности AI-ассистентов.

## Установка

```bash
npm install -g @emaxe/skill-hub
```

## Быстрый старт

```bash
# Настроить MCP-сервер для Claude Code
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
| `install <type:name>` | Установка расширения |
| `remove <type:name>` | Удаление расширения |
| `list` | Список установленных расширений |
| `info <type:name>` | Информация о расширении |
| `update` | Обновление всех установленных расширений |
| `setup-mcp --agent <agent>` | Настройка MCP-сервера |

## MCP-сервер

Пакет включает MCP-сервер с инструментами:

- `search_extensions` — поиск по каталогу
- `install_extension` — установка расширения
- `remove_extension` — удаление расширения
- `list_extensions` — список установленных

## Локальная разработка

Для тестирования без публикации в npm:

```bash
# Из корня репозитория — собрать и залинковать глобально
bash scripts/dev-link.sh

# Тестировать как обычно
skill-hub search git

# Удалить глобальный линк
bash scripts/dev-link.sh unlink
```

При изменениях в исходниках достаточно пересобрать (`npm run build`) — линк обновится автоматически.

## Ссылки

- [Репозиторий](https://github.com/emaxe/skill-hub)
- [Создание своего расширения](https://github.com/emaxe/skill-hub/blob/main/CONTRIBUTING.md)

## Лицензия

MIT
