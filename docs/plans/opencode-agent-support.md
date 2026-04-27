# План: Добавление агента OpenCode

**Дата:** 2026-04-26
**Автор:** AI-агент
**Статус:** Черновик

## 1. Цель

Добавить поддержку нового AI-агента **OpenCode** в `skill-hub` CLI, MCP-сервер и TUI, чтобы пользователи могли устанавливать, управлять и запускать расширения через `opencode` так же, как через `claude-code`, `cursor`, `copilot` и `codex`.

## 2. Исследование OpenCode

### 2.1. Что такое OpenCode

OpenCode — это AI-агент с TUI-интерфейсом, который поддерживает MCP (Model Context Protocol), плагины и multiple AI-провайдеров. Он устанавливается как npm-пакет `@opencode-ai/plugin` и запускается через бинарник `~/.opencode/bin/opencode`.

### 2.2. Ключевые особенности (выявленные при исследовании)

- **Скиллы:** OpenCode читает скиллы из тех же директорий, что и Claude Code:
  - Global: `~/.claude/skills/{name}/SKILL.md`
  - Project: `.claude/skills/{name}/SKILL.md`
  - Это означает, что отдельной директории `~/.opencode/skills/` **не требуется**.
- **Конфигурация:** `~/.config/opencode/opencode.json` (единый JSON-файл)
- **MCP:** Поддерживается через `opencode mcp add/list/debug`. MCP-серверы хранятся в секции `mcp` внутри `opencode.json`.
- **Conventions Mode:** OpenCode **не требует** отдельной интеграции в `.agents/` — он автоматически видит скиллы из `.claude/skills/` и `.agents/skills/`.
- **Запуск:** `opencode [project]` или `opencode run [message..]`. **Модель не передаётся** через CLI-флаги — выбирается внутри TUI или через конфиг.
- **Детекция:** По env-переменным `OPENCODE=1`, `OPENCODE_RUN_ID`, `OPENCODE_PID`, или по наличию `.opencode/` директории в проекте.

## 3. Архитектурные решения

| Решение | Обоснование |
|---------|-------------|
| **Reuse путей claude-code для скиллов** | OpenCode читает `~/.claude/skills/` и `.claude/skills/` — отдельные пути не нужны |
| **Platform key = `'claude-code'`** | В `catalog.ts` `platformKey('opencode')` возвращает `'claude-code'`, чтобы каталог не дублировал исходники |
| **Нет conventions-интеграции** | OpenCode сам видит `.agents/` и `.claude/skills/` — symlinks не требуются |
| **MCP конфиг в `~/.config/opencode/opencode.json`** | OpenCode хранит MCP-серверы внутри своего основного конфига |
| **Без `--model` при запуске** | Модель выбирается внутри OpenCode, не через CLI-флаг |

## 4. Файлы для изменения

### 4.1. Core Types & Config (3 файла)

#### `cli/src/catalog.ts`
- **Строка 4:** Добавить `'opencode'` в union-тип `AgentName`
- **Функция `platformKey()`:** Добавить кейс `if (agent === 'opencode') return 'claude-code'`

#### `cli/src/detect-agent.ts`
- **Строки 27-33:** Добавить детекцию OpenCode:
  ```typescript
  if (process.env.OPENCODE || process.env.OPENCODE_RUN_ID || process.env.OPENCODE_PID) {
    return 'opencode';
  }
  const opencodeDir = opts.opencodeDir ?? path.join(process.cwd(), '.opencode');
  if (fs.existsSync(opencodeDir)) {
    return 'opencode';
  }
  ```
- **Интерфейс `DetectOptions`:** Добавить `opencodeDir?: string` (для тестов)

#### `cli/src/config.ts`
- **Строки 74-80:** Добавить `'opencode': { enabled: false, useProxy: false }` в `DEFAULT_CONFIG.aiAgents.agents`
- **Строка 104:** Добавить `'.opencode'` в `AGENT_SCOPE_MARKERS`

### 4.2. Адаптеры (2 файла)

#### **Новый:** `cli/src/adapters/opencode.ts`
- Тонкий адаптер, который **reuse** пути из `ClaudeCodeAdapter`
- Реализует `AgentAdapter` interface
- `install()` и `remove()` делегируют `ClaudeCodeAdapter` с теми же путями
- `scanInstalled()` использует `claude-code` пути для поиска

#### `cli/src/adapters/get-adapter.ts`
- Добавить импорт `OpencodeAdapter`
- Добавить кейс: `if (agent === 'opencode') return new OpencodeAdapter();`

