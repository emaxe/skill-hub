# Спецификация: Interactive CLI

## Контекст

Текущий CLI (`@emaxe/skill-hub`) работает в режиме «выполнил команду — вышел»: каждая операция (search, install, remove и т.д.) требует повторного запуска процесса. Это неудобно для интерактивного просмотра каталога и управления расширениями.

Цель — добавить полноценный TUI (Terminal UI) режим, который запускается при вызове `skill-hub` без аргументов. Существующие команды (`skill-hub search git`, `skill-hub install skill:name` и т.д.) продолжают работать без изменений.

## Требования

### REQ-1: Гибридный запуск

CLI определяет режим по аргументам:
- `skill-hub` (без аргументов) → запуск TUI
- `skill-hub <command> [args]` → обычная работа через Commander (как сейчас)

### REQ-2: Fullscreen TUI на базе Ink

- Используется библиотека **Ink** (React для терминала) с fullscreen-режимом (alternate screen)
- React-компоненты в `cli/src/tui/`
- JSX поддержка через настройку tsconfig (`"jsx": "react-jsx"`)

### REQ-3: Совместимость с CommonJS

Проект использует `module: "CommonJS"`. Необходимо использовать **Ink v3** (последняя CJS-совместимая версия) + `react@17` или `react@18`, совместимый с Ink v3.

Если Ink v3 не покрывает нужный функционал (fullscreen), допускается миграция на ESM (`"module": "ESNext"` + `"type": "module"` в package.json), но с обязательной проверкой совместимости всех зависимостей (chalk@4, ora@5, commander, simple-git).

### REQ-4: Экран «Каталог» (Catalog Browser)

- Список всех расширений из каталога с колонками: тип, имя, версия, описание
- Поле поиска (`/` для фокуса) с фильтрацией в реальном времени (debounce)
- Фильтры по типу (skill/agent/command) и тегам (одинарный выбор — один тег за раз)
- `Enter` — открыть детальную карточку
- `i` — установить выбранное расширение
- Навигация: `↑↓` по списку

### REQ-5: Экран «Установленные» (Installed)

- Список установленных расширений (данные из registry + filesystem scan через адаптер)
- Колонки: тип, имя, scope (global/project), версия, источник (skill-hub/manual)
- Фильтр по scope
- `d` — удалить (с подтверждением через модал)
- `m` — перенести scope (открывает MoveScreen)
- `u` — обновить расширение

### REQ-6: Экран «Детали расширения» (Detail Screen)

- Вложенный экран (stack-навигация, `Esc` — назад)
- Отображает: имя, версия, тип, автор, scope, описание, теги, платформы, зависимости
- Действия: `i` (установить), `d` (удалить, если установлено)

### REQ-7: Экран «Настройки» (Settings)

- Текущий агент (claude-code/cursor/copilot) — выбор
- Scope по умолчанию (global/project) — выбор
- Информация о кэше (путь, количество расширений)
- Статус MCP (настроен/не настроен)
- Кнопки: «Обновить кэш», «Настроить MCP»
- Настройки сохраняются в `~/.skill-hub/config.json`

### REQ-8: Экран «Перенос» (Move Screen)

- Вложенный экран из «Установленные» (по `m`)
- Показывает текущий scope и предлагает перенести в противоположный
- `Enter` — подтвердить, `Esc` — отмена

### REQ-9: Классические hotkey с подсказками

Стиль навигации — классический (стрелки, Tab, буквенные шорткаты):

| Клавиша | Контекст | Действие |
|---------|----------|----------|
| `Tab` / `Shift+Tab` | Везде | Следующий/предыдущий таб |
| `1-3` | Верхний уровень | Перейти к табу напрямую |
| `↑↓` | Списки | Навигация по элементам |
| `Enter` | Списки | Открыть детали / подтвердить |
| `Esc` | Вложенные экраны | Назад |
| `/` | Каталог | Фокус на поиск |
| `i` | Каталог, Детали | Установить |
| `d` | Установленные, Детали | Удалить |
| `m` | Установленные | Перенести scope |
| `u` | Установленные | Обновить |
| `q` / `Ctrl+C` | Везде | Выход из TUI |

Внизу каждого экрана — `HintBar` с контекстными подсказками (как в lazygit/mc).

### REQ-10: Переиспользование бизнес-логики

TUI НЕ дублирует логику команд. Все операции выполняются через существующие модули:
- `catalog.ts` — `loadCatalog()`, `searchExtensions()`, `filterByAgent()`
- `registry.ts` — `Registry` (add, remove, list, get, isInstalled)
- `git.ts` — `ensureCache()`, `updateCache()`
- `adapters/` — `install()`, `remove()`, `scanInstalled()`, `isInstalled()`
- `detect-agent.ts` — `detectAgent()`

