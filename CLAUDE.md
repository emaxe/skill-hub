# CLAUDE.md

Инструкции для AI-агентов (Claude Code, Cursor, Copilot, Codex) при работе с кодом этого репозитория.

## Обзор проекта

Skill-Hub — менеджер расширений для AI-агентов (Claude Code, Cursor, Copilot, Codex). CLI + MCP-сервер для поиска, установки и управления переиспользуемыми **skills**, **agents** и **commands**.

| Репозиторий | Содержимое |
|-------------|-----------|
| `skill-hub` (этот) | `cli/` — TypeScript CLI + MCP-сервер; `cli/base-skills/` — бутстрап-скиллы |
| `skill-hub-catalog` | `skills/`, `agents/`, `commands/`, `schema/`, `catalog.json` |

**Npm-пакет:** `@emaxe/skill-hub` (version 0.1.11)
**Node:** ≥18

## Команды разработки

```bash
cd cli && npm run build          # сборка (tsc)
cd cli && npm test               # Jest-тесты (127 тестов)
npm link                         # глобальная линковка для локального тестирования
npm unlink -g @emaxe/skill-hub   # удалить линк
skill-hub search git             # проверить CLI
```

## Структура файлов

```
cli/
├── src/
│   ├── index.ts              # Точка входа CLI (Commander). 9 команд + TUI
│   ├── mcp.ts                # MCP-сервер (7 инструментов)
│   ├── mcp-entry.ts          # Отдельная точка входа для MCP
│   ├── catalog.ts            # Типы Extension, AgentName, loadCatalog(), scoreExtensions()
│   ├── multi-file.ts         # Утилиты многофайловых расширений: copyExtensionDir(), hasAdditionalFiles()
│   ├── config.ts             # Двухуровневый конфиг: global + project
│   ├── registry.ts           # Реестр установленных расширений (registry.json)
│   ├── git.ts                # Git-операции: clone, pull, cache management
│   ├── upload.ts             # Загрузка расширений в каталог (git push + PR URL)
│   ├── sync.ts               # Синхронизация расширений: missing/untracked detection
│   ├── gitignore-agents.ts   # Добавление/удаление папок ИИ-агентов в/из .gitignore
│   ├── conventions.ts        # Режим agents-conventions: init/exit/health
│   ├── platform.ts           # Платформенный хелпер: isWindows, isMac, isLinux, getAppData()
│   ├── agent-launcher.ts     # Запуск AI-агентов: exec (-a) и script (-A) режимы
│   ├── detect-agent.ts       # Автодетекция агента по env vars / директориям
│   ├── keymap.ts             # Нормализация русской раскладки → латинская для хоткеев
│   ├── adapters/             # Адаптеры агентов (claude-code, cursor, copilot, codex, conventions)
│   │   ├── types.ts          # AgentAdapter interface, ScanResult
│   │   ├── get-adapter.ts    # Фабрика адаптеров по имени агента
│   │   ├── claude-code.ts
│   │   ├── cursor.ts
│   │   ├── copilot.ts
│   │   ├── codex.ts
│   │   └── agents-conventions.ts
│   ├── commands/             # CLI-команды (search, install, remove, list, info, gitignore-agent-dirs, ...)
│   └── tui/                  # Интерактивный TUI (Ink/React)
│       ├── index.ts          # renderApp() — точка входа TUI
│       ├── App.tsx           # Корневой компонент (~600 строк)
│       ├── theme.ts          # Цветовая тема
│       ├── keymap.ts         # normalizeInput(), isCtrl()
│       ├── contexts/
│       │   └── StatusContext.tsx  # Глобальная статусная строка
│       ├── hooks/
│       │   ├── useRegistry.ts     # Центральный стейт расширений
│       │   ├── useCatalog.ts      # Поиск по каталогу
│       │   ├── useSettings.ts     # Настройки + персистенция
│       │   ├── useNavigation.ts   # Screen stack navigation
│       │   ├── useBaseSetup.ts    # MCP/base-skill setup status
│       │   ├── useUploadAccess.ts # Async проверка write-доступа к каталогу
│       │   ├── useTerminalSize.ts # Размер терминала + debounced resize
│       │   ├── useLayout.ts       # Адаптивная раскладка: breakpoint, конфиг колонок, флаги видимости
│       │   ├── useConventionsInit.ts  # Init conventions flow (dynamic paths)
│       │   ├── useConventionsExit.ts  # Exit conventions flow (dynamic paths)
│       │   └── useKeymap.ts       # Хоткеи per-screen
│       ├── screens/
│       │   ├── CatalogScreen.tsx        # Таб «Каталог» — поиск, фильтры, установка
│       │   ├── InstalledScreen.tsx       # Таб «Установленные» — список, удаление, обновление
│       │   ├── SettingsScreen.tsx        # Таб «Настройки» — конфигурация, подвкладки; при сохранении автоматически применяет изменения gitignoreAgentDirs к .gitignore
│       │   ├── DetailScreen.tsx          # Карточка расширения из каталога
│       │   ├── InstalledDetailScreen.tsx # Карточка установленного расширения
│       │   ├── MoveScreen.tsx            # Перемещение global ↔ project
│       │   ├── ContentScreen.tsx         # Просмотр содержимого файла
│       │   ├── UploadScreen.tsx          # Загрузка расширений в каталог
│       │   └── settings/                # Подкомпоненты SettingsScreen
│       └── components/
│           ├── HintBar.tsx              # Полоска хоткеев внизу
│           ├── ExtensionList.tsx        # Таблица расширений
│           ├── ExtensionSyncDialog.tsx  # Диалог синхронизации расширений
│           ├── Confirm.tsx              # Подтверждение действия (y/n)
│           ├── ScrollableBox.tsx        # Прокрутка списков
│           ├── SearchInput.tsx          # Поле поиска
│           ├── FilterBar.tsx            # Фильтры (тип, скоуп)
│           ├── TextEditModal.tsx        # Редактирование длинных строк (URL, proxy)
│           ├── InitConventionsModal.tsx # Модалка включения conventions
│           ├── ExitConventionsModal.tsx # Модалка выключения conventions
│           ├── ConventionsWarningDialog.tsx # Предупреждения conventions health
│           ├── GitCredentialsDialog.tsx    # Диалог git-аутентификации
│           ├── ProjectConfigDialog.tsx    # Диалог создания проектного конфига
│           ├── ProjectConflictDialog.tsx  # Конфликт расширений между проектами
│           ├── AgentDirsGitignoreDialog.tsx # Диалог добавления папок агентов в .gitignore
│           ├── CatalogUpdateDialog.tsx      # Диалог обновления каталога при старте
│           ├── ExtensionUpdatesDialog.tsx   # Диалог доступных обновлений расширений
│           ├── SelfUpdateDialog.tsx         # Диалог обновления base-skill и MCP
│           ├── Header.tsx                 # Заголовок приложения
│           ├── InfoBar.tsx                # Информационная панель
│           ├── StatusBar.tsx              # Строка статуса
│           ├── SubTabBar.tsx              # Подвкладки
│           └── Separator.tsx              # Визуальный разделитель
├── base-skills/              # Бутстрап-скиллы для каждого агента
└── dist/                     # Скомпилированный JS
```

