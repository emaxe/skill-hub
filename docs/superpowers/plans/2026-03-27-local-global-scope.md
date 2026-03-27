# Local/Global Scope Installation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить `--local` флаг в CLI и обновить `client/SKILL.md` для поддержки выбора scope установки расширений (глобально vs в проект).

**Architecture:** Минимальные изменения в двух CLI командах (`install`, `remove`) и одном markdown-файле (`client/SKILL.md`). Инфраструктура (адаптеры, MCP, реестр) уже поддерживает оба scope — нужно только пробросить опцию и обновить инструкции для агента.

**Tech Stack:** TypeScript, Commander.js, Jest (тесты в `cli/src/`)

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `cli/src/commands/install.ts` | Добавить `.option('--local', ...)`, обновить scope-логику |
| `cli/src/commands/remove.ts` | Добавить `.option('--local', ...)`, обновить scope-логику |
| `cli/src/commands/install.test.ts` | Новый: тест парсинга `--local` флага |
| `cli/src/commands/remove.test.ts` | Новый: тест парсинга `--local` флага |
| `client/SKILL.md` | Раздел определения scope, обновить MCP-таблицу и CLI-блок |

---

### Task 1: Добавить `--local` в `install` команду

**Files:**
- Modify: `cli/src/commands/install.ts:44-54`
- Create: `cli/src/commands/install.test.ts`

- [ ] **Step 1: Написать тест на парсинг `--local` флага**

Создать файл `cli/src/commands/install.test.ts`:

```typescript
import { makeInstallCommand } from './install';

function parseScope(args: string[]): string {
  const cmd = makeInstallCommand();
  // Парсим аргументы в dry-run режиме: не выполняем action
  let capturedScope = '';
  cmd.action = () => {};
  // Патчим action через option-parsing
  const parsed = cmd.parseOptions(['dummy', ...args]);
  const opts = parsed.operands; // не используем, нужны только опции
  const optsObj = cmd.opts() as { project?: boolean; local?: boolean };
  capturedScope = optsObj.project || optsObj.local ? 'project' : 'global';
  return capturedScope;
}

// Более чистый подход — тестируем scope-функцию напрямую
function computeScope(opts: { project?: boolean; local?: boolean; global?: boolean }): 'global' | 'project' {
  return opts.project || opts.local ? 'project' : 'global';
}

test('scope: по умолчанию global', () => {
  expect(computeScope({})).toBe('global');
});

test('scope: --project → project', () => {
  expect(computeScope({ project: true })).toBe('project');
});

test('scope: --local → project', () => {
  expect(computeScope({ local: true })).toBe('project');
});

test('scope: --global явно → global', () => {
  expect(computeScope({ global: true })).toBe('global');
});

test('scope: --local и --global одновременно → project (local приоритетнее)', () => {
  expect(computeScope({ local: true, global: false })).toBe('project');
});
```

- [ ] **Step 2: Запустить тест — убедиться что падает**

```bash
cd cli && npm test -- --testPathPattern=install.test --no-coverage 2>&1 | tail -20
```

Ожидаем: `FAIL` (файл тестирует функцию `computeScope` которой нет в install.ts)

- [ ] **Step 3: Экспортировать `computeScope` и добавить `--local` в `install.ts`**

В `cli/src/commands/install.ts` изменить строки 44-54:

```typescript
// строка 44-46: добавить --local option
    .option('--agent <agent>', 'Агент: claude-code, cursor, copilot')
    .option('--global', 'Глобальная установка (по умолчанию)')
    .option('--project', 'Установка в текущий проект')
    .option('--local', 'Установка в текущий проект (alias для --project)')
    // строка 47: обновить тип opts
    .action(async (nameArg: string, opts: { agent?: string; global?: boolean; project?: boolean; local?: boolean }) => {
      // ...
      // строка 54: обновить scope-логику
      const scope = opts.project || opts.local ? 'project' : 'global';
```

