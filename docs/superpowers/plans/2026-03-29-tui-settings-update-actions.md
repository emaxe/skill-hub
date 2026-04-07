# TUI Settings — Update Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в TUI раздел Настроек два новых поля: "Обновить кэш" и "Переустановить агента (MCP + base-skill)".

**Architecture:** Расширяем хук `useBaseSetup` трекингом состояния `updateSelfState`, в `SettingsScreen` добавляем два новых поля типа `Field`, каждое появляется условно, обрабатывает Enter и отображает состояние idle/loading/success/error.

**Tech Stack:** TypeScript, React (Ink), `simple-git` (через `updateCache` из `git.ts`)

---

### Task 1: Добавить `updateSelfState` в хук `useBaseSetup`

**Files:**
- Modify: `cli/src/tui/hooks/useBaseSetup.ts`

Текущий `doUpdateSelf` не отслеживает состояние. Нужно добавить `updateSelfState: InstallState` в интерфейс и реализацию, а также сбрасывать его при смене агента.

- [ ] **Шаг 1: Обновить интерфейс `UseBaseSetupResult`**

В `cli/src/tui/hooks/useBaseSetup.ts` изменить интерфейс:

```typescript
export interface UseBaseSetupResult {
  status: SetupStatus | null;
  checking: boolean;
  mcpInstallState: InstallState;
  baseSkillInstallState: InstallState;
  updateSelfState: InstallState;
  doInstallMcp: () => Promise<void>;
  doInstallBaseSkill: () => Promise<void>;
  doUpdateSelf: () => Promise<void>;
}
```

- [ ] **Шаг 2: Добавить стейт и сброс в эффекте**

В теле функции `useBaseSetup` добавить стейт после `baseSkillInstallState`:

```typescript
const [updateSelfState, setUpdateSelfState] = useState<InstallState>('idle');
```

В существующем `useEffect` (зависимости `[agent, recheckKey]`) добавить сброс:

```typescript
useEffect(() => {
  let cancelled = false;
  setChecking(true);
  setStatus(null);
  setMcpInstallState('idle');
  setBaseSkillInstallState('idle');
  setUpdateSelfState('idle');
  checkSetupStatus(agent).then(result => {
    if (cancelled || !mountedRef.current) return;
    setStatus(result);
    setChecking(false);
  });
  return () => { cancelled = true; };
}, [agent, recheckKey]);
```

- [ ] **Шаг 3: Обновить `doUpdateSelf` — добавить трекинг состояния**

Заменить текущую реализацию `doUpdateSelf`:

```typescript
const doUpdateSelf = useCallback(async () => {
  setUpdateSelfState('loading');
  try {
    await updateSelf(agent);
    if (!mountedRef.current) return;
    setUpdateSelfState('success');
    recheck();
  } catch {
    if (!mountedRef.current) return;
    setUpdateSelfState('error');
  }
}, [agent, recheck]);
```

- [ ] **Шаг 4: Добавить `updateSelfState` в return**

```typescript
return {
  status,
  checking,
  mcpInstallState,
  baseSkillInstallState,
  updateSelfState,
  doInstallMcp,
  doInstallBaseSkill,
  doUpdateSelf,
};
```

- [ ] **Шаг 5: Собрать**

```bash
cd /Users/maksimklisin/Desktop/_JS/skillHub/cli && npm run build
```

Ожидается: успешная сборка без ошибок.

- [ ] **Шаг 6: Коммит**

```bash
git add cli/src/tui/hooks/useBaseSetup.ts
git commit -m "feat(tui): track updateSelfState in useBaseSetup hook"
```

---

### Task 2: Добавить поля "Обновить кэш" и "Переустановить" в SettingsScreen

**Files:**
- Modify: `cli/src/tui/screens/SettingsScreen.tsx`

- [ ] **Шаг 1: Обновить импорты**

Добавить `updateCache` в импорт из `../../git`:

```typescript
import { getCachePath, isCloned, resetCache, updateCache } from '../../git';
```

Добавить `InstallState` в импорт из `../hooks/useBaseSetup`:

```typescript
import { useBaseSetup, InstallState } from '../hooks/useBaseSetup';
```

- [ ] **Шаг 2: Расширить тип `Field`**

```typescript
type Field = 'agent' | 'scope' | 'registryUrl' | 'installMcp' | 'installBaseSkill' | 'updateCache' | 'updateAgent';
```

- [ ] **Шаг 3: Добавить локальный стейт для обновления кэша**

После строки `const setup = useBaseSetup(localAgent);` добавить:

```typescript
const [cacheUpdateState, setCacheUpdateState] = useState<InstallState>('idle');
```

