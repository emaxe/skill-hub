# Changelog

Все заметные изменения в проекте документируются здесь.

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