## Архитектура

### Потоки данных

```
Пользователь → CLI (Commander) → Команда (commands/*.ts) → Adapter → Файловая система
                │
                └→ TUI (Ink/React) → Hooks → Registry/Catalog/Config → Adapter → ФС
                │
                └→ MCP Server → 7 tools → Adapter → ФС

Каталог: GitHub/GitLab repo → git clone → ~/.skill-hub/ (кеш) → catalog.json (индекс)
```

### Система конфигурации

**Два уровня:**
- **Глобальный:** `~/.skill-hub/config.json`
- **Проектный:** два файла в корне проекта:
  - `.skill-hub.json` — **публичный** (коммитится в git): `registryUrl`, `project`, `gitignoreAgentDirs`, `extensions`
  - `.skill-hub.local.json` — **локальный** (в `.gitignore`): `agent`, `defaultScope`, `aiAgents`, `history`

Проектный конфиг переопределяет глобальный. Поиск проектного конфига: `config.ts → findProjectRoot()` — поднимается от CWD вверх, ищет `.skill-hub.json` или `.git`.

При первом обращении автоматически:
- мигрирует старый формат (единый `.skill-hub.json` с обёрткой `settings`) в два файла
- создаёт `.skill-hub.local.json` из глобального конфига если отсутствует
- добавляет `.skill-hub.local.json` в `.gitignore`

