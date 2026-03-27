---
name: skill-hub
description: Use when the user invokes /skill-hub or asks to search, install, remove, update, list extensions, or set up the skill-hub CLI. Bootstrap skill that helps install skill-hub CLI and MCP server.
tags: [workflow]
version: "3.2.0"
scope: global
platforms: [claude-code]
---

# Skill-Hub

Ты — AI-агент. Когда пользователь вызывает `/skill-hub`, ты выполняешь действие сам, а не показываешь пользователю команды для ввода.

## Алгоритм действий

### 1. MCP-инструменты доступны (приоритет)

Если в твоём контексте есть MCP-инструменты `search_extensions`, `install_extension`, `remove_extension`, `list_extensions` — вызывай их напрямую как tool call:

### Определение scope установки

Перед вызовом `install_extension` или `remove_extension` определи scope по следующим приоритетам:

| Приоритет | Условие | Scope |
|-----------|---------|-------|
| 1 | Флаг `--global` в запросе пользователя | `global` |
| 2 | Флаг `--local` в запросе пользователя | `project` |
| 3 | Слова «глобально», «для всех проектов» | `global` |
| 4 | Слова «в проект», «локально», «только здесь» | `project` |
| 5 | Scope не указан | `project` (по умолчанию) |

| Запрос пользователя | Вызов инструмента |
|---------------------|-------------------|
| `/skill-hub search X` | `search_extensions({query: "X", agent: "claude-code"})` |
| `/skill-hub install X` | `install_extension({name: "X", scope: "project", agent: "claude-code"})` |
| `/skill-hub install X --global` | `install_extension({name: "X", scope: "global", agent: "claude-code"})` |
| `/skill-hub install X --local` | `install_extension({name: "X", scope: "project", agent: "claude-code"})` |
| `/skill-hub remove X` | `remove_extension({name: "X", scope: "project", agent: "claude-code"})` |
| `/skill-hub remove X --global` | `remove_extension({name: "X", scope: "global", agent: "claude-code"})` |
| `/skill-hub list` | `list_extensions({agent: "claude-code"})` — показывает тип, имя, версию, scope и способ установки: `[skill-hub]` или `[manual]` |
| `/skill-hub info X` | `search_extensions({query: "X", agent: "claude-code"})` |
| `/skill-hub update` | `list_extensions(...)`, затем `install_extension(...)` для каждого |

Не показывай CLI-команды пользователю — просто выполни действие и покажи результат.

### 2. MCP недоступен, CLI установлен

Если MCP-инструментов нет, но `skill-hub` CLI доступен — выполни через Bash:

```
skill-hub search <query> --agent claude-code
skill-hub install <name> --local  # в текущий проект (по умолчанию для этого скила)
skill-hub install <name> --global # глобально
skill-hub remove <name> --local   # удалить проектную установку
skill-hub remove <name> --global  # удалить глобальную установку
skill-hub list
skill-hub info <name>
skill-hub update
```

Выполняй команду и показывай результат. Не выводи список команд как подсказку.

### 3. Ничего не установлено

Если ни MCP-инструменты, ни CLI недоступны — помоги пользователю установить CLI:

```bash
npm install -g @emaxe/skill-hub
skill-hub setup-mcp --agent claude-code
```

После установки перезапусти Claude Code, чтобы MCP-инструменты стали доступны.
