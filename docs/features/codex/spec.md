# Спецификация: Подключение Codex

## Контекст

OpenAI Codex — CLI-агент, использующий файл `AGENTS.md` для хранения инструкций (аналог `CLAUDE.md` для Claude Code). Файл может находиться в нескольких местах иерархии, но для skill-hub достаточно двух scope-уровней:
- **Global:** `~/.codex/AGENTS.md`
- **Project:** `.codex/AGENTS.md` (в корне проекта)

Skill-hub уже поддерживает 4 агента (`claude-code`, `cursor`, `copilot`, `agents-conventions`). Codex станет пятым. Архитектурно Codex ближе всего к Copilot — оба работают через единый файл с инъекцией контента через HTML-маркеры, а не через директории с отдельными файлами.

**Решение по project scope:** `.codex/AGENTS.md` (а не `AGENTS.md` в корне), чтобы не конфликтовать с режимом `agents-conventions`, который использует корневой `AGENTS.md`.

**Решение по platformKey:** `platformKey('codex')` возвращает `'claude-code'` — все существующие расширения каталога сразу доступны для codex (аналогично `agents-conventions`).

## Требования

- **REQ-1:** Добавить `'codex'` в union-тип `AgentName` (`catalog.ts`).
- **REQ-2:** Обновить `platformKey()` — для `'codex'` возвращать `'claude-code'` (фаллбэк на claude-code source-файлы).
- **REQ-3:** Создать `CodexAdapter` (`adapters/codex.ts`), реализующий интерфейс `AgentAdapter`. Стратегия — инъекция через HTML-маркеры (как `CopilotAdapter`):
  - Маркеры: `<!-- skill-hub: {name} -->` / `<!-- /skill-hub: {name} -->`
  - Global path: `~/.codex/AGENTS.md`
  - Project path: `{projectDir}/.codex/AGENTS.md`
  - `getSourceFile()` — fallback на `'SKILL.md'` (через `platformKey` → `claude-code`)
  - `install()` — `stripFrontmatter()` + инъекция секции с маркерами
  - `remove()` — вырезать секцию по маркерам (indexOf)
  - `isInstalled()` — проверить наличие start-маркера в файле
  - `scanInstalled()` — regex-поиск маркеров в обоих файлах (global + project)
