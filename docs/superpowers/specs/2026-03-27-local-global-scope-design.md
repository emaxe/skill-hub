# Дизайн: глобальная и локальная установка расширений

**Дата:** 2026-03-27
**Статус:** Утверждён

## Контекст

Пользователи skill-hub хотят устанавливать расширения как глобально (`~/.claude/`), так и локально в текущий проект (`.claude/`). Инфраструктура (CLI, MCP, адаптеры) уже поддерживает оба scope, но `client/SKILL.md` всегда хардкодит `scope: "global"` и не предоставляет пользователю выбора.

## Цели

1. Добавить `--local` флаг в CLI как alias для `--project`
2. Обновить `client/SKILL.md`: логика определения scope из команды, фразы или по умолчанию (project)

## Решения

### 1. Определение scope в client/SKILL.md

Три уровня приоритета (от высшего):

| Приоритет | Условие | Scope |
|-----------|---------|-------|
| 1 | Флаг `--global` в команде | global |
| 2 | Флаг `--local` в команде | project |
| 3 | Фраза "глобально" / "для всех проектов" | global |
| 4 | Фраза "в проект" / "локально" / "только здесь" | project |
| 5 | Не указано | **project** (по умолчанию) |

### 2. CLI — флаг `--local`

Файлы: `cli/src/commands/install.ts`, `cli/src/commands/remove.ts`

```typescript
.option('--local', 'Установка в текущий проект (alias для --project)')
```

Логика scope:
```typescript
const scope = opts.project || opts.local ? 'project' : 'global';
```

Дефолт в CLI при прямом запуске в терминале остаётся `global` (обратная совместимость).

### 3. client/SKILL.md — MCP-таблица (install)

```
/skill-hub install X              → install_extension({name:"X", scope:"project"})
/skill-hub install X --local      → install_extension({name:"X", scope:"project"})
/skill-hub install X --global     → install_extension({name:"X", scope:"global"})
```

### 4. client/SKILL.md — MCP-таблица (remove)

```
/skill-hub remove X               → remove_extension({name:"X", scope:"project"})
/skill-hub remove X --local       → remove_extension({name:"X", scope:"project"})
/skill-hub remove X --global      → remove_extension({name:"X", scope:"global"})
```

### 5. client/SKILL.md — CLI-блок

```bash
skill-hub install <name>          # локально (project)
skill-hub install <name> --local  # локально явно
skill-hub install <name> --global # глобально
skill-hub remove <name>           # удалить локальную
skill-hub remove <name> --global  # удалить глобальную
```

## Что не меняется

- MCP сервер (`cli/src/mcp.ts`) — уже поддерживает `scope` параметр
- Адаптеры (`claude-code`, `cursor`, `copilot`) — уже корректно маппят пути
- Дефолт CLI в терминале — остаётся `global`
- Реестр `installed.json` — без изменений

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `cli/src/commands/install.ts` | Добавить `--local` option, обновить логику scope |
| `cli/src/commands/remove.ts` | Добавить `--local` option, обновить логику scope |
| `client/SKILL.md` | Раздел "Определение scope", обновить таблицы MCP и CLI блок |

## Верификация

1. `skill-hub install <name> --local` — устанавливает в `./.claude/skills/`
2. `skill-hub install <name> --global` — устанавливает в `~/.claude/skills/`
3. `skill-hub install <name>` — остаётся `global` (CLI дефолт не меняется)
4. Через MCP: `install_extension({name, scope:"project"})` — в проект
5. `/skill-hub install X` без флагов — агент использует `scope:"project"` (по умолчанию в skill)
6. `/skill-hub install X --global` — агент использует `scope:"global"`
