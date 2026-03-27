# Руководство по созданию команд

Полное руководство по созданию пользовательских slash-команд для Skill-Hub.

## Что такое команда?

Команда — это файл `COMMAND.md` с инструкциями для Claude Code, который вызывается пользователем через slash-синтаксис (например, `/deploy-check`). Команды отличаются от скиллов тем, что явно вызываются пользователем, а не активируются автоматически по контексту.

## Справочник по frontmatter

Каждый `COMMAND.md` начинается с YAML frontmatter между разделителями `---`:

| Поле           | Тип      | Обязательное | По умолчанию | Описание |
|----------------|----------|-------------|-------------|----------|
| `name`         | string   | Да          | —           | Уникальный kebab-case идентификатор. Должен совпадать с именем директории. Паттерн: `^[a-z0-9]+(-[a-z0-9]+)*$` |
| `description`  | string   | Да          | —           | Описание того, что делает команда. Минимум 10 символов. |
| `tags`         | string[] | Нет         | `[]`        | Теги для категоризации. См. [TAG-TAXONOMY.md](TAG-TAXONOMY.md). |
| `author`       | string   | Нет         | —           | GitHub-юзернейм автора. |
| `version`      | string   | Нет         | —           | Семантическая версия (например, `1.0.0`). |
| `scope`        | string   | Нет         | `project`   | Где команда может быть установлена: `project` или `both`. |
| `platforms`    | string[] | Нет         | —           | Поддерживаемые платформы: `claude-code`, `cursor`, `gemini`, `codex`. |
| `dependencies` | string[] | Нет         | `[]`        | Зависимости от других расширений (формат: `type:name`). |

Полная JSON Schema: [schema/command-frontmatter.schema.json](../schema/command-frontmatter.schema.json)

## Особенности команд

### Scope

Команды по умолчанию имеют scope `project`, так как Claude Code обнаруживает пользовательские команды в `.claude/commands/`. Варианты:

- **`project`** — устанавливается в `.claude/commands/{name}.md`. Доступна только в текущем проекте.
- **`both`** — пользователь выбирает: project (`.claude/commands/`) или global через symlink.

### Именование

Имя команды становится slash-командой: `name: deploy-check` → `/deploy-check`.

### Аргументы

Команды могут принимать аргументы. Опишите их в секции Arguments:

```markdown
## Arguments

- `target` — окружение для деплоя (staging, production)
- `--dry-run` — запуск без реального деплоя
```

## Структура контента

### Overview

Краткое описание назначения команды.

### Process

Пошаговые инструкции для выполнения команды.

### Arguments

Описание принимаемых аргументов и флагов.

### Examples

Примеры вызова команды:

```markdown
## Examples

/deploy-check staging
/deploy-check production --dry-run
```

### Rules

Ограничения и важные правила.

## Установка

При установке через Skill-Hub, файл `COMMAND.md` копируется и переименовывается:

```
commands/{name}/COMMAND.md  →  .claude/commands/{name}.md
```

## Зависимости

Зависимости указываются в формате `type:name`:

```yaml
dependencies: [skill:git-commit-and-push]
```

Без префикса типа зависимость считается скиллом.

## Тестирование

1. Скопируйте команду:
   ```bash
   mkdir -p .claude/commands
   cp commands/your-command/COMMAND.md .claude/commands/your-command.md
   ```

2. Откройте Claude Code в проекте и вызовите `/your-command`.

3. Проверьте, что команда выполняется корректно.

## Пример команды

```yaml
---
name: deploy-check
description: "Pre-deployment validation: checks tests, lint, build, and environment configuration"
tags: [ci-cd, safety]
author: your-username
version: "1.0.0"
scope: project
platforms: [claude-code]
---

# /deploy-check

## Overview

Проверяет готовность проекта к деплою: запускает тесты, линтер, сборку и валидирует конфигурацию окружения.

## Process

1. Определить менеджер пакетов (npm, yarn, pnpm)
2. Запустить тесты: `npm test`
3. Запустить линтер: `npm run lint`
4. Запустить сборку: `npm run build`
5. Проверить наличие `.env.production` или аналога
6. Проверить, что все env-переменные из `.env.example` определены
7. Вывести сводку: что прошло, что упало

## Arguments

- `environment` — целевое окружение (по умолчанию: production)
- `--skip-tests` — пропустить тесты
- `--skip-build` — пропустить сборку

## Rules

- Никогда не выполнять реальный деплой — только проверки
- При ошибках показать конкретную проблему и предложить исправление
- Всегда проверять наличие secrets в коде перед деплоем
```
