---
name: agents-conventions
description: MANDATORY before creating or editing files in .agents/, .cursor/rules/, .github/instructions/, .claude/, or AGENTS.md. Read FIRST when adding a rule, skill, instruction, .mdc or .instructions.md file, or setting up a new root folder. Defines structure convention, thin pointers, file placement. | ОБЯЗАТЕЛЬНО перед созданием или редактированием файлов в .agents/, .cursor/rules/, .github/instructions/, .claude/ или AGENTS.md. Читать ПЕРВЫМ при добавлении правила, скилла, инструкции, .mdc или .instructions.md, или настройке рутовой папки. Определяет конвенцию структуры, тонкие указатели, размещение файлов.
---

# Конвенция структуры конфигурации AI-агентов

Универсальная конвенция организации правил, скиллов и инструкций для AI-агентов в проекте.
Не привязана к конкретному проекту или стеку.

Полная структура каталогов: [assets/directory-structure.txt](assets/directory-structure.txt)

## Принцип

Один источник правды -- `AGENTS.md`. Все инструменты (Copilot, Cursor, Claude Code, Codex)
читают его напрямую или через тонкий указатель. Правила не дублируются между форматами.

## Рутовая папка проекта

Рутовая папка -- директория, которую CLI-агент (Claude Code, Codex) или IDE
открывает как проект. Примеры: корень репозитория, отдельный микросервис в монорепо.

Рутовая папка содержит полный набор файлов:

| Файл | Назначение |
|---|---|
| `AGENTS.md` | SOURCE OF TRUTH -- индекс правил |
| `.agents/skills/<name>/SKILL.md` | Скиллы |
| `.agents/rules/<name>.md` | Правила |
| `.github/instructions/*.instructions.md` | Тонкий указатель (Copilot) |
| `.github/skills → ../.agents/skills` | Симлинк (Copilot) |
| `.cursor/rules/*.mdc` | Тонкий указатель (Cursor) |
| `.cursor/skills → ../.agents/skills` | Симлинк (Cursor) |
| `.claude/CLAUDE.md` | Тонкий указатель (Claude Code) |
| `.claude/skills → ../.agents/skills` | Симлинк (Claude Code) |

## AGENTS.md

Тонкий индекс: описание проекта + список правил (1-3 предложения каждое)
со ссылками на `.agents/rules/<name>.md`.

Обязательная секция "Мета" в начале -- ссылка на скилл `agents-conventions`.
Это гарантирует, что агент прочитает конвенцию перед изменением структуры.

Шаблон: [assets/AGENTS.md.example](assets/AGENTS.md.example)

## Тонкие указатели

Содержат только ссылку на AGENTS.md. Правила не дублируются.
Каждый инструмент имеет свой формат -- шаблоны в `assets/`.

Copilot: используются только файлы в `.github/instructions/`. Файл
`.github/copilot-instructions.md` не создавать -- он дублирует роль тонкого
указателя `project-rules.instructions.md`.

### Именование файлов

Корневой указатель: `project-rules` (одинаково для всех инструментов).
Указатель на поддиректорию: `<subdir>-rules` (например `ui-rules` для `src/ui/`).

| Инструмент | Корневой | На поддиректорию |
|---|---|---|
| Copilot | `project-rules.instructions.md` | `<subdir>-rules.instructions.md` |
| Cursor | `project-rules.mdc` | `<subdir>-rules.mdc` |
| Claude Code | `CLAUDE.md` | -- |

### Вложенные поддиректории

Имя указателя отражает полную иерархию от проект-рута через дефис.
Каждый уровень вложенности добавляет префикс.

Пример: проект-рут содержит `src/ui/`, внутри которого `Operator.UI/` и `shared/`.

Указатели в проект-руте:

| Поддиректория | Имя указателя |
|---|---|
| `src/ui/` | `ui-rules` |
| `src/ui/Operator.UI/` | `ui-operator-rules` |
| `src/ui/shared/` | `ui-shared-rules` |

Если `src/ui/` -- standalone проект-рут, указатели внутри него без `ui-` префикса:

| Поддиректория | Имя указателя |
|---|---|
| `Operator.UI/` | `operator-rules` |
| `shared/` | `shared-rules` |

### Паттерны файлов