### 4.3. MCP & Base Setup (2 файла)

#### `cli/src/mcp.ts`
- Во всех 7 MCP-инструментах добавить `'opencode'` в `enum` массив `agent`:
  - `search_extensions` (строка ~43)
  - `install_extension` (строка ~57)
  - `remove_extension` (строка ~70)
  - `move_extension` (строка ~84)
  - `list_extensions` (строка ~96)
  - `suggest_extensions` (строка ~115)
  - `get_extension_info` (строка ~136)

#### `cli/src/base-setup.ts`
- **`getMcpConfigPath()`:** Добавить кейс для `'opencode'` — возвращает `path.join(os.homedir(), '.config', 'opencode', 'opencode.json')`
- **`getBaseSkillDestPath()`:** Для `'opencode'` возвращает `path.join(os.homedir(), '.claude', 'skills', 'skill-hub', 'SKILL.md')` (reuse путь claude-code)
- **`checkMcpUpToDate()` / `installMcp()`:** Проверить логику — для opencode MCP-конфиг это JSON-файл, в котором нужно добавить/обновить секцию `mcp`

### 4.4. CLI Entry & Launcher (2 файла)

#### `cli/src/index.ts`
- **Строка ~47:** Обновить сообщение об ошибке: добавить `opencode` в список агентов
- **Строка ~107:** Обновить help-текст для `-a`/`-A` флагов

#### `cli/src/agent-launcher.ts`
- **Строки 9-13:** Добавить `'opencode': 'opencode'` в `AGENT_BINARIES`
- **Строки 15-19:** Добавить алиасы если нужны
- **Важно:** При генерации аргументов **не добавлять** `-m` / `--model`

### 4.5. Gitignore (1 файл)

#### `cli/src/gitignore-agents.ts`
- Добавить `'.opencode/'` в `AGENT_GITIGNORE_ENTRIES`

### 4.6. CLI Commands (7 файлов)

В каждом обновить help-текст опции `--agent`:

| Файл | Строка | Изменение |
|------|--------|-----------|
| `cli/src/commands/search.ts` | ~12 | Добавить `opencode` в описание `--agent` |
| `cli/src/commands/install.ts` | ~39 | Добавить `opencode` в описание `--agent` |
| `cli/src/commands/remove.ts` | ~18 | Добавить `opencode` в описание `--agent` |
| `cli/src/commands/list.ts` | ~23 | Добавить `opencode` в описание `--agent` |
| `cli/src/commands/move.ts` | ~42 | Добавить `opencode` в описание `--agent` |
| `cli/src/commands/update.ts` | ~21 | Добавить `opencode` в описание `--agent` |
| `cli/src/commands/info.ts` | ~15 | Добавить `opencode` в описание `--agent` |
| `cli/src/commands/setup-mcp.ts` | ~9 | Добавить `opencode` в описание `--agent` |

### 4.7. TUI Screens (4 файла)

#### `cli/src/tui/screens/SettingsScreen.tsx`
- **Строка 30:** Добавить `'opencode'` в `AGENTS: AgentName[]`
- **Строка 43:** Добавить `'opencode'` в `AI_AGENTS: AgentName[]`

#### `cli/src/tui/screens/InstalledScreen.tsx`
- **Строка 50:** Добавить `'opencode'` в `AgentFilter` union type
- **Строка 58:** Добавить `'opencode'` в `AGENT_FILTERS` массив

#### `cli/src/tui/screens/settings/AiAgentsTab.tsx`
- **Строка 7:** Добавить `'opencode'` в `AI_AGENTS: AgentName[]`

#### `cli/src/tui/screens/CatalogScreen.tsx`
- Проверить `catalogAgent` маппинг — для `'opencode'` должен fallback к `'claude-code'` (через `platformKey`)

### 4.8. TUI Hooks (1 файл)

#### `cli/src/tui/hooks/useRegistry.ts`
- **Строка 92:** Добавить `'opencode'` в `realAgents: AgentName[]` внутри conventions branch

### 4.9. TUI Components (2 файла)

#### `cli/src/tui/components/InitConventionsModal.tsx`
- **Строка 10:** Добавить `'opencode'` в `AiAgentName` union type
- **Строки 114-118:** Обновить hint-текст "no enabled agents"

#### `cli/src/tui/components/ExitConventionsModal.tsx`
- **Строка 12:** Добавить `'opencode'` в `AiAgentName` union type

## 5. Новые файлы

