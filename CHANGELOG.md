# Changelog

Все заметные изменения в проекте документируются здесь.

## [Unreleased]

### Исправлено (Security Audit)
- **C2** — `removeSection()` / `removeMarkerContent()` больше не портят файлы при отсутствии конечного маркера. Вместо удаления всего от начального маркера до конца файла — оставляют содержимое нетронутым
- **C3** — `registry.ts` `JSON.parse` обёрнут в try/catch: повреждённый `registry.json` не крашит CLI, а инициализируется пустым реестром с warning
- **C4** — `.github/` заменена на `.github/copilot-instructions.md` в `AGENT_GITIGNORE_ENTRIES` — больше не блокирует GitHub Actions / Dependabot при автодобавлении в .gitignore
- **C5** — `buildCatalogEntry()` при upload больше не сканирует родительскую директорию вместо директории скилла (`getExtensionDirRel()` корректно обрабатывает путь к файлу и к директории)
- **C6** — upload cleanup: `finally` блок гарантирует возврат на `main` даже при ошибке push, предотвращая залипание кеша на feature branch
- **C7** — Git auth URL → бесконечный цикл reclone: при `ENOENT`/ошибке клонирования не повторяет `ensureCache()` рекурсивно, а выбрасывает ошибку с понятным сообщением
- **C8** — `checkMcpUpToDate()` использует рекурсивный `deepEqual()` вместо `JSON.stringify` для сравнения MCP-конфигов — порядок ключей больше не вызывает ложное «outdated»

### Добавлено
- **Многофайловые скиллы** — скиллы теперь могут содержать дополнительные файлы (скрипты, шаблоны, конфигурации) помимо основного `SKILL.md`
  - Утилиты `multi-file.ts`: `copyExtensionDir()`, `copyAdditionalFiles()`, `hasAdditionalFiles()`, `listExtensionFiles()`, `getExtensionDirRel()`
  - Валидация при upload: запрет бинарных файлов (`findBinaryFiles()`), лимит размера директории 1 МБ (`getExtensionDirSize()`)
  - Поддержка `.skillignore` — исключение файлов из копирования и загрузки
  - Поле `files` в `Extension` — массив относительных путей доп. файлов в каталоге
  - **Все 5 адаптеров** поддерживают установку многофайловых скиллов:
    - Claude Code, conventions: `copyExtensionDir()` — полная копия директории
    - Cursor: трансформация основного `.md` (Cursor frontmatter) + `copyAdditionalFiles()` as-is
    - Copilot: marker-injection + доп. файлы в `.github/skills/{name}/`
    - Codex: marker-injection + доп. файлы в `.codex/skills/{name}/`
  - **Upload в каталог** корректно копирует всю директорию скилла (не только `SKILL.md`)
  - 31 unit-тест на многофайловую функциональность

### Изменено
- **Глобальная установка `agents-conventions`** — bootstrap-скилл теперь ставится глобально во все 4 AI-агента (claude-code, cursor — копия директории; copilot, codex — marker-injection). Удаляется при `disable`.
- **`init-agents` / `exit-agents` → `~/.skill-hub/bootstrap/`** — перенесены из проектного `.agents/skills/` в глобальную директорию; не регистрируются в registry.
- **`skill-hub -U` — полная реконсиляция** — при запуске восстанавливает структуру conventions (каталоги, symlinks, pointers, bootstrap), доустанавливает расширения из `.skill-hub.json`, затем обновляет существующие.

### Исправлено
- Upload загружал только `SKILL.md`, игнорируя доп. файлы скилла (`ScanResult.path` указывал на файл → `isDirectory()` = false)
- Сломанные импорты в `useKeymap.ts` и `UploadScreen.tsx` (неверный путь к модулю `keymap`, недостающие `isLeftArrow`/`isRightArrow`)

