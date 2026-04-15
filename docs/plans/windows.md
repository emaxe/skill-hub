# Windows-совместимость skill-hub CLI

## Проблема

Приложение skill-hub **не работает на Windows** в текущем виде. Базовые функции (поиск, установка, удаление расширений, TUI, MCP-сервер) — кроссплатформенны благодаря `path.join()`, `os.homedir()` и библиотеке `simple-git`. Однако несколько компонентов содержат Unix-специфичный код, который ломается на Windows.

## Что уже работает ✅

- **Работа с путями** — почти везде `path.join()` + `os.homedir()`
- **Git-операции** — `simple-git` кроссплатформенна
- **Нормализация путей** — `path-filter.ts` делает `replace(/\\/g, '/')`
- **package.json** — нет OS-специфичных зависимостей или скриптов
- **CLI-команды** (search, install, remove, list, info, update) — работают
- **TUI** (Ink/React) — работает
- **MCP-сервер** — работает (кроме путей Copilot-адаптера)
- **Claude Code адаптер** — `~/.claude/` существует и на Windows
- **Cursor адаптер** — `~/.cursor/` существует и на Windows

## Обнаруженные проблемы

### 🔴 CRITICAL

#### 1. Agent Launcher — Unix shell

**Файл:** `cli/src/agent-launcher.ts`

```typescript
// Строка 51: sh отсутствует на Windows
spawnSync('sh', ['-c', 'exec "$0" "$@"', binary, ...extraArgs], { ... });

// Строка 67-70: Unix-конструкции
const lines: string[] = ['#!/bin/sh'];
lines.push(`trap 'rm -f "$0"' EXIT`);

// Строка 79: exec — Unix builtin
lines.push(`exec "${binary}" "$@"`);

// Строка 81: Unix-пермиссии
fs.writeFileSync(scriptPath, lines.join('\n') + '\n', { mode: 0o755 });

// Строка 85: снова sh
spawnSync('sh', [scriptPath, ...extraArgs], { ... });
```

**Почему ломается:** Windows не имеет `/bin/sh`. `exec`, `trap` — Unix shell builtins. `mode: 0o755` — игнорируется на Windows.

**Затрагивает:** флаги `-a` / `-A` (запуск AI-агента с прокси).

**Решение:**
- Определять `process.platform === 'win32'`
- exec-режим: использовать `spawnSync(binary, extraArgs, { shell: true, ... })` напрямую
- script-режим: генерировать `.bat` / `.ps1` вместо `.sh`:
  ```bat
  @echo off
  set http_proxy=...
  set https_proxy=...
  "%BINARY%" %*
  del "%~f0"
  ```
- Либо добавить зависимость `cross-spawn` для унификации

---

#### 2. Symlinks в Conventions

**Файл:** `cli/src/conventions.ts`, строки 422, 439

```typescript
// Строка 422: чтение симлинка
const currentTarget = fs.readlinkSync(linkPath);

// Строка 439: создание симлинка без указания типа
fs.symlinkSync(s.target, linkPath);
```

**Почему ломается:**
- На Windows создание symlink требует прав администратора
- Нет указания типа `'dir'` для директорных симлинков (на Windows обязательно)
- Нет обработки ошибки `EPERM`

**Затрагивает:** команда `agents-conventions enable` — весь conventions-режим.

**Решение:**
- Использовать **junction** вместо symlink на Windows: `fs.symlinkSync(target, linkPath, 'junction')` — не требует admin-прав
- Junction требует **абсолютные пути** в target → нужно `path.resolve()` перед вызовом
- Fallback: если junction тоже не удаётся — копировать директории вместо симлинков
- Обновить проверку в `getConventionsStatus()`: на Windows junction — тоже валидный вариант

---

#### 3. Copilot Adapter — неверный путь на Windows

**Файл:** `cli/src/adapters/copilot.ts`, строки 36–39