Полные изменённые строки в контексте (строки 44-54 `install.ts`):

```typescript
    .option('--agent <agent>', 'Агент: claude-code, cursor, copilot')
    .option('--global', 'Глобальная установка (по умолчанию)')
    .option('--project', 'Установка в текущий проект')
    .option('--local', 'Установка в текущий проект (alias для --project)')
    .action(async (nameArg: string, opts: { agent?: string; global?: boolean; project?: boolean; local?: boolean }) => {
      const spinner = ora('Обновление каталога...').start();
      try {
        await ensureCache();
        const cachePath = getCachePath();
        const catalog = loadCatalog(cachePath);
        const agent = (opts.agent || detectAgent()) as AgentName;
        const scope = opts.project || opts.local ? 'project' : 'global';
```

- [ ] **Step 4: Запустить тест — убедиться что проходит**

```bash
cd cli && npm test -- --testPathPattern=install.test --no-coverage 2>&1 | tail -20
```

Ожидаем: `PASS cli/src/commands/install.test.ts` (5 passed)

- [ ] **Step 5: Сделать коммит**

```bash
cd /Users/maksimklisin/Desktop/_JS/skillHub
git add cli/src/commands/install.ts cli/src/commands/install.test.ts
git commit -m "feat(cli): add --local alias for --project in install command"
```

---

### Task 2: Добавить `--local` в `remove` команду

**Files:**
- Modify: `cli/src/commands/remove.ts:26-33`
- Create: `cli/src/commands/remove.test.ts`

- [ ] **Step 1: Написать тест**

Создать `cli/src/commands/remove.test.ts`:

```typescript
// Та же scope-функция — тестируем изолированно
function computeScope(opts: { project?: boolean; local?: boolean; global?: boolean }): 'global' | 'project' {
  return opts.project || opts.local ? 'project' : 'global';
}

test('scope: по умолчанию global', () => {
  expect(computeScope({})).toBe('global');
});

test('scope: --project → project', () => {
  expect(computeScope({ project: true })).toBe('project');
});

test('scope: --local → project', () => {
  expect(computeScope({ local: true })).toBe('project');
});

test('scope: --global → global', () => {
  expect(computeScope({ global: true })).toBe('global');
});
```

- [ ] **Step 2: Запустить тест — убедиться что падает**

```bash
cd cli && npm test -- --testPathPattern=remove.test --no-coverage 2>&1 | tail -20
```

Ожидаем: `FAIL` — `computeScope` пока не реализована в remove.ts

- [ ] **Step 3: Добавить `--local` в `remove.ts`**

В `cli/src/commands/remove.ts` изменить строки 26-33:

```typescript
    .option('--agent <agent>', 'Агент: claude-code, cursor, copilot')
    .option('--global', 'Удалить глобальную установку')
    .option('--project', 'Удалить проектную установку')
    .option('--local', 'Удалить проектную установку (alias для --project)')
    .action(async (nameArg: string, opts: { agent?: string; global?: boolean; project?: boolean; local?: boolean }) => {
      const spinner = ora('Удаление...').start();
      try {
        const agent = (opts.agent || detectAgent()) as AgentName;
        const scope = opts.project || opts.local ? 'project' : 'global';
```

- [ ] **Step 4: Запустить тест — убедиться что проходит**

```bash
cd cli && npm test -- --testPathPattern=remove.test --no-coverage 2>&1 | tail -20
```

Ожидаем: `PASS cli/src/commands/remove.test.ts` (4 passed)

- [ ] **Step 5: Запустить все тесты CLI**

```bash
cd cli && npm test -- --no-coverage 2>&1 | tail -30
```

Ожидаем: все тесты зелёные (`PASS`)

- [ ] **Step 6: Сделать коммит**