### Добавлено
- **Адаптивный TUI для малых экранов** — интерфейс корректно отображается при ширине от 60 колонок и высоте от 12 строк
  - Хук `useLayout` — центральная точка адаптива: breakpoint (`compact <80 / normal 80–119 / wide ≥120`), конфигурация колонок таблиц, флаги видимости элементов
  - **Compact-режим** (< 80 колонок): скрытие колонок TAGS/PROJECT/SOURCE в таблицах, сокращённые лейблы в Header (`s-h`, `Кат`, `Уст`, `Наст`), однобуквенные фильтры (`*`, `S`, `A`, `C`), компактный InfoBar (`Уст: N (g:X p:Y)`)
  - **Адаптивный HintBar** — при нехватке места сначала обрезаются описания хинтов до первого слова, затем скрываются менее важные
  - **Адаптивная ширина диалогов** — все 6 диалогов принимают `dialogWidth` из `useLayout` вместо хардкода `58`
  - **Detail-экраны** — `labelPadWidth` и `truncateAt` рассчитываются от реальной ширины терминала
  - **UploadScreen** — длины branch и PR-заголовка адаптируются к ширине терминала
  - При высоте < 16 строк InfoBar и разделители скрываются, `contentAreaHeight` пересчитывается (+3 строки для контента)
  - `MIN_ROWS` обновлён до 12
- **Настройка «Папки ИИ-агентов в .gitignore»** — переключатель `gitignoreAgentDirs` в публичном проектном конфиге (`.skill-hub.json`)
  - TUI: поле в Настройки → Основное → `[да]/[нет]` (←→ переключение), доступно только при проектном конфиге
  - При старте TUI (5-я проверка) — если настройка включена и есть агентские папки/файлы не в `.gitignore`, показывается диалог с предложением добавить
  - При `skill-hub -U` — автоматически добавляет отсутствующие записи в `.gitignore`
  - Записи: `.claude/`, `.cursor/`, `.github/`, `.codex/`, `.agents/`, `.cursorrules`
  - Модуль `gitignore-agents.ts`: проверка покрытия, добавление секции с комментарием `# AI agent directories (skill-hub)`
  - Компонент `AgentDirsGitignoreDialog` — диалоговое окно в стиле ExtensionSyncDialog
- `ensureConventionsStructure()` — идемпотентная функция для восстановления `.agents/` структуры, symlinks, thin pointers, bootstrap-скиллов, `AGENTS.md`.
- `installAgentsConventionsGlobal()` / `removeAgentsConventionsGlobal()` — установка/удаление `agents-conventions` во все AI-агенты.
- Marker-injection (`<!-- skill-hub: agents-conventions -->`) для copilot/codex глобальных конфигов.

## [0.1.11] — 2026-04-15

### Добавлено
- **Поддержка Codex** — OpenAI Codex как пятый AI-агент в skill-hub
  - Адаптер `CodexAdapter` с инъекцией через HTML-маркеры (аналог CopilotAdapter)
  - Global path: `~/.codex/AGENTS.md`; Project path: `.codex/AGENTS.md`
  - `platformKey('codex')` → `'claude-code'` — все расширения каталога сразу доступны
  - Автодетекция: env vars `CODEX_SANDBOX` / `CODEX_SANDBOX_NETWORK_DISABLED`, директория `.codex/`
  - TUI: codex в настройках агентов, фильтрах установленных, AI Agents вкладке
  - MCP: все 7 инструментов принимают `'codex'` как значение параметра `agent`
  - Conventions Mode: symlinks `.codex/` → `.agents/` + thin pointer `.codex/AGENTS.md` → `AGENTS.md`
  - Bootstrap-скилл `base-skills/codex/SKILL.md`
  - Unit-тесты `CodexAdapter` и автодетекции Codex

## [0.1.9] — 2026-04-15

