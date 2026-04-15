# Спецификация: Поддержка Windows

## Контекст

Приложение skill-hub CLI **не работает на Windows** в текущем виде. Базовая функциональность (поиск, установка, удаление расширений, TUI, MCP-сервер) в основном кроссплатформенна благодаря `path.join()`, `os.homedir()` и библиотеке `simple-git`. Однако несколько компонентов содержат Unix-специфичный код: shell-скрипты (`sh`, `exec`, `trap`), symlinks без указания типа, неверные пути для Windows, POSIX-сигналы и жёсткие разделители в строках.

### Что уже работает

- Работа с путями — почти везде `path.join()` + `os.homedir()`
- Git-операции — `simple-git` кроссплатформенна
- Нормализация путей — `path-filter.ts` делает `replace(/\\/g, '/')`
- CLI-команды (search, install, remove, list, info, update)
- TUI (Ink/React)
- MCP-сервер (кроме путей Copilot-адаптера)
- Claude Code адаптер — `~/.claude/` существует и на Windows
- Cursor адаптер — `~/.cursor/` существует и на Windows
- `UploadScreen.tsx` — уже использует `process.platform === 'win32' ? 'start' : ...` для открытия URL

## Требования

### CRITICAL

**REQ-1.** Agent Launcher (`cli/src/agent-launcher.ts`) должен работать на Windows:
- exec-режим (флаг `-a`): использовать `spawnSync(binary, extraArgs, { shell: true })` вместо `spawnSync('sh', ['-c', ...])`.
- script-режим (флаг `-A`): генерировать `.bat` файл вместо `.sh` с `@echo off`, `set` (вместо `export`), `"%BINARY%" %*` (вместо `exec`), `del "%~f0"` (вместо `trap rm`).
- Расширение файла скрипта: `.bat` на Windows, `.sh` на Unix.
- Строки `.bat` файлов: использовать `\r\n` (CRLF).

**REQ-2.** Symlinks в Conventions (`cli/src/conventions.ts`) должны создаваться на Windows:
- Стратегия fallback: сначала `fs.symlinkSync(target, linkPath, 'dir')` → при `EPERM` fallback на `fs.symlinkSync(path.resolve(base, target), linkPath, 'junction')` → при повторной ошибке fallback на копирование директории.
- Сравнение путей симлинков (строка ~422-423): нормализовать через `path.normalize()` перед сравнением.

**REQ-3.** Copilot Adapter (`cli/src/adapters/copilot.ts`) — добавить Windows-ветку пути VS Code:
- `process.platform === 'win32'` → `path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'Code', 'User')`.

### HIGH

**REQ-4.** Создать хелпер `cli/src/platform.ts`:
- `isWindows: boolean`, `isMac: boolean`, `isLinux: boolean`
- `getAppData(): string` — `process.env.APPDATA` или fallback
- Использовать в REQ-1, REQ-2, REQ-3 и далее вместо inline `process.platform === 'win32'`.

**REQ-5.** Исправить `App.tsx:124` — `s.path.split('/').slice(-2).join('/')`:
- Заменить на кроссплатформенный разбор через `path.basename()` / `path.dirname()` или `path.sep`.

**REQ-6.** Исправить `claude-code.ts:110-116` — case-sensitive сравнение путей:
- На Windows `C:\Users\John` ≠ `c:\users\john`. Добавить `.toLowerCase()` при `isWindows` или использовать вспомогательную функцию `pathsEqual()` в `platform.ts`.

### MEDIUM

**REQ-7.** Кроссплатформенное завершение child process:
- `useConventionsInit.ts:134` и `useConventionsExit.ts:137`: заменить `kill('SIGTERM')` на `kill()` без аргумента на Windows (Node.js вызовет `TerminateProcess()`).

**REQ-8.** Кроссплатформенный `spawn()` в хуках conventions:
- `useConventionsInit.ts` и `useConventionsExit.ts`: добавить `shell: true` при `isWindows` для корректного поиска бинарников в PATH.

**REQ-9.** `conventions.ts:135` — заменить хардкод `'/'` на `path.sep` в генерации списка директорий для markdown.

### LOW