```typescript
interface SkillHubConfig {
  agent: 'claude-code' | 'cursor' | 'copilot' | 'codex' | 'agents-conventions';
  defaultScope: 'global' | 'project';
  registryUrl: string;          // URL git-репозитория каталога
  project?: string;             // Имя текущего проекта
  aiAgents: {
    proxy: string;              // Общий прокси-URL
    agents: Record<AgentName, { enabled: boolean; useProxy: boolean }>;
  };
  history?: {
    registryUrl: string[];      // Последние 6 URL
    proxy: string[];            // Последние 6 прокси
  };
}
```

**Проектный конфиг — публичная часть** (`.skill-hub.json`):
```json
{
  "registryUrl": "https://github.com/emaxe/skill-hub-catalog.git",
  "project": "my-project",
  "gitignoreAgentDirs": true,
  "extensions": [
    { "type": "skill", "name": "git-commit-and-push", "version": "1.0.0", "scope": "project" }
  ]
}
```

**Проектный конфиг — локальная часть** (`.skill-hub.local.json`):
```json
{
  "agent": "claude-code",
  "defaultScope": "project",
  "aiAgents": { "proxy": "", "agents": { ... } },
  "history": { "registryUrl": [], "proxy": [] }
}
```

### Адаптеры агентов

Интерфейс `AgentAdapter` (`adapters/types.ts`):

| Метод | Назначение |
|-------|-----------|
| `install(ext, scope)` | Копировать файлы расширения в целевую директорию |
| `remove(ext, scope)` | Удалить файлы расширения |
| `scanInstalled()` | Сканировать диск, найти все установленные расширения |
| `getExtensionPath(ext, scope)` | Путь к установленному расширению |

**Директории скоупов:**

| Агент | Global | Project |
|-------|--------|---------|
| Claude Code | `~/.claude/skills/{name}/SKILL.md` | `.claude/skills/{name}/SKILL.md` |
| Cursor | `~/.cursor/skills/{name}/SKILL.md` | `.cursor/skills/{name}/SKILL.md` |
| Copilot | `~/.config/Code/User/copilot-instructions.md` | `.github/copilot-instructions.md` |
| Codex | `~/.codex/AGENTS.md` | `.codex/AGENTS.md` |
| agents-conventions | — | `.agents/skills/{name}/SKILL.md` |

**Автодетекция** (`detect-agent.ts`): env vars (`CURSOR_TRACE` → cursor, `GITHUB_COPILOT` → copilot, `CODEX_SANDBOX` → codex) → наличие `.cursor/` → наличие `.codex/` → default `claude-code`.

### Многофайловые расширения

Расширения (особенно скиллы) могут содержать дополнительные файлы помимо основного `.md` — скрипты, шаблоны, конфигурации. Модуль `multi-file.ts` содержит утилиты:

- `getExtensionDirRel(extPath)` — вычисляет путь к директории из `ext.path` (обратная совместимость: поддерживает и путь к файлу `skills/name/SKILL.md`, и к директории `skills/name`)
- `copyExtensionDir(src, dest, ignore?)` — рекурсивное копирование, пропуская `.skillignore` и symlinks
- `copyAdditionalFiles(srcDir, destDir, mainFile)` — копирование всего кроме основного `.md`
- `hasAdditionalFiles(extPath, cachePath)` — проверка наличия доп. файлов
- `listExtensionFiles(extPath, cachePath, mainFile?)` — список доп. файлов (относительные пути)
- `findBinaryFiles(dir)` — обнаружение бинарных файлов (запрещены для upload)
- `getExtensionDirSize(dir)` — суммарный размер (лимит: 1 МБ)

**Поведение по адаптерам:**

| Адаптер | Скиллы | Агенты/Команды |
|---------|--------|----------------|
| Claude Code, conventions | `copyExtensionDir()` — вся директория | Один файл (как раньше) |
| Cursor | Основной `.md` + Cursor frontmatter, доп. файлы as-is | Один файл |
| Copilot | Marker-injection + доп. файлы в `.github/skills/{name}/` | Marker-injection |
| Codex | Marker-injection + доп. файлы в `.codex/skills/{name}/` | Marker-injection |

