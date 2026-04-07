---
name: init-agents
description: Initialize or verify agent configuration structure. Creates symlinks, thin pointers, AGENTS.md, and migrates skills from .claude, .github, .cursor folders to .agents/skills. Use when setting up new project structure or fixing agent configuration. | Инициализация или проверка структуры конфигурации агентов. Создает симлинки, тонкие указатели, AGENTS.md и мигрирует скиллы из папок .claude, .github, .cursor в .agents/skills. Используй при настройке новой структуры проекта или исправлении конфигурации агентов.
---

# Инициализация структуры агентов

Полная подготовка рутовой папки проекта по конвенции
[agents-conventions](../agents-conventions/SKILL.md): создание директорий, симлинков,
тонких указателей и `AGENTS.md`.

## Цель

Привести рутовую папку проекта в соответствие с конвенцией `agents-conventions`:
- Создать `.agents/rules/`, `.agents/skills/`
- Создать симлинки из `.claude/skills`, `.github/skills`, `.cursor/skills` на `.agents/skills`
- Создать тонкие указатели для Copilot, Cursor, Claude Code
- Создать `AGENTS.md` если отсутствует
- При наличии существующих скилов -- мигрировать и смерджить их

Все операции идемпотентны: если артефакт уже существует -- пропустить.

## Алгоритм

### 1. Создание директорий

Создать если отсутствуют:
- `.agents/skills/`
- `.agents/rules/`
- `.claude/`
- `.github/instructions/`
- `.cursor/rules/`

### 2. Миграция скилов

Для каждой из `.claude`, `.github`, `.cursor`:

```
если {folder}/skills/ существует И это НЕ симлинк:
    мигрировать скилы (шаг 3)
```

### 3. Перенос скилов в .agents/skills

Для каждой папки `{folder}/skills/` (не симлинк):
1. Найти все скилы (`*/SKILL.md`)
2. Для каждого скила:
   - Если скил уже существует в `.agents/skills/{skill-name}/` -- смерджить (шаг 4)
   - Иначе -- скопировать папку скила в `.agents/skills/`
3. Удалить папку `{folder}/skills/`

### 4. Мердж скилов

При совпадении имён:
- Объединить frontmatter (объединить description)
- Объединить содержимое SKILL.md (добавить секцию с источником)
- Скопировать дополнительные файлы если есть

### 5. Создание симлинков на skills

Для каждой из `.claude`, `.github`, `.cursor`:

```
если {folder}/skills НЕ существует:
    создать симлинк {folder}/skills -> ../.agents/skills
```

### 6. Создание тонких указателей

Каждый указатель создается только если файл отсутствует.

#### .claude/CLAUDE.md

Содержимое по шаблону [claude-pointer.md.example](../agents-conventions/assets/claude-pointer.md.example):

```
Все правила проекта описаны в [AGENTS.md](../AGENTS.md).
Прочитай AGENTS.md перед началом работы.
```

#### .github/instructions/project-rules.instructions.md

Содержимое по шаблону [copilot-pointer.instructions.md.example](../agents-conventions/assets/copilot-pointer.instructions.md.example):

```
---
applyTo: "**"
---
Все правила проекта описаны в [AGENTS.md](../../AGENTS.md).
Прочитай AGENTS.md перед началом работы.
```

#### .cursor/rules/project-rules.mdc

Содержимое по шаблону [cursor-pointer.mdc.example](../agents-conventions/assets/cursor-pointer.mdc.example):

```
---
description: Правила проекта
alwaysApply: true
---
Все правила описаны в [AGENTS.md](../AGENTS.md).
Прочитай AGENTS.md перед началом работы.
```

### 7. Создание AGENTS.md

Если `AGENTS.md` в корне проекта отсутствует -- создать по шаблону
[AGENTS.md.example](../agents-conventions/assets/AGENTS.md.example):

```markdown
# Название проекта

Краткое описание проекта.

## Мета

Перед добавлением или изменением правил, скилов, инструкций -- прочитай скилл
`agents-conventions`.

## Правила

### Название правила
Краткое описание правила в 1-3 предложения.
[Подробности](.agents/rules/example-rule.md)
```

Если `AGENTS.md` уже существует -- не модифицировать.

## Структура после инициализации

```
project-root/
├── AGENTS.md                                    # SOURCE OF TRUTH -- индекс правил
├── .agents/
│   ├── skills/                                  # скиллы
│   │   ├── skill-1/
│   │   │   └── SKILL.md
│   │   └── skill-2/
│   │       └── SKILL.md
│   └── rules/                                   # правила
├── .claude/
│   ├── CLAUDE.md                                # тонкий указатель -> AGENTS.md
│   └── skills -> ../.agents/skills              # симлинк
├── .github/
│   ├── instructions/
│   │   └── project-rules.instructions.md        # тонкий указатель -> AGENTS.md
│   └── skills -> ../.agents/skills              # симлинк
└── .cursor/
    ├── rules/
    │   └── project-rules.mdc                    # тонкий указатель -> AGENTS.md
    └── skills -> ../.agents/skills              # симлинк
```

## Ограничения

Скилл инициализирует только рутовую папку проекта. Для поддиректорий с собственными
правилами (например `src/ui/`) и standalone-режима поддиректорий -- см. конвенцию
[agents-conventions](../agents-conventions/SKILL.md), секции "Поддиректории с правилами"
и "Standalone-режим поддиректории".

## Использование

Скилл выполняет все операции автоматически. Запустить для инициализации нового
проекта или проверки/исправления существующей структуры.