**REQ-10.** Исправить тесты `move.test.ts:56-63`:
- Мокать `os.homedir()` вместо `process.env.HOME`, чтобы тесты работали на Windows (где `HOME` не задан, используется `USERPROFILE`).

## Ограничения

- **Не** добавляем npm-зависимость `cross-spawn` — используем встроенные средства Node.js с ветвлением по платформе.
- **Не** добавляем `windows-latest` runner в CI на данном этапе — только unit-тесты с моком `process.platform`.
- **Не** меняем dot-directory конвенции (`.claude/`, `.cursor/`) — они работают и на Windows.
- Git Bash / WSL — out of scope; фокус на нативном Windows (cmd.exe, PowerShell, Windows Terminal).
- ANSI escape-коды в TUI (`\x1b[...`): Ink/React обрабатывает это самостоятельно, не входит в скоуп.

## Макеты и референсы

Не применимо — инфраструктурная фича без UI-изменений.

## Кодстайл и конвенции

- **Язык документации:** русский, код — английский.
- **JSDoc:** добавлять к экспортируемым функциям в `platform.ts` (русский текст, см. паттерн `config.ts`).
- **Комментарии:** только «почему», не «что» — кратко пояснять Windows-специфичные ветки.
- **Паттерн:** использовать `platform.ts` хелперы вместо inline `process.platform === 'win32'`.
- **Тесты:** мокать `process.platform` через `jest.replaceProperty(process, 'platform', 'win32')` или аналог.

## Переиспользуемые решения

| Путь | Описание |
|------|----------|
| `cli/src/tui/screens/UploadScreen.tsx:218-221` | Образец корректного ветвления по `process.platform` для `open`/`start`/`xdg-open` |
| `cli/src/path-filter.ts` | Нормализация путей с `replace(/\\/g, '/')` — можно использовать как референс |
| `cli/src/config.ts` | Паттерн секционных комментариев и JSDoc |
| `cli/src/adapters/copilot.ts:36-38` | Текущее ветвление `darwin`/Linux — расширить на `win32` |

## Критерии приёмки

- [ ] **AC-1:** `skill-hub -a claude` запускает агента на Windows через `.bat`-скрипт
- [ ] **AC-2:** `skill-hub -A claude` создаёт и выполняет `.bat` с прокси-переменными, скрипт самоудаляется
- [ ] **AC-3:** `skill-hub agents-conventions enable` создаёт рабочие симлинки на Windows (type 'dir', junction или copy)
- [ ] **AC-4:** `skill-hub agents-conventions enable` повторный вызов идемпотентен (нет пересоздания при корректном таргете)
- [ ] **AC-5:** Copilot-адаптер находит конфиг VS Code в `%APPDATA%\Code\User\` на Windows
- [ ] **AC-6:** TUI корректно отображает пути битых симлинков на Windows
- [ ] **AC-7:** Обход родительских директорий в claude-code адаптере корректен при различном регистре путей на Windows
- [ ] **AC-8:** Существующие тесты проходят на Unix (`npm test`)
- [ ] **AC-9:** Новые unit-тесты покрывают Windows-ветки с моком `process.platform`

## Затронутые файлы

| Файл | Тип изменения |
|------|---------------|
| `cli/src/platform.ts` | **Новый** — хелпер платформы |
| `cli/src/agent-launcher.ts` | Модификация — Windows-ветка для exec/script режимов |
| `cli/src/conventions.ts` | Модификация — symlink type + fallback + нормализация путей |
| `cli/src/adapters/copilot.ts` | Модификация — Windows путь VS Code |
| `cli/src/adapters/claude-code.ts` | Модификация — case-insensitive сравнение путей |
| `cli/src/tui/App.tsx` | Модификация — path.split('/') → кроссплатформенный разбор |
| `cli/src/tui/hooks/useConventionsInit.ts` | Модификация — SIGTERM + shell: true |
| `cli/src/tui/hooks/useConventionsExit.ts` | Модификация — SIGTERM + shell: true |
| `cli/src/commands/move.test.ts` | Модификация — `HOME` → `os.homedir()` |
| `cli/src/conventions.ts` (строка 135) | Модификация — `'/'` → `path.sep` |