**Поле `files` в `Extension`:** опциональный массив строк — относительные пути доп. файлов. Заполняется при `buildCatalogEntry()`. Отсутствие = однофайловое расширение.

### Кеш каталога

- **Путь:** `~/.skill-hub/` (git-клон каталога)
- `ensureCache()` — clone если нет, pull если нет catalog.json
- `updateCache()` — `git pull --ff-only`
- `resetCache()` — удалить весь кеш (при смене registryUrl)
- `fullCatalogReset()` — resetCache + очистка списка расширений в проектном конфиге

### Upload в каталог

Полный flow (`upload.ts`):
1. `checkCatalogWriteAccess()` — `git push --dry-run` в кеш-директории
2. `getUploadCandidates()` — расширения установленные, но не в каталоге
3. `validateExtensionsForUpload()` — файл существует, frontmatter полный, имя в kebab-case
4. `uploadExtensions()` — checkout main → create branch → copy files → update catalog.json → commit → push
5. `generatePrUrl()` — URL для создания PR/MR (GitHub/GitLab)
6. Открытие в браузере через `spawn('open', [url])`

**Важно:** в `finally` всегда `git checkout main` чтобы не сломать кеш для остального CLI.

### Синхронизация расширений

При старте TUI (`sync.ts → checkExtensionSync()`):
1. Загрузить `extensions` из публичного проектного конфига (`.skill-hub.json`)
2. Сканировать диск через адаптер
3. **Missing** — в конфиге, но не на диске → предложить установить
4. **Untracked** — на диске, но не в конфиге → предложить добавить в конфиг или загрузить в каталог

### Conventions Mode

Унифицированная `.agents/` директория для мультиагентных проектов:
- `conventions.ts → initConventions()` — создать `.agents/`, symlinks, `AGENTS.md`
- `conventions.ts → exitConventions()` — мигрировать расширения обратно, удалить symlinks, `removeAgentsConventionsGlobal()`
- `conventions.ts → ensureConventionsStructure()` — идемпотентное восстановление: dirs, symlinks, pointers, bootstrap, AGENTS.md
- Health check: `.agents/` exists, `AGENTS.md` exists, symlinks valid
- `generateProjectRules()` — автоанализ проекта (package.json, go.mod, etc.)

**Bootstrap-скиллы:**
- `agents-conventions` → глобально во все AI-агенты: `~/.claude/skills/`, `~/.cursor/skills/` (копия), copilot/codex (marker-injection). Без registry.
- `init-agents`, `exit-agents` → `~/.skill-hub/bootstrap/{name}/` (глобальные, без registry — системные файлы, общие для всех проектов)

**Symlink targets (`SYMLINK_TARGETS`):** `.claude/skills`, `.cursor/skills`, `.codex/` → `.agents/`

**Thin pointers (`ROOT_AI_CONFIGS`):** `CLAUDE.md`, `.cursorrules`, `.github/copilot-instructions.md`, `.codex/AGENTS.md` → указывают на `AGENTS.md`

> **Важно для Windows:** при создании symlinks использовать стратегию `dir` → `junction` → fallback-копирование (через `conventions.ts`). Нельзя создавать `POSIX symlinks` напрямую.

## CLI: команды и флаги

| Команда | Описание |
|---------|----------|
| `search [query]` | Поиск по каталогу. Поддерживает `type:query` |
| `install [name]` | Установить расширение. `--scope`, `--agent`, `-y` (без подтверждения) |
| `remove [name]` | Удалить расширение |
| `move [name] [to]` | Переместить global ↔ project |
| `list [agent]` | Список установленных. `--type` |
| `info [name]` | Подробная информация |
| `update [name]` | Обновить одно или все (`-U`) |
| `config` | Управление конфигурацией: `set`, `get`, `reset` |
| `setup-mcp` | Зарегистрировать MCP-сервер для агента |
| `agents-conventions` | `enable` / `disable` режим conventions |
| `gitignore-agent-dirs` | `enable` / `disable` / `status` — настройка автодобавления папок агентов в `.gitignore` |
| `help` | Справка по всем командам |

