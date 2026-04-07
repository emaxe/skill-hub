# Спецификация: AGENTS-CONVENTIONS Mode

## Контекст

Skill-hub CLI поддерживает три AI-агента (Claude Code, Cursor, Copilot), каждый со своей системой хранения расширений. Конвенция **agents-conventions** предлагает единую структуру `.agents/` как source of truth, где скиллы и правила хранятся один раз и доступны всем агентам через симлинки и тонкие указатели.

Текущая архитектура skill-hub устанавливает расширения только для одного выбранного агента. Новый режим `agents-conventions` позволит устанавливать расширения в единую `.agents/` директорию проекта, делая их доступными сразу всем поддерживаемым агентам.

Режим работает **только в project scope** — глобальная установка остаётся без изменений.

## Требования

### REQ-1: Новое значение AgentName
Добавить `'agents-conventions'` в тип `AgentName`. Все места, зависящие от AgentName (конфиг, CLI-опции, TUI, MCP), должны корректно обрабатывать новое значение.

### REQ-2: Адаптер AgentsConventionsAdapter
Создать `cli/src/adapters/agents-conventions.ts`, реализующий `AgentAdapter`:
- `agentName = 'agents-conventions'`
- `getInstallPath(ext, scope)`:
  - `scope === 'global'` → throw Error
  - `skill` → `./.agents/skills/{name}/SKILL.md`
  - `agent | command | rule` → `./.agents/rules/{name}.md`
- `getSourceFile(ext)`: использовать логику claude-code (SKILL.md / AGENT.md / COMMAND.md)
- `install()`: копирование source-файла в `.agents/`
- `remove()`: удаление из `.agents/`
- `scanInstalled()`: сканирование `.agents/skills/` (тип skill) и `.agents/rules/` (тип rule), только project scope
- `isInstalled()`: проверка существования файла

### REQ-3: Команда `agents-conventions enable`
CLI-команда `skill-hub agents-conventions enable`:
1. Проверка: если уже активен → exit с сообщением
2. Создание директорий: `.agents/skills/`, `.agents/rules/`, `.claude/`, `.github/instructions/`, `.cursor/rules/`
3. Создание симлинков (идемпотентно):
   - `.claude/skills → ../.agents/skills`
   - `.github/skills → ../.agents/skills`
   - `.cursor/skills → ../.agents/skills`
   - Если `.{agent}/skills/` — обычная директория: мигрировать содержимое в `.agents/skills/`, удалить директорию, создать симлинк
4. Создание тонких указателей (если не существуют):
   - `.claude/CLAUDE.md` → указатель на AGENTS.md
   - `.github/instructions/project-rules.instructions.md`
   - `.cursor/rules/project-rules.mdc`
5. Миграция skill-hub расширений (project scope) из installed.json:
   - Копирование файлов в `.agents/skills/` или `.agents/rules/`
   - Удаление старых файлов (если не симлинк)
   - Обновление installed.json: agent → 'agents-conventions', path → новый
6. Обновление конфига: `agent → 'agents-conventions'`
7. Установка скиллов `agents-conventions` + `init-agents` из каталога
8. Вывод инструкции для пользователя: запустить AI-агента для выполнения init-agents

### REQ-4: Команда `agents-conventions disable`
CLI-команда `skill-hub agents-conventions disable`:
1. Проверка: если не активен → exit с сообщением
2. Запросить целевой агент (claude-code/cursor/copilot)
3. Миграция skill-hub расширений обратно в папку целевого агента
4. Удаление симлинков (`.claude/skills`, `.github/skills`, `.cursor/skills`)
5. Удаление тонких указателей, созданных CLI
6. Удаление скиллов agents-conventions и init-agents из `.agents/`
7. Предложить удаление `.agents/` и `AGENTS.md` (с подтверждением пользователя)
8. Обновление конфига: `agent → целевой агент`

### REQ-5: Команда `agents-conventions status`
Показать: активен ли режим, наличие структуры `.agents/`, симлинков, указателей, количество расширений.

### REQ-6: Запрет --global
При `agent = 'agents-conventions'` флаг `--global` в командах install, remove, move → ошибка: «agents-conventions поддерживает только project scope».

### REQ-7: Адаптация существующих команд
- **install**: при agents-conventions использовать новый адаптер, source-файл по логике claude-code
- **remove**: удалять из `.agents/`
- **list**: показывать расширения из `.agents/`, scope=project
- **search**: фильтровать по наличию claude-code платформы (т.к. используются те же source-файлы)
- **move**: `--to-global` → ошибка
- **update**: обновлять расширения на месте в `.agents/`

### REQ-8: TUI — тоггл в Settings
Добавить в SettingsScreen тоггл «AGENTS-CONVENTIONS mode»:
- Показывать текущий статус (активен/неактивен)
- При включении → процесс enable (REQ-3)
- При выключении → процесс disable (REQ-4)

### REQ-9: MCP — поддержка нового адаптера
Все MCP-инструменты (install_extension, remove_extension, list_extensions, suggest_extensions) должны корректно работать с agent='agents-conventions'.

