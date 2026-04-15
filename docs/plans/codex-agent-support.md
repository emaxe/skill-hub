# Plan: Добавление поддержки агента OpenAI Codex

## Контекст и цель

OpenAI Codex (CLI-агент) использует файл `AGENTS.md` для хранения инструкций — аналог `CLAUDE.md` для Claude Code. Файл может находиться в нескольких местах одновременно, но для skill-hub достаточно двух уровней:
- **Global:** `~/.codex/AGENTS.md`
- **Project:** `AGENTS.md` в корне проекта (или `.codex/AGENTS.md`)

Стратегия адаптера — **инъекция в один файл через HTML-маркеры** (как у `CopilotAdapter`), потому что Codex читает один `AGENTS.md` на каждом уровне иерархии, не директорию с подфайлами.

> **Решения приняты:** project scope = `.codex/AGENTS.md`, source-файлы = fallback на claude-code, детекция через `CODEX_SANDBOX` env var и `.codex/` директорию.

---

## Анализ текущего состояния

### Где упоминается список агентов (требует изменений)

| Файл | Что изменить |
|------|-------------|
| `src/catalog.ts` | Тип `AgentName` — добавить `'codex'` |
| `src/detect-agent.ts` | Добавить детект по env vars и `.codex/` директории |
| `src/config.ts` | `DEFAULT_CONFIG.aiAgents.agents` + `AGENT_SCOPE_MARKERS` |
| `src/adapters/get-adapter.ts` | Фабрика адаптеров — добавить кейс `'codex'` |
| `src/mcp.ts` | 7 инструментов — enum в каждом `inputSchema` |
| `src/index.ts` | Справочные тексты (`Агенты: ...`) |
| `src/tui/screens/SettingsScreen.tsx` | `AGENTS`, `AI_AGENTS` массивы |
| `src/tui/screens/InstalledScreen.tsx` | `AgentFilter`, `AGENT_FILTERS` массивы |
| `src/tui/hooks/useRegistry.ts` | `realAgents` массив |
| `src/tui/hooks/useConventionsInit.ts` | Тип `agentName` параметра |
| `src/tui/hooks/useConventionsExit.ts` | Тип `agentName` параметра |
| `src/tui/screens/settings/AiAgentsTab.tsx` | `AI_AGENTS` массив |
| `src/tui/components/InitConventionsModal.tsx` | Тип `AiAgentName` + текст подсказки |
| `src/tui/components/ExitConventionsModal.tsx` | Тип `AiAgentName` |
| `src/commands/search.ts` | Текст `--agent` опции |
| `src/commands/install.ts` | Текст `--agent` опции |
| `src/commands/remove.ts` | Текст `--agent` опции |
| `src/commands/list.ts` | Текст `--agent` опции |
| `src/commands/move.ts` | Текст `--agent` опции |
| `src/commands/update.ts` | Текст `--agent` опции |
| `src/commands/info.ts` | Текст `--agent` опции |
| `src/commands/agents-conventions.ts` | Допустимые значения агента |
| `src/conventions.ts` | Текст ошибки валидации агента |

### Новые файлы

| Файл | Описание |
|------|----------|
| `src/adapters/codex.ts` | Новый адаптер `CodexAdapter` |
| `src/adapters/codex.test.ts` | Unit-тесты адаптера |
| `base-skills/codex/SKILL.md` | Bootstrap-скилл для Codex |

---

## Детали реализации

### 1. Тип AgentName (`catalog.ts`)

```typescript
export type AgentName = 'claude-code' | 'cursor' | 'copilot' | 'agents-conventions' | 'codex';
```

Функция `platformKey()` — `codex` использует собственный ключ (не `claude-code`):
```typescript
export function platformKey(agent: AgentName): AgentName {
  return agent === 'agents-conventions' ? 'claude-code' : agent;
}
```

### 2. Автодетекция (`detect-agent.ts`)

Приоритет определения агента расширяется:
1. `CURSOR_TRACE` / `CURSOR_IDE` → `cursor`
2. `.cursor/` директория → `cursor`
3. `GITHUB_COPILOT` / `COPILOT_AGENT` → `copilot`
4. `CODEX_SANDBOX` / `CODEX_SANDBOX_NETWORK_DISABLED` env vars → `codex`
5. `.codex/` директория в CWD → `codex`
6. По умолчанию → `claude-code`

### 3. Адаптер `CodexAdapter` (`adapters/codex.ts`)

Стратегия: инъекция контента в `AGENTS.md` через HTML-маркеры.

**Пути файлов:**
- Global: `~/.codex/AGENTS.md`
- Project: `.codex/AGENTS.md`

**Маркеры** (аналогично Copilot):
```
<!-- skill-hub: {name} -->
...контент расширения...
<!-- /skill-hub: {name} -->
```