### Добавлено
- **Поддержка Windows** — нативная работа CLI на Windows (cmd.exe, PowerShell, Windows Terminal)
  - Хелпер `platform.ts` — `isWindows`, `isMac`, `isLinux`, `getAppData()`
  - Agent Launcher (`-a` / `-A`): генерация `.bat`-скриптов с CRLF вместо `.sh`
  - Conventions symlinks: тип `dir` → fallback `junction` → fallback копирование директории
  - Copilot-адаптер: путь VS Code конфига через `%APPDATA%\Code\User\` на Windows
  - Claude Code адаптер: case-insensitive сравнение путей (`pathsEqual()`)
  - `kill()` без `SIGTERM` в хуках conventions (SIGTERM не поддерживается на Windows)
  - `shell: true` при запуске процессов на Windows
  - Кроссплатформенный разбор путей через `path.basename()` / `path.dirname()`
  - Unit-тесты с моком `process.platform = 'win32'` для всех изменённых модулей
- **Загрузка расширений в каталог** — экран `UploadScreen` для выбора, валидации и push расширений в репозиторий каталога
  - Проверка write-доступа к каталогу (`git push --dry-run`)
  - Валидация frontmatter (name, description, version, author, kebab-case)
  - Автоматическая генерация имени ветки и заголовка PR
  - Генерация URL для создания MR/PR (GitHub, GitLab)
  - Кнопка `[o]` для открытия merge request в браузере после загрузки
  - Спиннер проверки доступа в диалоге синхронизации
- **Точки входа для upload:**
  - Таб «Установленные» — хоткей `p`
  - Карточка установленного расширения — действие «Загрузить в каталог»
  - Диалог синхронизации — хоткей `p` для расширений не из каталога
- **Очистка extensions при смене registryUrl** — при переключении каталога список расширений в проектном конфиге очищается
- **Автозагрузка каталога** после смены registryUrl в TUI

### Исправлено
- Краш `Text string "" must be rendered inside <Text>` в UploadScreen (пустая строка в Box)
- Двойное энкодирование URL для GitLab MR (`%252F` вместо `%2F`)
- Синтаксис Commander option для `--yes` (`-y, --yes`)

## [0.1.8] — 2026-04

### Добавлено
- **Универсальная поддержка скиллов** — трансформация frontmatter под каждую платформу
- Последовательные проверки при старте TUI (conventions → project config → sync → conflicts)
- Agent launcher: флаги `-a` и `-A` для запуска AI-агентов
- Рефакторинг conventions: улучшенный init/exit flow

## [0.1.7] — 2026-03

### Добавлено
- **Синхронизация расширений** — автоматическая проверка missing/untracked при запуске TUI
- **Проектный конфиг** `.skill-hub.json` — фиксация расширений для командной работы
- **TextEditModal** — редактирование длинных строк (URL, proxy) с историей
- **История** registryUrl и proxy (до 6 записей)
- Команда `help` и флаг `-h` с полной справкой

## [0.1.6] — 2026-03

### Добавлено
- **Проектный конфиг** — двухуровневая система (глобальный + проектный)
- **Settings UX** — saveAsGlobal, resetToGlobal, createProjectConfig
- **Deferred conventions init** — отложенная инициализация

## [0.1.5] — 2026-03

### Добавлено
- **Agents-Conventions Mode** — унифицированная `.agents/` директория
- Init/exit flow с опциональным запуском AI-агентов для миграции
- **AGENTS.md** — общие правила проекта для всех агентов
- Миграция корневых конфигов (CLAUDE.md, .cursorrules, copilot-instructions.md)

### Добавлено
- **Адаптивный TUI** — обработка resize терминала + прокручиваемый контент
- Root config migration для init-agents/exit-agents

## [0.1.4] — 2026-02

### Добавлено
- Поддержка трёх агентов: Claude Code, Cursor, Copilot
- Экран просмотра содержимого расширений

## [0.1.3] — 2026-02

### Добавлено
- **Self-update** — обновление CLI из TUI и командной строки
- Поля «Обновить кеш» и «Переустановить агента» в настройках

## [0.1.2] — 2026-01

### Добавлено
- **Интерактивный TUI** — полноэкранный UI с Ink/React
  - Табы: Каталог, Установленные, Настройки
  - Поиск, фильтрация, установка, удаление, перемещение
  - Детальные карточки расширений
- **Registry URL** — настраиваемый URL каталога
- Команда `config` для управления настройками

### Добавлено
- **Suggest extensions** — MCP-инструмент для рекомендаций расширений на основе проекта
- **get_extension_info** — MCP-инструмент для полной информации о расширении

## [0.1.0] — 2025-12

### Добавлено
- Первый релиз: CLI + MCP-сервер
- Адаптеры для Claude Code, Cursor, Copilot
- Команды: search, install, remove, list, info, update, setup-mcp
- MCP-сервер с 4 инструментами (search, install, remove, list)
- Bootstrap skills для каждого агента