**Специальные флаги:**
- `-a <agent> [args...]` — запуск AI-агента через exec
- `-A <agent> [args...]` — запуск через temp-скрипт
- `-u [name]` / `-U` — сокращения для `update`
- `--then` — цепочка двух команд

## MCP-сервер: 7 инструментов

| Tool | Назначение |
|------|-----------|
| `search_extensions` | Поиск. Параметры: query, agent, type, limit, offset |
| `install_extension` | Установка. Разрешает зависимости автоматически |
| `remove_extension` | Удаление. `delete_from_disk: false` — только из реестра |
| `move_extension` | Перемещение global ↔ project |
| `list_extensions` | Список установленных с фильтрами |
| `suggest_extensions` | Рекомендации на основе контекста проекта |
| `get_extension_info` | Полная информация + статус установки |

## TUI: архитектура

### Навигация

- **3 таба:** Каталог (`1`) / Установленные (`2`) / Настройки (`3`)
- **Screen stack:** `useNavigation` — push/pop вложенных экранов
- **Глобальные хоткеи:** `Tab` (таб), `1-3` (прямой выбор), `Ctrl+Q` (выход)

### Стартовая последовательность (App.tsx)

8 последовательных проверок при запуске TUI (с диалогами, пользователь может пропустить каждую):
1. **Update catalog** — `updateCache()`, git pull каталога; диалог с loading/error + кнопка Пропустить (Esc)
2. **Conventions health** — если agent=`agents-conventions`: проверить `.agents/`, symlinks; диалог с кнопкой `r → Восстановить` (`ensureConventionsStructure`)
3. **Project config** — предложить создать `.skill-hub.json` если глобальный конфиг, но есть проект
4. **Extension sync** — missing/untracked расширения (зависит от обновлённого каталога)
5. **Project conflicts** — расширения не для текущего проекта
6. **Extension updates** — расширения с устаревшими версиями; диалог со списком + Enter обновить / Esc пропустить (зависит от обновлённого каталога)
7. **Self update** — обновление base-skill/MCP если установлены; диалог + Enter обновить / Esc пропустить
8. **Agent dirs gitignore** — если `gitignoreAgentDirs=true`, предложить добавить отсутствующие папки агентов в `.gitignore`

**Зависимости между фазами:** `sync` (установка missing) и `updateExtensions` используют каталог → обе идут после `updateCatalog`. При пропуске/ошибке `updateCatalog` продолжают с кешированным каталогом. `selfUpdate` не зависит от каталога (источник — `base-skills/` в npm-пакете).

### Экраны (screens/)

| Экран | Хоткеи | Назначение |
|-------|--------|-----------|
| CatalogScreen | `/` поиск, `i` установить, `Enter` детали | Каталог расширений |
| InstalledScreen | `d` удалить, `m` переместить, `u` обновить, `U` все, `p` загрузить | Установленные |
| SettingsScreen | `Tab` подвкладки, `←→` значения, `Enter` действие | Настройки |
| UploadScreen | `Space` выбрать, `a` все, `s` scope, `b` ветка, `e` PR-заголовок | Загрузка в каталог |
| DetailScreen | `i` установить | Карточка расширения |
| InstalledDetailScreen | `d` удалить, `m` переместить, `u` обновить, `p` загрузить | Карточка установленного |
| ContentScreen | `Esc` назад | Просмотр содержимого |
| MoveScreen | `Enter` подтвердить | Перемещение скоупа |

### Компоненты (components/)

- **HintBar** — полоска подсказок внизу. `Hint = { key, description }`
- **ExtensionSyncDialog** — модальный диалог синхронизации. Спиннер проверки доступа → кнопка `[p]` загрузить
- **Confirm** — y/n подтверждение
- **ScrollableBox** — прокручиваемый список с автопрокруткой к activeIndex
- **TextEditModal** — редактирование длинных строк (URL, proxy) с историей

### Хуки (hooks/)