```typescript
const vscodePath = process.platform === 'darwin'
  ? path.join(this.homeDir, 'Library', 'Application Support', 'Code', 'User')
  : path.join(this.homeDir, '.config', 'Code', 'User'); // ❌ Linux-путь
```

**Почему ломается:** Windows хранит настройки VS Code в `%APPDATA%\Code\User`, а не в `~/.config/Code/User`.

**Решение:**
```typescript
const vscodePath = process.platform === 'darwin'
  ? path.join(this.homeDir, 'Library', 'Application Support', 'Code', 'User')
  : process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(this.homeDir, 'AppData', 'Roaming'), 'Code', 'User')
    : path.join(this.homeDir, '.config', 'Code', 'User');
```

---

### 🟡 MEDIUM

#### 4. SIGTERM в child process

**Файлы:**
- `cli/src/tui/hooks/useConventionsInit.ts`, строка 134
- `cli/src/tui/hooks/useConventionsExit.ts`, строка 137

```typescript
childRef.current.kill('SIGTERM');
```

**Почему проблема:** Windows не поддерживает POSIX-сигналы. Node.js при `.kill('SIGTERM')` на Windows вызывает `TerminateProcess()` — процесс завершается, но без graceful shutdown.

**Решение:** В целом работает (Node.js обрабатывает), но стоит использовать `.kill()` без аргумента или добавить комментарий о поведении на Windows.

---

#### 5. MCP config пути для агентов на Windows

**Файл:** `cli/src/base-setup.ts`, строки 12–22

```typescript
// Claude Code: ~/.claude/claude_desktop_config.json
// На Windows может быть %APPDATA%\Claude\claude_desktop_config.json

// Copilot: ~/.copilot/mcp-config.json
// Путь на Windows не проверен
```

**Решение:** Проверить реальные пути MCP-конфигов агентов на Windows и добавить `process.platform` логику в `getMcpConfigPath()`.

---

### 🟢 LOW

#### 6. SIGINT handling в TUI

**Файл:** `cli/src/tui/index.ts`

```typescript
process.once('SIGINT', sigintHandler);
```

**Проблема:** На Windows в некоторых терминалах `SIGINT` работает нестабильно. Обычно работает в PowerShell и cmd, но может не работать в Git Bash.

**Решение:** Мониторить, исправлять при появлении реальных отчётов.

---

## Задачи

Все задачи независимы друг от друга и могут выполняться параллельно.

### Критические

| ID | Задача | Файл(ы) |
|----|--------|----------|
| win-agent-launcher | Добавить Windows-ветку в agent-launcher | `cli/src/agent-launcher.ts` |
| win-symlinks | Junction/fallback вместо symlink на Windows | `cli/src/conventions.ts` |
| win-copilot-path | Добавить `win32` ветку для пути VS Code | `cli/src/adapters/copilot.ts` |

### Средние

| ID | Задача | Файл(ы) |
|----|--------|----------|
| win-sigterm | Кроссплатформенное завершение child process | `useConventionsInit.ts`, `useConventionsExit.ts` |
| win-mcp-paths | Windows-пути для MCP-конфигов агентов | `cli/src/base-setup.ts` |

### Низкий приоритет

| ID | Задача | Файл(ы) |
|----|--------|----------|
| win-sigint | Улучшить SIGINT для Windows-терминалов | `cli/src/tui/index.ts` |

## Вспомогательная утилита

Рекомендуется создать хелпер `cli/src/platform.ts` для повторно используемых проверок:

```typescript
export const isWindows = process.platform === 'win32';
export const isMac = process.platform === 'darwin';

/** Возвращает APPDATA или fallback */
export function getAppData(): string {
  return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
}
```

## Тестирование

- Добавить unit-тесты с моком `process.platform` для каждого изменённого компонента
- Проверить на реальной Windows-машине: PowerShell, cmd, Windows Terminal
- CI: добавить `windows-latest` runner в GitHub Actions (если есть CI)
