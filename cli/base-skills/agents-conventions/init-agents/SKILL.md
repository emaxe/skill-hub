---
name: init-agents
description: Initialize or verify agent configuration structure. Creates symlinks, thin pointers, AGENTS.md, migrates skills from .claude, .github, .cursor to .agents/skills, migrates root AI-agent config files (CLAUDE.md, .cursorrules, copilot-instructions.md) to .agents/rules/project-rules.md replacing originals with thin pointers. If no root configs found — auto-analyzes the project and populates project-rules.md with stack, structure, and key commands. | Инициализация или проверка структуры конфигурации агентов. Создает симлинки, тонкие указатели, AGENTS.md, мигрирует скиллы из .claude, .github, .cursor в .agents/skills, мигрирует корневые файлы ИИ-агентов (CLAUDE.md, .cursorrules, copilot-instructions.md) в .agents/rules/project-rules.md, заменяя оригиналы тонкими указателями. Если корневых конфигов нет — автоматически анализирует проект и заполняет project-rules.md базовой информацией (стек, структура, команды).
---

# Инициализация структуры агентов

Полная подготовка рутовой папки проекта по конвенции
[agents-conventions](../agents-conventions/SKILL.md): создание директорий, симлинков,
тонких указателей и `AGENTS.md`.

## Цель

Привести рутовую папку проекта в соответствие с конвенцией `agents-conventions`:
- Создать `.agents/rules/`, `.agents/skills/`
- Мигрировать корневые файлы ИИ-агентов (`CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`) в `.agents/rules/project-rules.md`, заменив оригиналы тонкими указателями
- Если корневых файлов ИИ-агентов нет -- проанализировать проект и создать `.agents/rules/project-rules.md` с базовым описанием (стек, структура, команды)
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

### 2. Миграция корневых файлов ИИ-агентов

Проверить наличие корневых файлов конфигурации ИИ-агентов:

| Файл | Агент |
|---|---|
| `CLAUDE.md` (корень проекта, НЕ `.claude/CLAUDE.md`) | Claude Code |
| `.cursorrules` | Cursor (устаревший формат) |
| `.github/copilot-instructions.md` | Copilot (устаревший формат) |

#### 2a. Если хотя бы один файл найден

1. Собрать содержимое всех найденных файлов
2. Объединить в `.agents/rules/project-rules.md` с указанием источника каждого блока:

```markdown
# Правила проекта

<!-- Мигрировано из корневых файлов ИИ-агентов -->

## Из CLAUDE.md

{содержимое CLAUDE.md}

## Из .cursorrules

{содержимое .cursorrules}

## Из .github/copilot-instructions.md

{содержимое copilot-instructions.md}
```

Если `.agents/rules/project-rules.md` уже существует -- не перезаписывать, пропустить.

3. Заменить каждый найденный файл тонким указателем:

**CLAUDE.md** (корень проекта):
```
Все правила проекта описаны в [AGENTS.md](AGENTS.md).
Прочитай AGENTS.md перед началом работы.
```

**.cursorrules**:
```
Все правила проекта описаны в AGENTS.md.
Прочитай AGENTS.md перед началом работы.
```

**.github/copilot-instructions.md**:
```
Все правила проекта описаны в [AGENTS.md](../AGENTS.md).
Прочитай AGENTS.md перед началом работы.
```

#### 2b. Если ни одного корневого файла не найдено

Быстро проанализировать проект и создать `.agents/rules/project-rules.md` с базовым
описанием. Если `project-rules.md` уже существует -- пропустить.

**Источники для анализа** (читать то, что доступно):
- `package.json` / `requirements.txt` / `go.mod` / `Cargo.toml` / `*.sln` / `*.csproj` — стек
- `README.md` (первые ~50 строк) — описание проекта
- Структура корневых файлов и папок — архитектура
- `Makefile` / `scripts/` / секция `scripts` в `package.json` — ключевые команды

**Шаблон `.agents/rules/project-rules.md`:**

```markdown
# Правила проекта

## Стек

- Язык: {язык}
- Фреймворк: {фреймворк, если определён}
- Менеджер пакетов: {npm/yarn/pnpm/pip/go/cargo...}

## Структура проекта

{краткое описание структуры, 3-7 строк}

## Ключевые команды

- Сборка: `{команда}`
- Тесты: `{команда}`
- Линтинг: `{команда}`
```