| Хук | Назначение |
|-----|-----------|
| `useRegistry` | CRUD операции с расширениями. Центральный стейт |
| `useCatalog` | Поиск по каталогу, фильтрация, пагинация |
| `useSettings` | Загрузка/сохранение конфига, resolveConfig() |
| `useNavigation` | Stack навигация: pushScreen, popScreen, currentScreen |
| `useBaseSetup` | Статус установки MCP/base-skill/self-update |
| `useUploadAccess` | Async проверка write-доступа к каталогу (кеш) |
| `useTerminalSize` | Размеры терминала с debounced resize |
| `useLayout` | Адаптивная раскладка: breakpoint (`compact/normal/wide`), конфиг колонок таблиц, флаги показа InfoBar/Separator |
| `useConventionsInit` | Init conventions flow: динамические пути к `~/.skill-hub/bootstrap/init-agents/` |
| `useConventionsExit` | Exit conventions flow: динамические пути к `~/.skill-hub/bootstrap/exit-agents/` |
| `useKeymap` | Хоткеи per-screen |

## Язык

- **Документация и контент расширений** — на русском
- **Идентификаторы, пути, технические термины** — на английском
- **JSDoc-комментарии** — на русском

## Стиль кода и паттерны

> ⚠️ **Все изменения в коде должны быть кроссплатформенными** — работать на macOS, Linux и Windows без условных веток по ОС в логике фичи. Любой платформо-специфичный код изолировать в `platform.ts`. Подробности — в разделе «Windows и кроссплатформенность» ниже.

### Общие правила

1. **Документация синхронизирована с кодом.** При добавлении/удалении CLI-команд, MCP-инструментов, полей конфига — обновлять CLAUDE.md и README.md.
2. **JSDoc на экспортируемых интерфейсах и функциях.** Текст на русском. Примеры: `config.ts` (заголовки секций), `keymap.ts`, `conventions.ts` (нумерованные шаги).
3. **Комментарии для неочевидной логики.** «Почему», а не «что». Скоринг, дедупликация, multi-step flows.
4. **Не переусердствовать.** Простые геттеры и self-documenting код не комментировать.
5. **Версии в sync.** Bump `package.json` → обновить строки в `index.ts` и `mcp.ts`.

### Адаптивный TUI (responsive layout)

TUI адаптируется к размеру терминала через хук `useLayout` (`hooks/useLayout.ts`). Все компоненты получают адаптивные параметры **через props** (не вызывают `useLayout` самостоятельно) — единственный источник данных в `App.tsx`.

**Breakpoints по ширине:**

| Breakpoint | Диапазон | Что меняется |
|-----------|---------|-------------|
| `compact` | < 80 кол. | Скрыты TAGS/PROJECT/SOURCE, короткие лейблы Header/FilterBar, компактный InfoBar |
| `normal` | 80–119 кол. | Стандартный вид |
| `wide` | ≥ 120 кол. | Расширенные колонки NAME/DESCRIPTION |

**По высоте:** при `rows < 16` — InfoBar и один Separator скрываются, `contentAreaHeight` пересчитывается (+3 строки для контента). `MIN_ROWS = 12`.

**Интерфейсы из `useLayout.ts`:** `Breakpoint`, `TableColumn`, `CatalogTableConfig`, `InstalledTableConfig`, `LayoutConfig`.

**Правила при добавлении новых компонентов:**
- Принимать `compact?: boolean`, `termColumns?: number`, `dialogWidth?: number` и подобные props
- Не импортировать `useLayout` напрямую в компонент — только через props из App.tsx
- Диалоги: использовать `dialogWidth ?? Math.min(58, stdout.columns - 12)` как fallback

### Ink/React паттерны

- **НИКОГДА** не использовать `{stringVar && <Component>}` — пустая строка `''` это truthy `false` value. Использовать тернарный: `{stringVar ? <Component> : null}`. Иначе Ink бросает `Text string "" must be rendered inside <Text>`.
- `false`, `null`, `undefined` безопасно возвращать из JSX. Пустая строка `''` — нет.
- Использовать `<ScrollableBox>` для списков переменной длины.
- `StatusContext` — единственный глобальный контекст. Тип: `setStatus(message, type)` где type: `'idle' | 'loading' | 'success' | 'error'`. Success/error авто-сбрасываются через 3 секунды.

### Клавиатура

- **normalizeInput()** (`keymap.ts`) — маппинг русских букв в латинские (й→q, ц→w, ...). Все хоткеи проходят через него.
- **isCtrl()** — проверка Ctrl/Meta (Cmd на macOS).
- Хоткей `u` занят под «обновить» в InstalledScreen. Для upload используется `p` (publish).