### REQ-11: Обратная связь по операциям

- Мутирующие операции (install, remove, move, update) показывают прогресс в `StatusBar`
- При ошибке — красное сообщение с авто-скрытием (3с)
- Деструктивные действия (delete) — модальное подтверждение (`Confirm`)

## Ограничения

- **Не меняем** поведение существующих CLI-команд (search, install и т.д.)
- **Не добавляем** MCP-инструменты для TUI (TUI — только для человека в терминале)
- **Node ≥18** (как в engines)
- **Тесты TUI-компонентов** — через `ink-testing-library` (unit-тесты рендера)
- Если миграция на ESM необходима — это отдельная задача в плане, выполняемая первой

## Макеты и референсы

> ASCII-макеты экранов представлены в дизайне выше (Phase 1a). Полноценных Figma-макетов нет — не применимо.

Референсы стиля:
- **lazygit** — навигация табами, hint bar внизу, stack-навигация вложенных экранов
- **k9s** — классический стиль hotkey, fullscreen TUI

## Кодстайл и конвенции

- TypeScript strict mode (`"strict": true`)
- CommonJS модули (или ESM после миграции)
- Имена файлов: kebab-case (`catalog-screen.tsx`)
- Компоненты: PascalCase (`CatalogScreen`)
- Хуки: camelCase с префиксом `use` (`useCatalog`)
- Фабрики команд: `makeXxxCommand()` — существующий паттерн, TUI добавляет свою точку входа
- Русский в UI-строках (описания, подсказки), английский в коде
- Тесты: `*.test.ts` / `*.test.tsx` рядом с исходником

## Переиспользуемые решения

| Модуль | Путь | Использование в TUI |
|--------|------|---------------------|
| loadCatalog, searchExtensions | `cli/src/catalog.ts` | Хук `useCatalog` |
| Registry | `cli/src/registry.ts` | Хук `useRegistry` |
| ensureCache, updateCache | `cli/src/git.ts` | Инициализация TUI, кнопка «Обновить кэш» |
| AgentAdapter, getAdapter | `cli/src/adapters/` | install/remove/move/scan операции |
| detectAgent | `cli/src/detect-agent.ts` | Дефолтный агент в Settings |
| chalk палитра | Используется повсюду | Согласованные цвета в `theme.ts` |

## Критерии приёмки

- [ ] `skill-hub` без аргументов запускает fullscreen TUI
- [ ] `skill-hub search git` и другие команды работают как прежде
- [ ] Все 5 экранов (Каталог, Установленные, Детали, Настройки, Перенос) функционируют
- [ ] Навигация: Tab между табами, ↑↓ по спискам, Enter/Esc для вложенных экранов
- [ ] Все hotkey из таблицы REQ-9 работают
- [ ] HintBar показывает актуальные подсказки для текущего контекста
- [ ] Install/Remove/Move выполняются и обновляют UI
- [ ] Ошибки показываются в StatusBar
- [ ] Деструктивные действия требуют подтверждения
- [ ] Settings сохраняются в `~/.skill-hub/config.json`
- [ ] `npm test` проходит (существующие + новые тесты)
- [ ] `npm run build` собирается без ошибок

## Затронутые файлы

### Новые файлы
- `cli/src/tui/App.tsx` — корневой компонент
- `cli/src/tui/hooks/useNavigation.ts`
- `cli/src/tui/hooks/useCatalog.ts`
- `cli/src/tui/hooks/useRegistry.ts`
- `cli/src/tui/hooks/useKeymap.ts`
- `cli/src/tui/hooks/useSettings.ts`
- `cli/src/tui/screens/CatalogScreen.tsx`
- `cli/src/tui/screens/InstalledScreen.tsx`
- `cli/src/tui/screens/DetailScreen.tsx`
- `cli/src/tui/screens/SettingsScreen.tsx`
- `cli/src/tui/screens/MoveScreen.tsx`
- `cli/src/tui/components/ExtensionList.tsx`
- `cli/src/tui/components/HintBar.tsx`
- `cli/src/tui/components/Header.tsx`
- `cli/src/tui/components/SearchInput.tsx`
- `cli/src/tui/components/FilterBar.tsx`
- `cli/src/tui/components/StatusBar.tsx`
- `cli/src/tui/components/Confirm.tsx`
- `cli/src/tui/theme.ts`

### Модифицируемые файлы
- `cli/src/index.ts` — условие запуска TUI при отсутствии аргументов
- `cli/tsconfig.json` — добавить `"jsx": "react-jsx"`
- `cli/package.json` — добавить зависимости (ink, react, @types/react, ink-testing-library)