Заполнить только то, что удалось определить. Не угадывать -- если информации нет, 
не включать секцию.

### 3. Обновление AGENTS.md (ссылка на project-rules)

Если `.agents/rules/project-rules.md` был создан на шаге 2 (миграция или автоанализ),
и `AGENTS.md` уже существует, но не содержит ссылки на `project-rules` --
добавить в секцию "Правила":

```markdown
### Правила проекта
Основные правила и описание проекта, мигрированные из корневых файлов конфигурации.
[Подробности](.agents/rules/project-rules.md)
```

Если `AGENTS.md` ещё не существует -- ссылка будет добавлена при создании на шаге 9.

### 4. Миграция скилов

Для каждой из `.claude`, `.github`, `.cursor`:

```
если {folder}/skills/ существует И это НЕ симлинк:
    мигрировать скилы (шаг 5)
```

### 5. Перенос скилов в .agents/skills

Для каждой папки `{folder}/skills/` (не симлинк):
1. Найти все скилы (`*/SKILL.md`)
2. Для каждого скила:
   - Если скил уже существует в `.agents/skills/{skill-name}/` -- смерджить (шаг 6)
   - Иначе -- скопировать папку скила в `.agents/skills/`
3. Удалить папку `{folder}/skills/`

### 6. Мердж скилов

При совпадении имён:
- Объединить frontmatter (объединить description)
- Объединить содержимое SKILL.md (добавить секцию с источником)
- Скопировать дополнительные файлы если есть

### 7. Создание симлинков на skills

Для каждой из `.claude`, `.github`, `.cursor`:

```
если {folder}/skills НЕ существует:
    создать симлинк {folder}/skills -> ../.agents/skills
```

### 8. Создание тонких указателей

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

### 9. Создание AGENTS.md

Если `AGENTS.md` в корне проекта отсутствует -- создать по шаблону
[AGENTS.md.example](../agents-conventions/assets/AGENTS.md.example).

Если `.agents/rules/project-rules.md` был создан на шаге 2, включить ссылку
в секцию "Правила":

```markdown
# Название проекта

Краткое описание проекта.

## Мета

Перед добавлением или изменением правил, скилов, инструкций -- прочитай скилл
`agents-conventions`.

## Правила

### Правила проекта
Основные правила и описание проекта.
[Подробности](.agents/rules/project-rules.md)
```

Если `AGENTS.md` уже существует -- не модифицировать.

## Структура после инициализации

```
project-root/
├── AGENTS.md                                    # SOURCE OF TRUTH -- индекс правил
├── CLAUDE.md                                    # тонкий указатель -> AGENTS.md (если был)
├── .cursorrules                                 # тонкий указатель -> AGENTS.md (если был)
├── .agents/
│   ├── skills/                                  # скиллы
│   │   ├── skill-1/
│   │   │   └── SKILL.md
│   │   └── skill-2/
│   │       └── SKILL.md
│   └── rules/                                   # правила
│       └── project-rules.md                     # мигрированные/сгенерированные правила
├── .claude/
│   ├── CLAUDE.md                                # тонкий указатель -> AGENTS.md
│   └── skills -> ../.agents/skills              # симлинк
├── .github/
│   ├── copilot-instructions.md                  # тонкий указатель -> AGENTS.md (если был)
│   ├── instructions/
│   │   └── project-rules.instructions.md        # тонкий указатель -> AGENTS.md
│   └── skills -> ../.agents/skills              # симлинк
└── .cursor/
    ├── rules/
    │   └── project-rules.mdc                    # тонкий указатель -> AGENTS.md
    └── skills -> ../.agents/skills              # симлинк
```

Корневые файлы (`CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`)
присутствуют в структуре только если они существовали до инициализации и были
заменены тонкими указателями. Новые корневые файлы не создаются.

## Ограничения

Скилл инициализирует только рутовую папку проекта. Для поддиректорий с собственными
правилами (например `src/ui/`) и standalone-режима поддиректорий -- см. конвенцию
[agents-conventions](../agents-conventions/SKILL.md), секции "Поддиректории с правилами"
и "Standalone-режим поддиректории".

## Использование

Скилл выполняет все операции автоматически. Запустить для инициализации нового
проекта или проверки/исправления существующей структуры.