Copilot (`applyTo`) и Cursor (`globs`) используют одинаковый формат:
- Корневой: `**` / `alwaysApply: true`
- На поддиректорию: `src/ui/**` (без фильтра по расширениям)

### Шаблоны

| Инструмент | Шаблон указателя |
|---|---|
| Copilot | [copilot-pointer.instructions.md.example](assets/copilot-pointer.instructions.md.example) |
| Cursor | [cursor-pointer.mdc.example](assets/cursor-pointer.mdc.example) |
| Claude Code | [claude-pointer.md.example](assets/claude-pointer.md.example) |

Инструменты не читают `.agents/skills/` напрямую, поэтому каждому нужен симлинк:
```
.claude/skills  → ../.agents/skills
.github/skills  → ../.agents/skills
.cursor/skills  → ../.agents/skills
```

## Поддиректории с правилами

Папка внутри проекта, у которой есть собственные правила (например `src/ui/`).
Не является рутовой папкой -- не содержит конфигурацию инструментов.

### Что содержит поддиректория

Только правила и их индекс:

| Файл | Назначение |
|---|---|
| `AGENTS.md` | SOURCE OF TRUTH -- индекс правил поддиректории |
| `.agents/rules/<name>.md` | Правила поддиректории |

Ни `.claude/`, ни `.cursor/`, ни `.github/`, ни `.agents/skills/` в поддиректории нет.

### Связь с рутовой папкой

Связь рутовой папки с поддиректориями обеспечивается только тонкими указателями.
Секция "Поддиректории" в `AGENTS.md` не нужна -- указатели с `applyTo`/`globs`
паттернами направляют агента к нужному `AGENTS.md` поддиректории.

Для каждой поддиректории в рутовой папке создаются указатели,
чтобы инструменты подхватывали правила при работе с файлами поддиректории:

| Инструмент | Шаблон указателя на поддиректорию |
|---|---|
| Copilot | [copilot-subdir-pointer.instructions.md.example](assets/copilot-subdir-pointer.instructions.md.example) |
| Cursor | [cursor-subdir-pointer.mdc.example](assets/cursor-subdir-pointer.mdc.example) |

### Правила наследования

- Поддиректория НЕ наследует правила корня автоматически
- Если корневое правило нужно в поддиректории -- добавить ссылку в её `AGENTS.md`

## Standalone-режим поддиректории

Если поддиректория также открывается в IDE как отдельный проект (отдельный
`package.json`, `.sln`, `go.mod`), она дополнительно получает конфигурацию
инструментов -- как у рутовой папки:

| Файл | Назначение |
|---|---|
| `.github/instructions/project-rules.instructions.md` | Тонкий указатель (Copilot) |
| `.github/skills → <relpath>/.agents/skills` | Симлинк на корневые скиллы (Copilot) |
| `.cursor/rules/project-rules.mdc` | Тонкий указатель (Cursor) |
| `.cursor/skills → <relpath>/.agents/skills` | Симлинк на корневые скиллы (Cursor) |
| `.claude/CLAUDE.md` | Тонкий указатель (Claude Code) |
| `.claude/skills → <relpath>/.agents/skills` | Симлинк на корневые скиллы (Claude Code) |

Скиллы обычно общие для всего проекта. Симлинки ведут на корневые скиллы:
```
src/ui/.claude/skills  → ../../../.agents/skills
src/ui/.github/skills  → ../../../.agents/skills
src/ui/.cursor/skills  → ../../../.agents/skills
```

Если у поддиректории есть собственные скиллы, они размещаются в её `.agents/skills/`.

## Операции

### Добавление нового правила

1. Создать `.agents/rules/<name>.md`
2. Добавить сводку + ссылку в `AGENTS.md`
3. Указатели обновлять не нужно -- они ссылаются на AGENTS.md

### Добавление новой рутовой папки

1. Создать `AGENTS.md` в папке
2. Создать `.agents/rules/` для локальных правил
3. Создать тонкие указатели (Copilot, Cursor, Claude Code) -- использовать шаблоны из `assets/`
4. Симлинки на корневые скиллы: `.claude/skills`, `.github/skills`, `.cursor/skills`
5. Добавить указатели на поддиректорию в корне (Copilot applyTo, Cursor globs)