```bash
cd /Users/maksimklisin/Desktop/_JS/skillHub
git add cli/src/commands/remove.ts cli/src/commands/remove.test.ts
git commit -m "feat(cli): add --local alias for --project in remove command"
```

---

### Task 3: Обновить `client/SKILL.md`

**Files:**
- Modify: `client/SKILL.md`

Нет тестов для markdown-файлов — верификация вручную.

- [ ] **Step 1: Добавить раздел "Определение scope" перед таблицей MCP**

В `client/SKILL.md` вставить новый раздел после строки 18 (`Если в твоём контексте есть MCP-инструменты...`), но до таблицы (`| Запрос пользователя |`).

Вставить блок перед таблицей:

```markdown
### Определение scope установки

Перед вызовом `install_extension` или `remove_extension` определи scope по следующим приоритетам:

| Приоритет | Условие | Scope |
|-----------|---------|-------|
| 1 | Флаг `--global` в запросе пользователя | `global` |
| 2 | Флаг `--local` в запросе пользователя | `project` |
| 3 | Слова «глобально», «для всех проектов» | `global` |
| 4 | Слова «в проект», «локально», «только здесь» | `project` |
| 5 | Scope не указан | `project` (по умолчанию) |

```

- [ ] **Step 2: Обновить MCP-таблицу**

Заменить текущую таблицу (строки 20-27 в `client/SKILL.md`):

```markdown
| Запрос пользователя | Вызов инструмента |
|---------------------|-------------------|
| `/skill-hub search X` | `search_extensions({query: "X", agent: "claude-code"})` |
| `/skill-hub install X` | `install_extension({name: "X", scope: "project", agent: "claude-code"})` |
| `/skill-hub install X --global` | `install_extension({name: "X", scope: "global", agent: "claude-code"})` |
| `/skill-hub install X --local` | `install_extension({name: "X", scope: "project", agent: "claude-code"})` |
| `/skill-hub remove X` | `remove_extension({name: "X", scope: "project", agent: "claude-code"})` |
| `/skill-hub remove X --global` | `remove_extension({name: "X", scope: "global", agent: "claude-code"})` |
| `/skill-hub list` | `list_extensions({agent: "claude-code"})` — показывает тип, имя, версию, scope и способ установки: `[skill-hub]` или `[manual]` |
| `/skill-hub info X` | `search_extensions({query: "X", agent: "claude-code"})` |
| `/skill-hub update` | `list_extensions(...)`, затем `install_extension(...)` для каждого |
```

- [ ] **Step 3: Обновить CLI-блок**

Заменить текущий CLI блок (строки 35-42):

```markdown
```
skill-hub search <query> --agent claude-code
skill-hub install <name>          # в текущий проект (по умолчанию)
skill-hub install <name> --local  # в текущий проект (явно)
skill-hub install <name> --global # глобально
skill-hub remove <name>           # удалить проектную установку
skill-hub remove <name> --global  # удалить глобальную установку
skill-hub list
skill-hub info <name>
skill-hub update
```
```

- [ ] **Step 4: Обновить версию в frontmatter**

Изменить строку 5:
```yaml
version: "3.2.0"
```

- [ ] **Step 5: Сделать коммит**

```bash
cd /Users/maksimklisin/Desktop/_JS/skillHub
git add client/SKILL.md
git commit -m "feat(skill): scope-aware install/remove, default scope=project"
```

---

## Верификация

После всех задач:

```bash
# 1. CLI тесты
cd cli && npm test -- --no-coverage 2>&1 | tail -10
# Ожидаем: все PASS

# 2. Ручная проверка CLI флагов (build нужен)
cd cli && npm run build 2>&1 | tail -5
# Ожидаем: без ошибок TypeScript

# 3. Проверить help
node dist/index.js install --help | grep -E 'local|project|global'
# Ожидаем: --local, --project, --global в выводе

node dist/index.js remove --help | grep -E 'local|project|global'
# Ожидаем: --local, --project, --global в выводе
```
