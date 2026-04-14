# Design: InfoBar — постоянная строка статуса в TUI

**Дата:** 2026-03-28
**Статус:** Approved

## Контекст

TUI приложения skill-hub уже имеет шапку с табами и строку подсказок по клавишам, но не показывает никакой контекстной информации в покое. Пользователь не видит сколько расширений установлено, в каком scope работает и какой агент активен — без перехода на вкладку «Установленные» или «Настройки». Задача: добавить постоянную строку с этой информацией внизу экрана.

## Что добавляем

Новую постоянную строку между контентом экрана и строкой подсказок:

```
┌─────────────────────────────────────────┐
│ skill-hub  [1] Каталог  [2] Установл... │
├─────────────────────────────────────────┤
│         ...содержимое экрана...         │
├─────────────────────────────────────────┤
│ Установлено: 8 (global: 5  project: 3)  │  ← НОВОЕ
│   agent: claude-code   scope: project   │
├─────────────────────────────────────────┤
│ [Tab] следующий таб  [Ctrl+Q] выход     │
└─────────────────────────────────────────┘
```

## Архитектура

### Подход: Variant A — поднять useRegistry в App.tsx

`useRegistry` и `useSettings` вызываются в `App.tsx`. Счётчики и конфиг передаются в InfoBar через props. Экраны, которым нужны операции реестра, получают их через props вместо вызова хука напрямую.

### Новый компонент

**`cli/src/tui/components/InfoBar.tsx`**

```tsx
interface Props {
  totalCount: number;
  globalCount: number;
  projectCount: number;
  agent: AgentName;
  defaultScope: 'global' | 'project';
}
```

Отображает: `Установлено: 8  (global: 5  project: 3)   │   agent: claude-code   │   scope: project`

### Изменения в App.tsx

```ts
const registry = useRegistry();
const { config } = useSettings();

const globalCount = registry.installed.filter(e => e.scope === 'global').length;
const projectCount = registry.installed.filter(e => e.scope === 'project').length;
```

Layout:
```tsx
<Header />
<Box flexGrow={1}>{renderScreen()}</Box>
<InfoBar totalCount={...} globalCount={...} projectCount={...} agent={agent} defaultScope={config.defaultScope} />
<StatusBar message={statusMessage} status={statusType} />
<HintBar hints={hints} />
```

### Изменения в экранах

Экраны получают registry-операции через props вместо вызова `useRegistry()` самостоятельно:

| Экран | Получает через props |
|---|---|
| `InstalledScreen` | `installed`, `install`, `remove`, `move`, `update`, `isInstalled`, `loading` |
| `CatalogScreen` | `install`, `isInstalled` |
| `DetailScreen` | `install`, `remove`, `isInstalled` |
| `InstalledDetailScreen` | `remove`, `move`, `update` |
| `MoveScreen` | `move` |
| `SettingsScreen` | `config`, `updateConfig` |

## Критические файлы

- `cli/src/tui/App.tsx` — добавить useRegistry, useSettings, InfoBar
- `cli/src/tui/components/InfoBar.tsx` — новый компонент (создать)
- `cli/src/tui/screens/InstalledScreen.tsx` — убрать useRegistry, принять props
- `cli/src/tui/screens/CatalogScreen.tsx` — принять install/isInstalled через props
- `cli/src/tui/screens/DetailScreen.tsx` — принять install/remove/isInstalled через props
- `cli/src/tui/screens/InstalledDetailScreen.tsx` — принять remove/move/update через props
- `cli/src/tui/screens/MoveScreen.tsx` — принять move через props

## Верификация

1. `bash scripts/dev-link.sh` — собрать и слинковать CLI
2. `skill-hub` — запустить TUI
3. Убедиться что InfoBar виден внизу с реальными данными
4. Установить расширение → счётчик обновился
5. Удалить расширение → счётчик обновился
6. `cd` в другой проект — scope/agent корректны
