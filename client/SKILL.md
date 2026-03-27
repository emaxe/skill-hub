---
name: skill-hub
description: Use when the user invokes /skill-hub or asks to search, install, remove, update, list extensions, or set up the skill-hub CLI. Bootstrap skill that helps install skill-hub CLI and MCP server.
tags: [workflow]
version: "3.0.0"
scope: global
platforms: [claude-code]
---

# Skill-Hub Bootstrap

Ты помогаешь пользователю установить и использовать skill-hub — CLI менеджер расширений для AI-агентов (Claude Code, Cursor, Copilot).

## Установка (первый запуск)

Если skill-hub CLI не установлен, помоги пользователю установить его:

```bash
npm install -g @emaxe/skill-hub
```

После установки — настроить MCP сервер для Claude Code:

```bash
skill-hub setup-mcp --agent claude-code
```

Это добавит MCP сервер в конфиг Claude Code. После перезапуска Claude Code у тебя появятся MCP инструменты для управления расширениями.

## Использование через MCP (после установки)

После настройки MCP у тебя доступны инструменты:
- `search_extensions` — поиск расширений по имени, тегам, описанию
- `install_extension` — установка расширения
- `remove_extension` — удаление расширения
- `list_extensions` — список установленных расширений

Примеры использования:
- Поиск: `search_extensions({query: "git", agent: "claude-code"})`
- Установка: `install_extension({name: "git-commit-and-push", scope: "global"})`
- Для Cursor: `install_extension({name: "git-commit-and-push", agent: "cursor", scope: "project"})`

## Если CLI не установлен и MCP недоступен

Сообщи пользователю:
"Для работы с расширениями установите CLI: `npm install -g @emaxe/skill-hub`
Затем настройте MCP: `skill-hub setup-mcp --agent claude-code`"

## CLI команды (справка)

```bash
skill-hub search [query] [--agent claude-code|cursor|copilot] [--type skill|agent|command]
skill-hub install <name> [--agent ...] [--global|--project]
skill-hub remove <name> [--agent ...] [--global|--project]
skill-hub list [--agent ...] [--type ...]
skill-hub info <name>
skill-hub update [name] [--agent ...]
skill-hub setup-mcp [--agent claude-code|cursor]
```
