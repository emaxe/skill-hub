---
name: init-agents
description: Initialize or verify agent configuration structure. Creates symlinks, thin pointers, AGENTS.md, migrates skills and root AI-agent config files. Most steps are handled programmatically by CLI — AI is only needed for auto-analysis when no root configs exist. | Инициализация или проверка структуры конфигурации агентов. Большинство шагов выполняется программно через CLI — AI нужен только для автоанализа проекта при отсутствии корневых конфигов.
---

# Инициализация структуры агентов

> **Примечание:** Большинство шагов этого скилла теперь выполняется программно через CLI
> (`enableConventions()` в `conventions.ts`). AI-агент вызывается только для автоанализа
> проекта (шаг 2b), когда корневые конфиги ИИ-агентов не найдены.

## Что делает CLI автоматически

- Создание директорий `.agents/rules/`, `.agents/skills/`, `.agents/agents/`, `.agents/commands/`, `.claude/`, `.github/instructions/`, `.cursor/rules/`
- Миграция корневых файлов ИИ-агентов (`CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`) в `.agents/rules/project-rules.md`
- Замена оригиналов тонкими указателями
- Создание симлинков из `.claude/skills`, `.github/skills`, `.cursor/skills` на `.agents/skills`
- Создание тонких указателей для Copilot, Cursor, Claude Code
- Создание `AGENTS.md` из шаблона
- Миграция skill-hub расширений
- **Программная генерация `project-rules.md`** по метаданным проекта (package.json, requirements.txt, go.mod и т.д.) — если корневых конфигов нет, CLI пытается определить стек, структуру и ключевые команды без AI

## Что делает AI-агент (только автоанализ)

Если CLI не смог определить стек проекта программно (нет ни корневых файлов ИИ-агентов,
ни package.json/requirements.txt/go.mod/Cargo.toml/Gemfile), AI анализирует проект
и создаёт `.agents/rules/project-rules.md` с базовым описанием.

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

Заполнить только то, что удалось определить. Не угадывать — если информации нет, 
не включать секцию. Создать только файл `.agents/rules/project-rules.md`.
