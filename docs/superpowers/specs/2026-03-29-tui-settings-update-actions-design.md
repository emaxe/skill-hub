# Design: TUI Settings — Update Actions

**Date:** 2026-03-29

## Problem

В разделе Настройки TUI нет возможности обновить уже установленные компоненты:
- Кэш (`~/.skill-hub`) — нет кнопки git pull
- MCP и base-skill — при `✓ установлен` нет кнопки переустановки

## Solution

Добавить два новых интерактивных поля в `SettingsScreen`.

---

## New Fields

### `updateCache`

- **Когда появляется:** `cacheInstalled === true`
- **Расположение:** сразу после строки с информацией о кэше
- **Действие (Enter):** вызывает `updateCache()` из `git.ts`
- **Состояние:** `cacheUpdateState: 'idle' | 'loading' | 'success' | 'error'` — локальный стейт в `SettingsScreen`
- **Рендеринг:**
  ```
  ▶ Обновить кэш:  [Enter]          ← idle
    Обновить кэш:  обновляем...     ← loading
    Обновить кэш:  ✓ обновлён       ← success (затем recheck)
    Обновить кэш:  ошибка           ← error
  ```

### `updateAgent`

- **Когда появляется:** `mcpInstalled === true || baseSkillInstalled === true`
- **Расположение:** в секции "Настройка (agent)", после строк MCP и base-skill
- **Действие (Enter):** вызывает `doUpdateSelf()` из хука `useBaseSetup`
- **Состояние:** `updateSelfState: InstallState` — добавляется в хук `useBaseSetup`
- **Рендеринг:**
  ```
  ▶ Переустановить: [Enter — обновить MCP + скил]   ← idle
    Переустановить: обновляем...                    ← loading
    Переустановить: ✓ обновлено                     ← success
    Переустановить: ошибка                          ← error
  ```

---

## Changes

### `cli/src/tui/hooks/useBaseSetup.ts`

- Добавить `updateSelfState: InstallState` в интерфейс `UseBaseSetupResult`
- В `doUpdateSelf`: обернуть в try/catch, обновлять `updateSelfState` (loading → success/error), вызывать `recheck()`

### `cli/src/tui/screens/SettingsScreen.tsx`

- Расширить `Field`: добавить `'updateCache' | 'updateAgent'`
- Добавить локальный стейт `cacheUpdateState: InstallState`
- В `fields` (useMemo): добавить `updateCache` если `cacheInstalled`, добавить `updateAgent` если `mcpInstalled === true || baseSkillInstalled === true`
- В `useInput` (Enter): обработать `updateCache` и `updateAgent`
- В рендеринге: добавить строки для обоих полей

---

## Verification

1. `cd cli && npm run build` — сборка без ошибок
2. `skill-hub` → вкладка Настройки:
   - При установленном кэше видно поле "Обновить кэш", Enter запускает git pull
   - При установленном MCP/base-skill видно поле "Переустановить", Enter переписывает файлы
   - Состояния loading / success / error отображаются корректно
   - При смене агента на незаполненный — поля не отображаются