### REQ-10: Регистрация в getAdapter
`cli/src/adapters/get-adapter.ts` должен возвращать `AgentsConventionsAdapter` при `agent === 'agents-conventions'`.

## Ограничения

- **Только project scope:** agents-conventions НЕ поддерживает глобальную установку. Глобальные расширения остаются в управлении конкретного агента.
- **AGENTS.md — зона AI-агента:** CLI не создаёт и не редактирует AGENTS.md. Это делает скилл init-agents, выполняемый AI-агентом.
- **Каталог не меняется:** Не добавляем `agents-conventions` в platforms каталога. Используем source-файлы от claude-code.
- **Не автодетект:** detect-agent.ts не определяет agents-conventions автоматически. Только ручное включение.
- **Совместимость расширений:** Расширения без claude-code платформы не могут быть установлены в режиме agents-conventions.
- **Миграция только skill-hub расширений:** При enable/disable мигрируются только расширения из installed.json. Пользовательские файлы не трогаются.

## Макеты и референсы

> не применимо (CLI/TUI, визуальных макетов нет)

## Кодстайл и конвенции

- TypeScript, строгая типизация
- Следовать паттернам существующих адаптеров (claude-code.ts как образец)
- Именование: `AgentsConventionsAdapter`, файл `agents-conventions.ts`
- Ошибки на русском языке (как в существующих командах)
- Использовать `ora` для spinner, `chalk` для цветного вывода
- Commander для CLI-команд
- Ink/React для TUI-компонентов

## Переиспользуемые решения

| Компонент | Путь | Что использовать |
|-----------|------|-----------------|
| Базовый адаптер | `cli/src/adapters/claude-code.ts` | Образец для нового адаптера (структура, scanInstalled, install/remove) |
| Интерфейс адаптера | `cli/src/adapters/types.ts` | AgentAdapter, ScanResult |
| Фабрика адаптеров | `cli/src/adapters/get-adapter.ts` | Добавить agents-conventions |
| Тип AgentName | `cli/src/catalog.ts` | Расширить тип |
| Конфиг | `cli/src/config.ts` | SkillHubConfig — agent принимает новое значение |
| Реестр | `cli/src/registry.ts` | createRegistry — обновление записей при миграции |
| Команда install | `cli/src/commands/install.ts` | Образец структуры CLI-команды |
| TUI Settings | `cli/src/tui/screens/SettingsScreen.tsx` | Добавить тоггл |
| MCP | `cli/src/mcp.ts` | Адаптировать вызовы |
| Base setup | `cli/src/base-setup.ts` | Установка скиллов conventions из каталога |

## Критерии приёмки

- [ ] `skill-hub agents-conventions enable` создаёт `.agents/`, симлинки, указатели, мигрирует расширения
- [ ] `skill-hub agents-conventions disable` мигрирует обратно, удаляет симлинки, предлагает очистку
- [ ] `skill-hub agents-conventions status` показывает корректное состояние
- [ ] `skill-hub install some-skill` при активном режиме устанавливает в `.agents/skills/`
- [ ] `skill-hub install --global` при активном режиме → ошибка
- [ ] `skill-hub remove some-skill` при активном режиме удаляет из `.agents/`
- [ ] `skill-hub list` при активном режиме показывает расширения из `.agents/`
- [ ] TUI Settings отображает тоггл и позволяет включить/выключить
- [ ] MCP-инструменты работают корректно с agents-conventions
- [ ] Симлинки корректны: `.claude/skills/` → `../.agents/skills`
- [ ] При enable с существующими расширениями — миграция без потери данных
- [ ] При disable — обратная миграция без потери данных
- [ ] Скиллы agents-conventions и init-agents устанавливаются при enable
- [ ] `npm run build` завершается без ошибок

## Затронутые файлы

### Новые файлы
- `cli/src/adapters/agents-conventions.ts` — новый адаптер
- `cli/src/commands/agents-conventions.ts` — CLI-команда enable/disable/status

### Модифицируемые файлы
- `cli/src/catalog.ts` — AgentName: добавить 'agents-conventions'
- `cli/src/adapters/types.ts` — если нужны изменения в ScanResult
- `cli/src/adapters/get-adapter.ts` — добавить case для agents-conventions
- `cli/src/config.ts` — AgentName compat (если используется свой тип)
- `cli/src/commands/install.ts` — проверка --global при agents-conventions
- `cli/src/commands/remove.ts` — проверка --global
- `cli/src/commands/move.ts` — проверка --to-global
- `cli/src/commands/list.ts` — поддержка agents-conventions в фильтрации
- `cli/src/mcp.ts` — поддержка нового агента
- `cli/src/tui/screens/SettingsScreen.tsx` — тоггл режима
- `cli/src/tui/hooks/useRegistry.ts` — если нужна адаптация
- `cli/src/index.ts` или `cli/src/cli.ts` — регистрация новой команды