**Методы:**
- `getSourceFile(ext)` — возвращает `ext.platforms['codex'] || 'SKILL.md'`
- `getInstallPath(ext, scope)` — `~/.codex/AGENTS.md` или `.codex/AGENTS.md`
- `install()` — stripFrontmatter + инъекция секции с маркерами
- `remove()` — вырезать секцию по маркерам
- `isInstalled()` — проверить наличие start-маркера в файле
- `scanInstalled()` — regex-поиск маркеров в обоих файлах

### 4. Конфиг (`config.ts`)

Добавить `'codex'` в `DEFAULT_CONFIG`:
```typescript
aiAgents: {
  agents: {
    'codex': { enabled: false, useProxy: false },
    // ...остальные
  }
}
```

Добавить `.codex` в `AGENT_SCOPE_MARKERS` для правильного определения корня проекта.

### 5. Bootstrap-скилл (`base-skills/codex/SKILL.md`)

По аналогии с `base-skills/copilot/SKILL.md` — инструкция для Codex-агента как пользоваться skill-hub через MCP или CLI.

---

## Список задач

### Фаза 1 — Ядро типов и логика

- [ ] `catalog.ts` — добавить `'codex'` в `AgentName`
- [ ] `detect-agent.ts` — добавить детект Codex
- [ ] `config.ts` — добавить `'codex'` в DEFAULT_CONFIG и AGENT_SCOPE_MARKERS
- [ ] `adapters/codex.ts` — создать `CodexAdapter`
- [ ] `adapters/get-adapter.ts` — добавить кейс для `'codex'`

### Фаза 2 — MCP и CLI

- [ ] `mcp.ts` — обновить enum во всех 7 инструментах
- [ ] `index.ts` — обновить справочные тексты
- [ ] Все файлы команд (`commands/*.ts`) — обновить тексты `--agent` опций

### Фаза 3 — TUI

- [ ] `SettingsScreen.tsx` — добавить `'codex'` в `AGENTS` и `AI_AGENTS`
- [ ] `InstalledScreen.tsx` — добавить `'codex'` в `AgentFilter` и `AGENT_FILTERS`
- [ ] `useRegistry.ts` — добавить `'codex'` в `realAgents`
- [ ] `useConventionsInit.ts` / `useConventionsExit.ts` — расширить тип `agentName`
- [ ] `AiAgentsTab.tsx` — добавить `'codex'` в `AI_AGENTS`
- [ ] `InitConventionsModal.tsx` / `ExitConventionsModal.tsx` — расширить тип и тексты

### Фаза 4 — Conventions

- [ ] `conventions.ts` — добавить `'codex'` в допустимые агенты
- [ ] `commands/agents-conventions.ts` — обновить валидацию и тексты

### Фаза 5 — Тесты и документация

- [ ] `adapters/codex.test.ts` — unit-тесты адаптера (install, remove, isInstalled, scanInstalled)
- [ ] `detect-agent.test.ts` — добавить тесты для детекта Codex
- [ ] `base-skills/codex/SKILL.md` — bootstrap-скилл
- [ ] `CLAUDE.md` — обновить документацию (таблицы, архитектура, директории)

---

## Принятые решения

| Вопрос | Решение |
|--------|---------|
| **Project scope путь** | `.codex/AGENTS.md` (изолированно, не конфликтует с conventions) |
| **Source-файлы** | Fallback на `claude-code` (SKILL.md) — собственный CODEX.md не нужен |
| **Env vars детекции** | `CODEX_SANDBOX` (реально устанавливается Codex при sandbox-запуске дочерних процессов, источник: [openai/codex — spawn.rs](https://github.com/openai/codex/blob/main/codex-rs/core/src/spawn.rs)) + `.codex/` директория |

### Детали env vars (из исходников openai/codex)

Codex устанавливает два env var при запуске команд в sandbox:
- `CODEX_SANDBOX=seatbelt` (macOS) — агент запускает shell tool в sandbox
- `CODEX_SANDBOX_NETWORK_DISABLED=1` — сеть отключена в sandbox

Оба могут использоваться для детекции. `CODEX_SANDBOX` — более надёжный индикатор.

**Итоговый приоритет детекции** (`detect-agent.ts`):
1. `CURSOR_TRACE` / `CURSOR_IDE` → `cursor`
2. `.cursor/` директория → `cursor`
3. `GITHUB_COPILOT` / `COPILOT_AGENT` → `copilot`
4. `CODEX_SANDBOX` / `CODEX_SANDBOX_NETWORK_DISABLED` → `codex`
5. `.codex/` директория в CWD → `codex`
6. По умолчанию → `claude-code`

### Адаптер CodexAdapter — директории

| Scope | Путь |
|-------|------|
| Global | `~/.codex/AGENTS.md` |
| Project | `.codex/AGENTS.md` |
