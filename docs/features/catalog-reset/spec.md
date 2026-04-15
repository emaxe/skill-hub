# Спецификация: Очистка расширений при смене репозитория каталога

## Контекст

При смене `registryUrl` (адреса каталога расширений) через CLI `config set` или TUI Settings текущий код:
1. Удаляет кеш каталога (`~/.skill-hub/`, включая `installed.json` и клон репозитория) через `resetCache()`
2. **Не трогает** записи расширений в проектном конфиге `.skill-hub.json`

В результате после смены каталога:
- `.skill-hub.json` ссылается на расширения, которых нет в новом каталоге
- `sync.ts` показывает ошибки — расширения помечаются как `missing` или `untracked`
- Пользователь видит фантомные расширения без возможности их корректно обновить

Файлы расширений на диске (`.claude/skills/...`, `.claude/agents/...`) продолжают работать — их трогать не нужно.

## Требования

- **REQ-1**: Создать функцию `fullCatalogReset()` в `git.ts`, которая очищает массив `extensions` в `.skill-hub.json` (через `saveProjectExtensions([])`) и затем вызывает существующий `resetCache()`.
- **REQ-2**: Существующий `resetCache()` оставить без изменений — он используется как внутренний механизм в `ensureCache()`.
- **REQ-3**: В CLI-команде `config set registryUrl <url>` показывать предупреждение с количеством расширений в `.skill-hub.json` и запрашивать подтверждение через `readline`. При отказе — не менять URL.
- **REQ-4**: Добавить флаг `--yes` к команде `config set` для пропуска подтверждения (для скриптов и MCP).
- **REQ-5**: Если расширений в `.skill-hub.json` нет (массив пуст или файл отсутствует) — не показывать предупреждение, сразу выполнять смену URL.
- **REQ-6**: В TUI `SettingsScreen.tsx` — в обоих местах вызова `resetCache()` при смене `registryUrl` (строки ~317 и ~417) показывать `Confirm` компонент с предупреждением перед вызовом `fullCatalogReset()`.
- **REQ-7**: При отмене в TUI — откатить значение `registryUrl` в локальном state (не сохранять в конфиг).
- **REQ-8**: В `ensureCache()` оставить вызов `resetCache()` (не `fullCatalogReset()`) — это fallback на случай ручной правки конфига, предупреждение уже было показано ранее.
- **REQ-9**: Написать unit-тесты для `fullCatalogReset()`.

## Ограничения

- **НЕ входит в скоуп**: удаление файлов расширений с диска, очистка global scope, миграция расширений между каталогами.
- **НЕ входит в скоуп**: обработка множественных проектов — очищается `.skill-hub.json` только текущего проекта (определяемого `findProjectRoot()`).
- Если `registryUrl` меняется на тот же URL — очистка не запускается (уже проверяется через `urlChanged`).
- Ошибки при очистке `.skill-hub.json` — вывести warning, продолжить сброс кеша (не блокировать процесс).

## Макеты и референсы

Не применимо (нет UI-макетов). Ориентир:
- CLI: паттерн предупреждения аналогичен `agents-conventions.ts` (readline Y/N)
- TUI: использовать существующий `Confirm.tsx` компонент

**Текст предупреждения CLI:**
```
⚠  Смена каталога приведёт к очистке списка расширений в .skill-hub.json:
   • N расширений в проекте /path/to/project

   Файлы расширений на диске останутся без изменений.

   Продолжить? (y/N)
```

**Текст предупреждения TUI (message для Confirm):**
```
Смена каталога очистит список расширений в .skill-hub.json (N шт.). Файлы на диске останутся. Продолжить?
```

## Кодстайл и конвенции

- **TypeScript**: `target: ES2022`, `strict: true`, `jsx: react-jsx` (TSConfig)
- **JSDoc**: к экспортируемым функциям — русский текст комментария (CLAUDE.md п.2)
- **Комментарии**: non-obvious логику комментировать кратко (CLAUDE.md п.3)
- **Импорты**: именованные импорты из `../config`, `../git`; `chalk` для CLI-вывода
- **Тесты**: Jest + ts-jest, паттерн: временные директории, mock filesystem
- **TUI**: Ink/React, `useInput` + `normalizeInput` для клавиатуры, `useStdout` для ширины
- **readline**: паттерн из `agents-conventions.ts` — `askQuestion()` промис-обёртка

## Переиспользуемые решения

| Компонент | Путь | Что взять |
|-----------|------|-----------|
| `resetCache()` | `cli/src/git.ts` | Вызывать внутри `fullCatalogReset()` |
| `saveProjectExtensions()` | `cli/src/config.ts:319-334` | Вызвать с `[]` для очистки |
| `loadProjectExtensions()` | `cli/src/config.ts:302-317` | Для подсчёта расширений перед предупреждением |
| `findProjectRoot()` | `cli/src/config.ts:100-125` | Для определения пути к проекту в тексте предупреждения |
| `askQuestion()` | `cli/src/commands/agents-conventions.ts:8-16` | Паттерн readline для CLI-подтверждения |
| `Confirm.tsx` | `cli/src/tui/components/Confirm.tsx` | Компонент Y/N подтверждения для TUI |
| `theme` | `cli/src/tui/theme.ts` | Цвета `theme.warning` для рамки Confirm |

## Критерии приёмки

- [ ] `fullCatalogReset()` очищает `extensions` в `.skill-hub.json` и вызывает `resetCache()`
- [ ] CLI `config set registryUrl <url>` показывает предупреждение с количеством расширений
- [ ] CLI: флаг `--yes` пропускает подтверждение
- [ ] CLI: при отказе (N) URL не меняется
- [ ] CLI: если расширений 0 — предупреждение не показывается
- [ ] TUI: при смене registryUrl в обоих местах показывается Confirm
- [ ] TUI: при отмене — registryUrl откатывается
- [ ] `ensureCache()` по-прежнему использует `resetCache()` (не `fullCatalogReset()`)
- [ ] Ошибки при очистке конфига выводят warning, не блокируют процесс
- [ ] Unit-тесты для `fullCatalogReset()` проходят
- [ ] Существующие тесты (`npm test`) проходят без регрессий

## Затронутые файлы

| Файл | Что менять |
|------|------------|
| `cli/src/git.ts` | Добавить `fullCatalogReset()` — импорт `saveProjectExtensions`, `loadProjectExtensions`, `findProjectRoot` из `config.ts` |
| `cli/src/commands/config.ts` | Добавить предупреждение + readline подтверждение + флаг `--yes` при `config set registryUrl` |
| `cli/src/tui/screens/SettingsScreen.tsx` | Заменить 2 вызова `resetCache()` на flow: Confirm → `fullCatalogReset()` / откат |
| `cli/src/git.test.ts` | Добавить тесты для `fullCatalogReset()` |