- **REQ-4:** Зарегистрировать `CodexAdapter` в фабрике `getAdapter()` (`adapters/get-adapter.ts`).
- **REQ-5:** Добавить автодетекцию Codex в `detectAgent()` (`detect-agent.ts`):
  - `CODEX_SANDBOX` env var → `'codex'` (из [openai/codex spawn.rs](https://github.com/openai/codex/blob/main/codex-rs/core/src/spawn.rs))
  - `CODEX_SANDBOX_NETWORK_DISABLED` env var → `'codex'`
  - `.codex/` директория в CWD → `'codex'`
  - Приоритет: после copilot, до fallback на claude-code
- **REQ-6:** Обновить `DEFAULT_CONFIG` (`config.ts`): добавить `'codex': { enabled: false, useProxy: false }` в `aiAgents.agents`.
- **REQ-7:** Добавить `'.codex'` в `AGENT_SCOPE_MARKERS` (`config.ts`) для корректного определения корня проекта.
- **REQ-8:** Обновить MCP-сервер (`mcp.ts`): добавить `'codex'` в enum всех 7 инструментов.
- **REQ-9:** Обновить CLI (`index.ts`): справочные тексты, описания `--agent` опций.
- **REQ-10:** Обновить все команды (`commands/*.ts`): тексты `--agent` опций (search, install, remove, list, move, update, info, agents-conventions).
- **REQ-11:** Обновить TUI:
  - `SettingsScreen.tsx` — `AGENTS` и `AI_AGENTS` массивы
  - `InstalledScreen.tsx` — `AgentFilter` и `AGENT_FILTERS`
  - `useRegistry.ts` — `realAgents` массив
  - `AiAgentsTab.tsx` — `AI_AGENTS` массив
- **REQ-12:** Обновить conventions:
  - `conventions.ts` — добавить symlinks для `.codex/` → `.agents/` + thin pointer для `.codex/AGENTS.md`
  - `SYMLINK_TARGETS` — добавить записи для `.codex`
  - `ROOT_AI_CONFIGS` — добавить запись для `.codex/AGENTS.md` с pointer на `AGENTS.md`
  - `commands/agents-conventions.ts` — обновить валидацию и тексты
- **REQ-13:** Создать bootstrap-скилл `base-skills/codex/SKILL.md` по аналогии с `base-skills/copilot/SKILL.md`.
- **REQ-14:** Написать unit-тесты для `CodexAdapter` (`adapters/codex.test.ts`): install, remove, isInstalled, scanInstalled для обоих scope.
- **REQ-15:** Добавить тесты детекции Codex в `detect-agent.test.ts`.
- **REQ-16:** Обновить документацию `CLAUDE.md`: таблицы агентов, директории scope, архитектура.

## Ограничения

- **НЕ входит в скоуп:** создание отдельного формата source-файлов для codex (используются claude-code файлы через platformKey).
- **НЕ входит в скоуп:** поддержка вложенных `AGENTS.md` на нескольких уровнях иерархии (только global + project).
- **НЕ входит в скоуп:** прямая интеграция с API Codex (только файловая система).
- Codex sandbox может работать без сети (`CODEX_SANDBOX_NETWORK_DISABLED=1`) — `install` из каталога требует доступ к git-кешу, который должен быть подготовлен заранее.

## Макеты и референсы

> Не применимо (CLI/TUI, без визуальных макетов).

## Кодстайл и конвенции

1. **JSDoc на русском** для экспортируемых интерфейсов и функций (см. существующие адаптеры).
2. **Ink/React:** никогда `{stringVar && <Component>}` — только тернарный оператор.
3. **normalizeInput()** (`keymap.ts`) — все хоткеи через этот маппинг.
4. **Паттерн адаптера:** конструктор принимает `projectDir` и `homeDir` для тестируемости (как `CopilotAdapter`).
5. **Тесты:** tmpdir для изоляции, beforeEach/afterEach для setup/cleanup (паттерн из `copilot.test.ts`).
6. **Версии в sync:** bump `package.json` → обновить в `index.ts` и `mcp.ts`.
7. **stripFrontmatter()** из `../frontmatter` — использовать для удаления YAML frontmatter перед инъекцией.

## Переиспользуемые решения

| Компонент | Путь | Использование |
|-----------|------|---------------|
| `CopilotAdapter` | `cli/src/adapters/copilot.ts` | **Главный референс** — та же стратегия HTML-маркеров |
| `copilot.test.ts` | `cli/src/adapters/copilot.test.ts` | Образец тестов для marker-based адаптера |
| `stripFrontmatter()` | `cli/src/frontmatter.ts` | Удаление YAML frontmatter при install |
| `AgentAdapter` interface | `cli/src/adapters/types.ts` | Контракт для нового адаптера |
| `getAdapter()` | `cli/src/adapters/get-adapter.ts` | Фабрика — добавить кейс |
| `detectAgent()` | `cli/src/detect-agent.ts` | Детекция — добавить проверки |
| `SYMLINK_TARGETS` | `cli/src/conventions.ts:10-18` | Массив symlinks — добавить `.codex` |
| `ROOT_AI_CONFIGS` | `cli/src/conventions.ts:21-41` | Массив thin pointers — добавить `.codex/AGENTS.md` |
| `base-skills/copilot/SKILL.md` | `cli/base-skills/copilot/SKILL.md` | Образец bootstrap-скилла для codex |

## Критерии приёмки

1. `skill-hub search --agent codex` — показывает расширения (фаллбэк на claude-code каталог).
2. `skill-hub install <ext> --agent codex --scope project` — создаёт `.codex/AGENTS.md` с маркерами.
3. `skill-hub install <ext> --agent codex --scope global` — создаёт `~/.codex/AGENTS.md` с маркерами.
4. `skill-hub remove <ext> --agent codex` — удаляет секцию из `AGENTS.md`, файл не удаляется если остались другие секции.
5. `skill-hub list --agent codex` — показывает установленные расширения обоих scope.
6. Автодетекция: при `CODEX_SANDBOX=seatbelt` → agent определяется как `codex`.
7. Автодетекция: при наличии `.codex/` в CWD → agent определяется как `codex`.
8. TUI: codex доступен в настройках агента, в фильтрах установленных, в AI Agents вкладке.
9. MCP: все 7 инструментов принимают `'codex'` как значение параметра `agent`.
10. Conventions: `agents-conventions enable` при codex создаёт symlinks `.codex/` → `.agents/`.
11. Все существующие тесты проходят (`npm test`).
12. Новые тесты для `CodexAdapter` и детекции проходят.

## Отклонения от плана

Незначительные:
- Описание пакета в `package.json` и CLI-описание в `index.ts` (строка 82) не обновлены — по-прежнему содержат «(Claude Code, Cursor, Copilot)» без Codex. Функциональность не затронута.
- Версии в `index.ts` и `mcp.ts` (0.1.7) не синхронизированы с `package.json` (0.1.11) — pre-existing issue, не относится к фиче.

## Затронутые файлы

### Новые файлы
| Файл | Описание |
|------|----------|
| `cli/src/adapters/codex.ts` | `CodexAdapter` — адаптер для Codex |
| `cli/src/adapters/codex.test.ts` | Unit-тесты адаптера |
| `cli/base-skills/codex/SKILL.md` | Bootstrap-скилл для Codex |

### Изменяемые файлы (ядро)
| Файл | Что изменить |
|------|-------------|
| `cli/src/catalog.ts` | `AgentName` + `platformKey()` |
| `cli/src/detect-agent.ts` | Детекция по env vars + `.codex/` |
| `cli/src/detect-agent.test.ts` | Тесты детекции codex |
| `cli/src/config.ts` | `DEFAULT_CONFIG.aiAgents.agents` + `AGENT_SCOPE_MARKERS` |
| `cli/src/adapters/get-adapter.ts` | Фабрика — кейс `'codex'` |

### Изменяемые файлы (CLI/MCP)
| Файл | Что изменить |
|------|-------------|
| `cli/src/mcp.ts` | enum во всех 7 инструментах |
| `cli/src/index.ts` | Справочные тексты |
| `cli/src/commands/search.ts` | Текст `--agent` |
| `cli/src/commands/install.ts` | Текст `--agent` |
| `cli/src/commands/remove.ts` | Текст `--agent` |
| `cli/src/commands/list.ts` | Текст `--agent` |
| `cli/src/commands/move.ts` | Текст `--agent` |
| `cli/src/commands/update.ts` | Текст `--agent` |
| `cli/src/commands/info.ts` | Текст `--agent` |
| `cli/src/commands/agents-conventions.ts` | Допустимые значения агента |

### Изменяемые файлы (TUI)
| Файл | Что изменить |
|------|-------------|
| `cli/src/tui/screens/SettingsScreen.tsx` | `AGENTS`, `AI_AGENTS` массивы |
| `cli/src/tui/screens/InstalledScreen.tsx` | `AgentFilter`, `AGENT_FILTERS` |
| `cli/src/tui/hooks/useRegistry.ts` | `realAgents` массив |
| `cli/src/tui/screens/settings/AiAgentsTab.tsx` | `AI_AGENTS` массив |

### Изменяемые файлы (Conventions)
| Файл | Что изменить |
|------|-------------|
| `cli/src/conventions.ts` | `SYMLINK_TARGETS` + `ROOT_AI_CONFIGS` + валидация |

### Документация
| Файл | Что изменить |
|------|-------------|
| `CLAUDE.md` | Таблицы агентов, директории, архитектура |
