# Руководство по созданию агентов

Полное руководство по созданию качественных агентов для Skill-Hub.

## Что такое агент?

Агент — это файл `AGENT.md` с инструкциями для специализированного AI-помощника, который может быть запущен для автономного выполнения задач. Агенты отличаются от скиллов тем, что работают как независимые подпроцессы с собственным контекстом.

## Справочник по frontmatter

Каждый `AGENT.md` начинается с YAML frontmatter между разделителями `---`:

| Поле           | Тип      | Обязательное | По умолчанию | Описание |
|----------------|----------|-------------|-------------|----------|
| `name`         | string   | Да          | —           | Уникальный kebab-case идентификатор. Должен совпадать с именем директории. Паттерн: `^[a-z0-9]+(-[a-z0-9]+)*$` |
| `description`  | string   | Да          | —           | Описание назначения агента и когда его вызывать. Минимум 10 символов. |
| `model`        | string   | Нет         | —           | Предпочтительная модель Claude (например, `claude-sonnet-4-6`, `claude-opus-4-6`). |
| `color`        | string   | Нет         | —           | Hex-цвет для индикатора в строке состояния (например, `#00AA00`). |
| `tags`         | string[] | Нет         | `[]`        | Теги для категоризации. См. [TAG-TAXONOMY.md](TAG-TAXONOMY.md). |
| `author`       | string   | Нет         | —           | GitHub-юзернейм автора. |
| `version`      | string   | Нет         | —           | Семантическая версия (например, `1.0.0`). |
| `scope`        | string   | Нет         | `global`    | Где агент может быть установлен: `global`, `project`, `both`. |
| `platforms`    | string[] | Нет         | —           | Поддерживаемые платформы: `claude-code`, `cursor`, `gemini`, `codex`. |
| `dependencies` | string[] | Нет         | `[]`        | Зависимости от других расширений (формат: `type:name`). |

Полная JSON Schema: [schema/agent-frontmatter.schema.json](../schema/agent-frontmatter.schema.json)

## Написание описания

Поле `description` определяет, **когда** Claude Code должен предложить использовать агента. Пишите как триггерную фразу, начиная с "Use when...".

**Хорошие описания:**

```yaml
description: "Use when the user asks for a code review or wants to review changes before merging"
description: "Use when the user needs to refactor a large codebase across multiple files"
```

**Плохие описания:**

```yaml
description: "A code review agent"      # Слишком расплывчато
description: "Reviews code"             # Нет триггера
```

## Структура контента

### Overview

Краткое описание того, что делает агент и зачем он нужен.

### Instructions

Подробные инструкции для агента. Опишите:
- Что агент должен делать при вызове
- Какие инструменты использовать
- Какие шаги выполнять
- Как взаимодействовать с пользователем

### Rules

Ограничения, граничные случаи и важные правила.

## Выбор модели

Поле `model` позволяет указать предпочтительную модель:

- `claude-opus-4-6` — для сложных задач, требующих глубокого анализа
- `claude-sonnet-4-6` — баланс между качеством и скоростью (рекомендуется по умолчанию)
- `claude-haiku-4-5-20251001` — для быстрых, простых задач

Если поле не указано, Claude Code использует модель текущей сессии.

## Scope

- **`global`** — устанавливается в `~/.claude/agents/{name}.md`. Доступен во всех проектах.
- **`project`** — устанавливается в `.claude/agents/{name}.md`. Доступен только в текущем проекте.
- **`both`** — пользователь выбирает scope при установке.

## Установка

При установке через Skill-Hub, файл `AGENT.md` копируется и переименовывается:

```
agents/{name}/AGENT.md  →  ~/.claude/agents/{name}.md     (global)
agents/{name}/AGENT.md  →  .claude/agents/{name}.md       (project)
```

## Зависимости

Зависимости указываются в формате `type:name`:

```yaml
dependencies: [skill:feature-planning, agent:code-reviewer]
```

Без префикса типа зависимость считается скиллом.

## Тестирование

1. Скопируйте агента в соответствующую директорию:
   ```bash
   cp agents/your-agent/AGENT.md ~/.claude/agents/your-agent.md
   ```

2. Откройте Claude Code и вызовите агента через Agent tool или через упоминание.

3. Проверьте, что агент корректно следует инструкциям.

## Пример агента

```yaml
---
name: code-reviewer
description: "Use when the user asks to review code, check for bugs, or validate implementation quality"
model: claude-sonnet-4-6
color: "#FF6600"
tags: [workflow, safety]
author: your-username
version: "1.0.0"
scope: global
platforms: [claude-code]
---

# Code Reviewer Agent

## Overview

Специализированный агент для ревью кода. Анализирует изменения на предмет качества, безопасности и соответствия best practices.

## Instructions

1. Получить список изменённых файлов через git diff
2. Прочитать каждый изменённый файл
3. Проанализировать на предмет:
   - Баги и логические ошибки
   - Проблемы безопасности (OWASP Top 10)
   - Производительность
   - Читаемость и maintainability
4. Сформировать отчёт с конкретными замечаниями и предложениями

## Rules

- Всегда указывать файл и номер строки для каждого замечания
- Не предлагать стилистические изменения, если они не влияют на читаемость
- Приоритизировать: баги > безопасность > производительность > стиль
```
