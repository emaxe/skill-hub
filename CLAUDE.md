# CLAUDE.md

Инструкции для AI-агентов (Claude Code, Cursor, Copilot) при работе с кодом этого репозитория.

## Обзор проекта

Skill-Hub — менеджер расширений для AI-агентов (Claude Code, Cursor, Copilot). CLI + MCP-сервер для поиска, установки и управления переиспользуемыми **skills**, **agents** и **commands**.

| Репозиторий | Содержимое |
|-------------|-----------|
| `skill-hub` (этот) | `cli/` — TypeScript CLI + MCP-сервер; `cli/base-skills/` — бутстрап-скиллы |
| `skill-hub-catalog` | `skills/`, `agents/`, `commands/`, `schema/`, `catalog.json` |

**Npm-пакет:** `@emaxe/skill-hub` (version 0.1.9)
**Node:** ≥18

## Команды разработки

```bash
cd cli && npm run build          # сборка (tsc)
cd cli && npm test               # Jest-тесты (82 теста)
npm link                         # глобальная линковка для локального тестирования
npm unlink -g @emaxe/skill-hub   # удалить линк
skill-hub search git             # проверить CLI
```

## Структура файлов

```
cli/
├── src/
│   ├── index.ts              # Точка входа CLI (Commander). 8 команд + TUI
│   ├── mcp.ts                # MCP-сервер (7 инструментов)
│   ├── mcp-entry.ts          # Отдельная точка входа для MCP
│   ├── catalog.ts            # Типы Extension, AgentName, loadCatalog(), scoreExtensions()
│   ├── config.ts             # Двухуровневый конфиг: global + project
│   ├── registry.ts           # Реестр установленных расширений (registry.json)
│   ├── git.ts                # Git-операции: clone, pull, cache management
│   ├── upload.ts             # Загрузка расширений в каталог (git push + PR URL)
│   ├── sync.ts               # Синхронизация расширений: missing/untracked detection
│   ├── conventions.ts        # Режим agents-conventions: init/exit/health
│   ├── platform.ts           # Платформенный хелпер: isWindows, isMac, isLinux, getAppData()
│   ├── agent-launcher.ts     # Запуск AI-агентов: exec (-a) и script (-A) режимы
│   ├── detect-agent.ts       # Автодетекция агента по env vars / директориям
│   ├── keymap.ts             # Нормализация русской раскладки → латинская для хоткеев
│   ├── adapters/             # Адаптеры агентов (claude-code, cursor, copilot, conventions)
│   │   ├── types.ts          # AgentAdapter interface, ScanResult
│   │   ├── claude-code.ts
│   │   ├── cursor.ts
│   │   ├── copilot.ts
│   │   └── agents-conventions.ts
│   ├── commands/             # CLI-команды (search, install, remove, list, info, ...)
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
│       │   └── useTerminalSize.ts # Размер терминала + debounced resize
│       ├── screens/
│       │   ├── CatalogScreen.tsx        # Таб «Каталог» — поиск, фильтры, установка
│       │   ├── InstalledScreen.tsx       # Таб «Установленные» — список, удаление, обновление
│       │   ├── SettingsScreen.tsx        # Таб «Настройки» — конфигурация, подвкладки
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
│           └── ExitConventionsModal.tsx # Модалка выключения conventions
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
- **Проектный:** `.skill-hub.json` (в корне проекта)

Проектный конфиг переопределяет глобальный. Поиск проектного конфига: `config.ts → resolveProject()` — поднимается от CWD вверх, ищет `.skill-hub.json` или `.git`.

```typescript
interface SkillHubConfig {
  agent: 'claude-code' | 'cursor' | 'copilot' | 'agents-conventions';
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

**Проектный конфиг** (`.skill-hub.json`):
```json
{
  "settings": { "agent": "claude-code", "defaultScope": "project" },
  "extensions": [
    { "type": "skill", "name": "git-commit-and-push", "version": "1.0.0", "scope": "project" }
  ]
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
| agents-conventions | — | `.agents/skills/{name}/SKILL.md` |

**Автодетекция** (`detect-agent.ts`): env vars (`CURSOR_TRACE` → cursor, `GITHUB_COPILOT` → copilot) → наличие `.cursor/` → default `claude-code`.

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
1. Загрузить `extensions` из `.skill-hub.json`
2. Сканировать диск через адаптер
3. **Missing** — в конфиге, но не на диске → предложить установить
4. **Untracked** — на диске, но не в конфиге → предложить добавить в конфиг или загрузить в каталог

### Conventions Mode

Унифицированная `.agents/` директория для мультиагентных проектов:
- `conventions.ts → initConventions()` — создать `.agents/`, symlinks, `AGENTS.md`
- `conventions.ts → exitConventions()` — мигрировать расширения обратно, удалить symlinks
- Health check: `.agents/` exists, `AGENTS.md` exists, symlinks valid
- `generateProjectRules()` — автоанализ проекта (package.json, go.mod, etc.)

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

4 последовательные проверки при запуске TUI:
1. **Conventions health** — если agent=`agents-conventions`, проверить `.agents/`, symlinks
2. **Project config** — предложить создать `.skill-hub.json` если глобальный конфиг, но есть проект
3. **Extension sync** — missing/untracked расширения
4. **Project conflicts** — расширения не для текущего проекта

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

## Язык

- **Документация и контент расширений** — на русском
- **Идентификаторы, пути, технические термины** — на английском
- **JSDoc-комментарии** — на русском

## Стиль кода и паттерны

### Общие правила

1. **Документация синхронизирована с кодом.** При добавлении/удалении CLI-команд, MCP-инструментов, полей конфига — обновлять CLAUDE.md и README.md.
2. **JSDoc на экспортируемых интерфейсах и функциях.** Текст на русском. Примеры: `config.ts` (заголовки секций), `keymap.ts`, `conventions.ts` (нумерованные шаги).
3. **Комментарии для неочевидной логики.** «Почему», а не «что». Скоринг, дедупликация, multi-step flows.
4. **Не переусердствовать.** Простые геттеры и self-documenting код не комментировать.
5. **Версии в sync.** Bump `package.json` → обновить строки в `index.ts` и `mcp.ts`.

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

- `resolveConfig()` — мерджит проектный + глобальный конфиг. Проектный приоритетнее.
- `resolveProject()` — ищет корень проекта, поднимаясь от CWD. Приоритет: агентские директории → `.skill-hub.json` → `.git`.
- `pushHistory()` — добавляет URL/proxy в историю (max 6 записей).
- При смене `registryUrl` — вызвать `fullCatalogReset()` (удалить кеш + очистить extensions из проектного конфига).

### Тестирование

- Jest, `ts-jest` для TypeScript
- Тесты рядом с модулями: `upload.test.ts`, `git.test.ts`, `catalog.test.ts`
- Моки: `jest.mock('simple-git')` для git-операций, `jest.mock('fs')` для файловых
- Тест `getUploadCandidates` пропущен — требует мок адаптера без DI

### Windows и кроссплатформенность

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
- **Тесты**: мокать `process.platform` через `jest.replaceProperty(process, 'platform', 'win32')`; мокать `os.homedir()` вместо `process.env.HOME`