- [ ] **Шаг 4: Обновить вычисление `fields` в useMemo**

Текущий useMemo:

```typescript
const fields = useMemo<Field[]>(() => {
  const extra: Field[] = [];
  if (setup.status?.mcpInstalled === false) extra.push('installMcp');
  if (setup.status?.baseSkillInstalled === false) extra.push('installBaseSkill');
  return [...BASE_FIELDS, ...extra];
}, [setup.status]);
```

Заменить на:

```typescript
const fields = useMemo<Field[]>(() => {
  const extra: Field[] = [];
  if (setup.status?.mcpInstalled === false) extra.push('installMcp');
  if (setup.status?.baseSkillInstalled === false) extra.push('installBaseSkill');
  if (cacheInstalled) extra.push('updateCache');
  if (setup.status?.mcpInstalled === true || setup.status?.baseSkillInstalled === true) extra.push('updateAgent');
  return [...BASE_FIELDS, ...extra];
}, [setup.status, cacheInstalled]);
```

- [ ] **Шаг 5: Добавить обработку Enter для новых полей**

В блоке `if (key.return)` в `useInput`, после обработки `installBaseSkill`, добавить:

```typescript
if (activeField === 'updateCache') {
  setCacheUpdateState('loading');
  updateCache()
    .then(() => {
      setCacheUpdateState('success');
      setStatus('Кэш обновлён', 'success');
    })
    .catch(() => {
      setCacheUpdateState('error');
      setStatus('Ошибка обновления кэша', 'error');
    });
  return;
}
if (activeField === 'updateAgent') {
  setup.doUpdateSelf()
    .then(() => setStatus('Агент обновлён', 'success'))
    .catch(() => setStatus('Ошибка обновления агента', 'error'));
  return;
}
```

- [ ] **Шаг 6: Добавить рендеринг поля "Обновить кэш"**

После блока `{/* Информация о кэше */}` (строка `<Box marginBottom={2}>` с `Кэш:`) добавить:

```tsx
{/* Обновить кэш */}
{cacheInstalled && (
  <Box marginBottom={1}>
    <Text color={activeField === 'updateCache' ? theme.selected : theme.secondary}>
      {activeField === 'updateCache' ? '▶ ' : '  '}{'Обновить кэш: '}
    </Text>
    {cacheUpdateState === 'loading' && <Text color={theme.warning}>обновляем...</Text>}
    {cacheUpdateState === 'idle' && <Text dimColor>[Enter]</Text>}
    {cacheUpdateState === 'success' && <Text color={theme.success}>✓ обновлён</Text>}
    {cacheUpdateState === 'error' && <Text color={theme.error}>ошибка</Text>}
  </Box>
)}
```

- [ ] **Шаг 7: Добавить рендеринг поля "Переустановить"**

В конец секции `{/* Настройка агента */}`, после блока с "Базовый скил", перед закрывающим `</Box>`, добавить:

```tsx
{/* Переустановить MCP + base-skill */}
{(setup.status?.mcpInstalled === true || setup.status?.baseSkillInstalled === true) && (
  <Box>
    <Text color={activeField === 'updateAgent' ? theme.selected : theme.secondary}>
      {activeField === 'updateAgent' ? '▶ ' : '  '}{'Переустановить: '}
    </Text>
    {setup.updateSelfState === 'loading' && <Text color={theme.warning}>обновляем...</Text>}
    {setup.updateSelfState === 'idle' && <Text dimColor>[Enter — обновить MCP + скил]</Text>}
    {setup.updateSelfState === 'success' && <Text color={theme.success}>✓ обновлено</Text>}
    {setup.updateSelfState === 'error' && <Text color={theme.error}>ошибка</Text>}
  </Box>
)}
```

- [ ] **Шаг 8: Собрать**

```bash
cd /Users/maksimklisin/Desktop/_JS/skillHub/cli && npm run build
```

Ожидается: успешная сборка без ошибок TypeScript.

- [ ] **Шаг 9: Проверить вручную**

```bash
skill-hub
```

1. Вкладка `[3] Настройки`
2. Убедиться что при установленном кэше видно поле "Обновить кэш", навигация ↑↓ работает, Enter запускает обновление
3. Переключить агент на тот, у которого установлены MCP и/или base-skill
4. Убедиться что видно поле "Переустановить", Enter переустанавливает компоненты
5. Переключить агент на тот, у которого ничего не установлено — поле "Переустановить" не должно появляться

- [ ] **Шаг 10: Коммит**

```bash
git add cli/src/tui/screens/SettingsScreen.tsx
git commit -m "feat(tui): add update cache and reinstall agent fields in settings"
```