### 5.1. `cli/src/adapters/opencode.ts`

```typescript
/**
 * Адаптер для агента OpenCode.
 *
 * OpenCode читает скиллы из тех же директорий, что и Claude Code:
 *   - Global: ~/.claude/skills/{name}/SKILL.md
 *   - Project: .claude/skills/{name}/SKILL.md
 *
 * Поэтому этот адаптер является тонкой обёрткой над ClaudeCodeAdapter,
 * *переиспользуя* его пути для install, remove и scanInstalled.
 */

import { AgentAdapter, Extension, Scope } from './types';
import { ClaudeCodeAdapter } from './claude-code';

export class OpencodeAdapter implements AgentAdapter {
  private delegate = new ClaudeCodeAdapter();

  install(ext: Extension, scope: Scope): void {
    this.delegate.install(ext, scope);
  }

  remove(ext: Extension, scope: Scope): void {
    this.delegate.remove(ext, scope);
  }

  scanInstalled(scope?: Scope): Extension[] {
    return this.delegate.scanInstalled(scope);
  }

  getExtensionPath(ext: Extension, scope: Scope): string {
    return this.delegate.getExtensionPath(ext, scope);
  }

  isInstalled(ext: Extension, scope: Scope): boolean {
    return this.delegate.isInstalled(ext, scope);
  }
}
```

### 5.2. `cli/base-skills/opencode/SKILL.md`

Bootstrap skill для OpenCode — аналогичный `base-skills/codex/SKILL.md` / `base-skills/cursor/SKILL.md`:

- Описание skill-hub CLI
- Команды для работы с расширениями
- Инструкции по MCP-серверу (`opencode mcp add`)

## 6. Что НЕ нужно менять

| Файл | Почему не менять |
|------|------------------|
| `cli/src/conventions.ts` | OpenCode не требует symlinks — он видит `.claude/skills/` и `.agents/skills/` |
| `cli/src/tui/hooks/useConventionsInit.ts` | OpenCode не участвует в init-agents flow |
| `cli/src/tui/hooks/useConventionsExit.ts` | OpenCode не участвует в exit-agents flow |
| `cli/src/commands/agents-conventions.ts` | Conventions не требуют специальной обработки для opencode |

## 7. Тесты

### 7.1. Новые тесты

- **`cli/src/adapters/opencode.test.ts`** — unit-тесты для `OpencodeAdapter`:
  - `install` делегирует `ClaudeCodeAdapter`
  - `remove` делегирует `ClaudeCodeAdapter`
  - `scanInstalled` возвращает результат `ClaudeCodeAdapter`
  - `getExtensionPath` возвращает путь от `ClaudeCodeAdapter`

### 7.2. Обновление существующих тестов

- **`cli/src/detect-agent.test.ts`** — добавить тесты:
  - Детекция по `OPENCODE=1`
  - Детекция по `OPENCODE_RUN_ID`
  - Детекция по `.opencode/` директории
- **`cli/src/base-setup.test.ts`** — добавить тесты для `getMcpConfigPath('opencode')` и `getBaseSkillDestPath('opencode')`

## 8. Порядок реализации

1. **Core types** — `catalog.ts`, `detect-agent.ts`, `config.ts`
2. **Adapter** — создать `adapters/opencode.ts`, обновить `get-adapter.ts`
3. **MCP & Base setup** — `mcp.ts`, `base-setup.ts`
4. **CLI & Launcher** — `index.ts`, `agent-launcher.ts`
5. **Commands** — 7 файлов в `cli/src/commands/`
6. **TUI** — screens, hooks, components
7. **Gitignore** — `gitignore-agents.ts`
8. **Base skill** — `cli/base-skills/opencode/SKILL.md`
9. **Tests** — новые + обновление существующих
10. **CLAUDE.md** — обновить документацию

## 9. Проверка после реализации

```bash
cd cli && npm run build      # должен собраться без ошибок
cd cli && npm test           # все тесты должны пройти
```

### Ручные проверки:

```bash
# 1. Детекция агента
skill-hub list               # должно показать opencode в списке агентов

# 2. Установка скилла
skill-hub install graphify --agent opencode --scope global

# 3. Запуск агента
skill-hub -a opencode run "hello"

# 4. TUI — opencode должен отображаться в Settings → AI-агенты
skill-hub
```

## 10. Связанные документы

- `docs/plans/codex-agent-support.md` — аналогичный план для Codex (reference)
- `CLAUDE.md` — текущая документация по архитектуре агентов