### Git-операции

- `simple-git` для всех git-операций.
- Upload: всегда `git checkout main` в `finally` — иначе кеш сломается для остального CLI.
- `git push --dry-run` для проверки write-доступа без модификации remote.
- URL парсинг: HTTPS (`https://github.com/owner/repo.git`) и SSH (`git@github.com:owner/repo.git`).
- **Нет предварительного `encodeURIComponent`** для branch/title в PR URL — `open`/`xdg-open` кодирует сам. Двойное кодирование ломает GitLab MR.

### Конфигурация

- `resolveConfig()` — мерджит проектный + глобальный конфиг. Проектный приоритетнее. Автоматически вызывает `ensureProjectConfig()` для миграции и создания локального конфига.
- `findProjectRoot()` — ищет корень проекта, поднимаясь от CWD. Приоритет: агентские директории → `.skill-hub.json` → `.git`.
- `ensureProjectConfig()` — оркестратор: миграция старого формата → создание `.skill-hub.local.json` → `.gitignore`. Идемпотентна.
- `hasProjectConfig()` — проверяет наличие **обоих** файлов (`.skill-hub.json` и `.skill-hub.local.json`).
- `pushHistory()` — добавляет URL/proxy в историю (max 6 записей).
- При смене `registryUrl` — вызвать `fullCatalogReset()` (удалить кеш + очистить extensions из проектного конфига).
- `loadGitignoreAgentDirs()` / `saveGitignoreAgentDirs()` — чтение/запись настройки `gitignoreAgentDirs` из публичного проектного конфига.
- `gitignore-agents.ts` — утилиты для управления папками ИИ-агентов в `.gitignore`: `AGENT_GITIGNORE_ENTRIES`, `getExistingAgentEntries()`, `getMissingGitignoreEntries()`, `addAgentDirsToGitignore()`, `removeAgentDirsFromGitignore()`, `migrateGithubGitignoreEntry()`.

### Тестирование

- Jest, `ts-jest` для TypeScript
- Тесты рядом с модулями: `upload.test.ts`, `git.test.ts`, `catalog.test.ts`
- Моки: `jest.mock('simple-git')` для git-операций, `jest.mock('fs')` для файловых
- Тест `getUploadCandidates` пропущен — требует мок адаптера без DI
- **Текущее состояние:** 225 тестов (224 pass, 1 skip)

### Windows и кроссплатформенность

> **Обязательное требование:** весь новый код должен проходить проверку на Windows. Если добавляешь файловые операции, запуск процессов, пути или symlinks — обязательно проверь поведение на Windows через моки (см. правила ниже) и добавь соответствующие тесты.

Для платформо-зависимого кода использовать хелпер `platform.ts`:

```typescript
import { isWindows, isMac, isLinux, getAppData } from './platform';
```

**Ключевые правила:**

- **Никогда не использовать** `process.platform === 'win32'` inline — только через `isWindows` из `platform.ts`
- **Agent Launcher** (`agent-launcher.ts`): на Windows генерирует `.bat` с CRLF (`\r\n`), `@echo off`, `set VAR=value`, самоудаление через `del "%~f0"`
- **Symlinks** (`conventions.ts`): стратегия `dir` → `junction` → fallback-копирование при `EPERM`
- **Сравнение путей**: использовать `pathsEqual()` из `platform.ts` — case-insensitive на Windows
- **Сигналы**: `child.kill()` без аргумента (не `SIGTERM`) — на Windows `SIGTERM` не поддерживается
- **Spawn**: добавлять `shell: true` при `isWindows` для корректного поиска бинарников в PATH
- **Пути**: всегда `path.join()`, `path.sep`, `path.basename()` — никогда не хардкодить `/` или `\\`
- **Home dir**: использовать `os.homedir()` — никогда `process.env.HOME` (не работает на Windows cmd.exe)
- **Тесты**: мокать `process.platform` через `jest.replaceProperty(process, 'platform', 'win32')`; мокать `os.homedir()` вместо `process.env.HOME`
- **Новые адаптеры и модули**: если добавляешь путь к файлу агента — проверь, что путь строится через `path.join(homeDir, ...)`, а не строковой конкатенацией
