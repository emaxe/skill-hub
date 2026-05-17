# 🔍 Аудит безопасности и стабильности Skill-Hub

> **Дата:** 2026-05-05  
> **Версия:** 0.1.17  
> **Охват:** все модули (core 16, adapters 7, commands 9, entry points 3, TUI 40+, тесты 20)  
> **Baseline:** сборка ✅, 227 тестов ✅ (1 skipped)

---

## Содержание

- [🔴 CRITICAL — 8 проблем](#-critical--потеря-данных-corruption-поломка)
- [🟠 HIGH — 15 проблем](#-high--существенные-баги-в-логике)
- [🟡 MEDIUM — 20 проблем](#-medium--значимые-проблемы-и-несоответствия)
- [🔵 LOW — 15 проблем](#-low--мелкие-проблемы-стилистика-inconsistencies)
- [🧪 Тесты — 6 категорий пробелов](#-тесты--основные-пробелы)
- [📊 Сводка](#-сводка)

---

## 🔴 CRITICAL — Потеря данных, corruption, поломка

### C1. `resetCache()` удаляет реестр установленных расширений

| | |
|---|---|
| **Файл** | `src/git.ts:60-82` |
| **Суть** | `resetCache()` / `fullCatalogReset()` удаляют **всю** директорию `~/.skill-hub/`, а в ней лежит `installed.json` — реестр установленных расширений. |
| **Триггер** | Смена `registryUrl` в настройках (вызывает `fullCatalogReset()`). |
| **Последствие** | Полная потеря списка всех установленных расширений. Пользователь теряет tracking — расширения остаются на диске, но система о них не знает. |
| **Решение** | Перед удалением сохранять `installed.json` во временный файл и восстанавливать после. Или перенести registry за пределы cache-директории. |

---

### C2. `removeSection()` / `removeMarkerContent()` портят файлы при отсутствии конечного маркера

| | |
|---|---|
| **Файлы** | `src/adapters/copilot.ts:149-155`, `src/adapters/codex.ts:130-136`, `src/conventions.ts:408-413` |
| **Суть** | Если начальный маркер `<!-- skill-hub: name -->` найден, а конечный `<!-- /skill-hub: name -->` отсутствует (ручное редактирование, merge conflict), функция `slice()` удаляет всё от начального маркера до конца файла. |
| **Триггер** | Пользователь случайно удалил или повредил конечный маркер, затем запустил `remove` или переустановку. |
| **Последствие** | Потеря пользовательского контента в `copilot-instructions.md`, `AGENTS.md` или других файлах-агрегаторах. |
| **Решение** | Проверять наличие обоих маркеров перед slice. Если конечный маркер не найден — логировать warning и НЕ модифицировать файл. |

---

### C3. `registry.ts` — `JSON.parse` без try/catch

| | |
|---|---|
| **Файл** | `src/registry.ts:35-45` |
| **Суть** | Метод `load()` вызывает `JSON.parse(fs.readFileSync(...))` без обработки исключений. |
| **Триггер** | Любое повреждение `installed.json` — битый диск, прерванная запись, ручное редактирование с ошибкой. |
| **Последствие** | **Все** операции реестра (install, remove, list, sync, MCP) крашатся с `SyntaxError`. CLI полностью неработоспособен до ручного исправления файла. |
| **Решение** | Обернуть в try/catch. При ошибке парсинга — создать backup повреждённого файла, вернуть пустой реестр, логировать warning. |

---

### C4. `.github/` в `AGENT_GITIGNORE_ENTRIES` ломает CI/CD

| | |
|---|---|
| **Файл** | `src/gitignore-agents.ts:12-19` |
| **Суть** | Массив `AGENT_GITIGNORE_ENTRIES` включает `.github/` как директорию AI-агента для gitignore. |
| **Триггер** | Включение настройки `gitignoreAgentDirs: true` (предлагается при старте TUI). |
| **Последствие** | `.github/` добавляется в `.gitignore` → GitHub Actions workflows, issue/PR templates, Dependabot, CODEOWNERS и все остальные `.github/` файлы становятся невидимы для Git. CI/CD ломается. |
| **Решение** | Заменить `.github/` на `.github/copilot-instructions.md` (конкретный файл Copilot), или вообще убрать из списка и добавлять только подпапки вроде `.github/skills/`. |

---

### C5. `upload.ts` — `buildCatalogEntry` сканирует *родительскую* директорию

| | |
|---|---|
| **Файл** | `src/upload.ts:248-250` |
| **Суть** | `path.dirname(scan.path)` применяется даже когда `scan.path` уже указывает на директорию (а не на файл). Результат — сканируется **родительская** директория. |
| **Триггер** | Upload многофайлового расширения, где `scan.path` = `skills/my-skill/` (директория). |
| **Последствие** | Metadata в `catalog.json` содержит файлы из соседних расширений. Каталог загрязняется чужими данными. |
| **Решение** | Проверять, является ли `scan.path` директорией (`fs.statSync().isDirectory()`) перед `path.dirname()`. Если уже директория — использовать как есть. |

---

### C6. `upload.ts` — cleanup может оставить кеш на feature branch

| | |
|---|---|
| **Файл** | `src/upload.ts:380-386` |
| **Суть** | В блоке `finally` вызов `git.checkout('main')` обёрнут в try/catch, который **swallows** ошибку. |
| **Триггер** | Ошибка checkout (merge conflict, locked index, etc.) после неудачного push. |
| **Последствие** | Кеш-репозиторий `~/.skill-hub/` остаётся на feature branch с staged changes. Все последующие `git pull`, `loadCatalog()`, `ensureCache()` работают с неправильной веткой → непредсказуемое поведение. |
| **Решение** | При неудачном checkout — `git reset --hard` + `git checkout main`. В крайнем случае — полный reset cache. Обязательно логировать ошибку. |

---

### C7. Git auth URL вызывает бесконечный цикл reclone

| | |
|---|---|
| **Файл** | `src/git.ts:112-126` |
| **Суть** | При использовании credentials (username:token в URL) клонированный origin содержит credentialed URL. При следующем запуске `ensureCacheWithCredentials()` сравнивает credentialed origin с "чистым" public URL → они не совпадают → система считает что origin изменился → resetCache → заново запрашивает credentials → повтор. |
| **Триггер** | Приватный каталог с аутентификацией через URL credentials. |
| **Последствие** | Бесконечный цикл: запрос credentials → clone → restart → origin mismatch → reset → запрос credentials → ... |
| **Решение** | Нормализовать URL перед сравнением: удалять userinfo часть (`username:password@`) из обоих URL. Или сравнивать только host+path. |

---

### C8. `base-setup.ts` — `JSON.stringify` для сравнения конфигов

| | |
|---|---|
| **Файл** | `src/base-setup.ts:76-89` |
| **Суть** | `checkMcpUpToDate()` сравнивает конфиги через `JSON.stringify(actual) === JSON.stringify(expected)`. Порядок ключей в JSON не гарантирован спецификацией. |
| **Триггер** | Пользователь или другой инструмент отредактировал MCP-конфиг, сохранив ключи в другом порядке. |
| **Последствие** | Ложное срабатывание «MCP outdated» → бесполезные перезаписи при каждом старте. Могут перезатереть пользовательские изменения в конфиге. |
| **Решение** | Использовать deep-equal сравнение (рекурсивное сравнение значений, не строк). Или сортировать ключи перед `JSON.stringify`. |

---

## 🟠 HIGH — Существенные баги в логике

### H1. Поиск в каталоге — не case-insensitive для name/tags

| | |
|---|---|
| **Файл** | `src/catalog.ts:119-127` |
| **Суть** | `query.toLowerCase()` применяется к поисковому запросу, но `e.name` и `e.tags` **не** приводятся к нижнему регистру перед сравнением. |
| **Последствие** | Поиск `"Git"` не находит расширение `git-commit-and-push`. Работает только для `description`, где `toLowerCase()` применяется. |
| **Решение** | Добавить `.toLowerCase()` к `e.name` и элементам `e.tags` в функции поиска. |

---

### H2. `sync.ts` — расширения без `version` считаются "не в каталоге"

| | |
|---|---|
| **Файл** | `src/sync.ts:79-100` |
| **Суть** | Флаг `inCatalog` определяется наличием `catalogVersion`. Если каталожная запись не содержит поле `version` (легаси, ошибка) — `catalogVersion` = undefined → `inCatalog = false`. |
| **Последствие** | Расширение предлагается как "untracked", хотя присутствует в каталоге. |
| **Решение** | `inCatalog` определять по наличию расширения в каталоге (поиск по name+type), а не по version. |

---

### H3. `path-filter.ts` — нет маркера для Codex

| | |
|---|---|
| **Файл** | `src/path-filter.ts:8-9` |
| **Суть** | `AGENT_MARKERS` не содержит `/.codex/`. |
| **Последствие** | Проектные Codex-расширения невидимы для `classifyRecord()` → невидимы в sync, list, MCP tools. |
| **Решение** | Добавить `'/.codex/'` в `AGENT_MARKERS`. |

---

### H4. Claude Code: команды всегда ставятся в project scope

| | |
|---|---|
| **Файл** | `src/adapters/claude-code.ts:39-40` |
| **Суть** | `getInstallPath()` для типа `command` всегда использует `this.projectDir`, игнорируя параметр `scope`. |
| **Последствие** | `skill-hub install my-command --global` устанавливает команду в project-директорию. Глобальная установка команд для Claude невозможна. |
| **Решение** | Использовать `scope === 'global' ? homeDir/.claude/commands/ : projectDir/.claude/commands/`. |

---

### H5. Copilot adapter сканирует Claude-директории

| | |
|---|---|
| **Файл** | `src/adapters/copilot.ts:130-143` |
| **Суть** | `scanInstalled()` после парсинга `copilot-instructions.md` дополнительно сканирует `.claude/skills/`. |
| **Последствие** | Claude-скиллы ложно отображаются как установленные через Copilot. Дублирование в списке, некорректное удаление. |
| **Решение** | Удалить сканирование `.claude/skills` из Copilot-адаптера. |

---

### H6. Copilot/Codex маркеры без типа — коллизия имён

| | |
|---|---|
| **Файлы** | `src/adapters/copilot.ts:14-15`, `src/adapters/codex.ts:15-16` |
| **Суть** | Маркер `<!-- skill-hub: {name} -->` не содержит тип расширения. |
| **Последствие** | Skill и command с одинаковым именем перезаписывают друг друга при install/remove. |
| **Решение** | Формат маркера: `<!-- skill-hub:{type}:{name} -->`. Добавить обратную совместимость для старого формата. |

---

### H7. Copilot/Codex scan всегда возвращает `type: 'skill'`

| | |
|---|---|
| **Файлы** | `src/adapters/copilot.ts:115-125`, `src/adapters/codex.ts:113-123` |
| **Суть** | `parseMarkers()` всегда выставляет `type: 'skill'` для найденных расширений. |
| **Последствие** | Установленные agents/commands неправильно отображаются как skills в `list`, `info`, sync. |
| **Решение** | Извлекать тип из маркера (после fix H6) или из registry fallback. |

---

### H8. TUI: InstalledScreen передаёт `toScope` вместо `currentScope` в MoveScreen

| | |
|---|---|
| **Файл** | `src/tui/screens/InstalledScreen.tsx:182-189` |
| **Суть** | Вычисляется `toScope` (целевой scope) и передаётся как prop в `MoveScreen`, но `MoveScreen` интерпретирует его как **текущий** scope. |
| **Последствие** | Экран перемещения показывает обратное направление (global→project вместо project→global). Может выполнить перемещение в неправильную сторону. |
| **Решение** | Передавать `currentScope` (фактический scope расширения), а не вычисленный `toScope`. |

---

### H9. TUI: DetailScreen удаляет из `defaultScope` вместо реального scope

| | |
|---|---|
| **Файл** | `src/tui/screens/DetailScreen.tsx:41, 137-149` |
| **Суть** | При удалении используется `defaultScope` из настроек, а не фактический scope установленного расширения. |
| **Последствие** | Если расширение установлено globally, но `defaultScope = 'project'` — remove пытается удалить из project-директории, где расширения нет. И наоборот. |
| **Решение** | Определять фактический scope из registry record или сканирования адаптером. |

---

### H10. TUI: InstalledDetailScreen крашится для parent-managed расширений

| | |
|---|---|
| **Файл** | `src/tui/screens/InstalledDetailScreen.tsx:58-79, 98-107` |
| **Суть** | Массив `actions` пуст для `effectiveScope === 'parent'`. Но keyboard navigation может выставить `actionIndex = -1`, и нажатие Enter вызывает `actions[actionIndex].id`. |
| **Последствие** | Runtime crash: `Cannot read properties of undefined (reading 'id')`. |
| **Решение** | Guard: не обрабатывать Enter если `actions.length === 0`. Ограничить `actionIndex` диапазоном `[0, actions.length - 1]`. |

---

### H11. TUI: retry обновления каталога не работает

| | |
|---|---|
| **Файл** | `src/tui/App.tsx:151-160` |
| **Суть** | `handleCatalogUpdateRetry()` сбрасывает refs, но ставит тот же `startupPhase` значение → React `useEffect` с зависимостью `[startupPhase]` НЕ перезапускается (значение не изменилось). |
| **Последствие** | Кнопка retry в диалоге обновления каталога ничего не делает — пользователь видит бесконечный loading. |
| **Решение** | Ввести отдельный retry counter в зависимости `useEffect`, или переключить phase на промежуточное значение и обратно. |

---

### H12. Shortcut rewriting ломает аргументы агента

| | |
|---|---|
| **Файл** | `src/index.ts:10-30, 38-53` |
| **Суть** | `translateShortcuts()` выполняется **до** обнаружения флагов `-a`/`-A`. Аргументы, предназначенные для агента, обрабатываются как CLI shortcuts. |
| **Последствие** | `skill-hub -a claude -u my-project` → `-u` превращается в команду `update` → агент получает неправильные аргументы. |
| **Решение** | Сначала выделять launcher flags (`-a`/`-A`) и агент-аргументы, затем применять shortcuts только к оставшимся CLI-аргументам. |

---

### H13. `update` крашится в agents-conventions на global records

| | |
|---|---|
| **Файл** | `src/commands/update.ts:44-58` |
| **Суть** | `adapter.getInstallPath(ext, pe.scope)` вызывается без guard. `AgentsConventionsAdapter` бросает исключение для `scope === 'global'`. |
| **Последствие** | Если в проектном конфиге (`.skill-hub.json`) есть расширение с `scope: 'global'` и текущий агент — `agents-conventions`, команда `update` крашится. |
| **Решение** | Добавить try/catch или проверку scope перед вызовом `getInstallPath()` для agents-conventions. |

---

### H14. `config.ts` — shallow copy DEFAULT_CONFIG

| | |
|---|---|
| **Файл** | `src/config.ts:156-165` |
| **Суть** | `{ ...DEFAULT_CONFIG }` создаёт **shallow** copy. Вложенный объект `aiAgents` (содержит `agents` map) разделяется между всеми вызовами `loadConfig()`. |
| **Последствие** | Мутация `config.aiAgents.agents[x].enabled = true` в одном месте загрязняет DEFAULT_CONFIG для всех последующих вызовов в пределах процесса. |
| **Решение** | Deep copy: `JSON.parse(JSON.stringify(DEFAULT_CONFIG))` или `structuredClone(DEFAULT_CONFIG)`. |

---

### H15. `config.ts` — `saveProjectConfig` теряет поля при невалидном JSON

| | |
|---|---|
| **Файлы** | `src/config.ts:319-345, 510-524` |
| **Суть** | Если существующий `.skill-hub.json` содержит невалидный JSON, catch-блок начинает с `{}` и записывает только обновляемые поля. |
| **Последствие** | Потеря `extensions`, `registryUrl`, `project`, `gitignoreAgentDirs` и других полей. Аналогично для `saveProjectExtensions`. |
| **Решение** | При невалидном JSON — создать backup, логировать ошибку, и начинать с DEFAULT значений, а не с `{}`. |

---

## 🟡 MEDIUM — Значимые проблемы и несоответствия

### M1. `list` / MCP `list_extensions` дедуплицируют по `name:scope`

| **Файлы** | `src/commands/list.ts:39`, `src/mcp.ts:443-455` |
|---|---|
| **Суть** | Дедупликация по `name:scope` без учёта `type`. Skill и command с одним именем перезаписывают друг друга. |

### M2. `--project` / `--local` флаги мёртвые в install/remove

| **Файлы** | `src/commands/install.ts:40-42`, `src/commands/remove.ts:19-21` |
|---|---|
| **Суть** | Код проверяет только `opts.global`. Флаги `--project` и `--local` определены, но не влияют на поведение. |

### M3. Невалидный `--agent` не валидируется

| **Файлы** | `src/adapters/get-adapter.ts:10-15`, все команды |
|---|---|
| **Суть** | `--agent foo` тихо падает на Claude adapter, но сообщения пишут `foo`. Пользователь думает что работает с `foo`. |

### M4. `remove` / MCP не вызывают `ensureCache()`

| **Файлы** | `src/commands/remove.ts:40`, `src/mcp.ts:292-306` |
|---|---|
| **Суть** | `loadCatalog()` без `ensureCache()`. На "холодной" системе — crash. |

### M5. `disableConventions` не мигрирует Codex

| **Файл** | `src/conventions.ts:721-751` |
|---|---|
| **Суть** | При выключении conventions правила мигрируются для claude/cursor/copilot, но **не** codex. Codex-правила теряются. |

### M6. Windows junction/copy не считается валидным линком

| **Файл** | `src/conventions.ts:256-293` |
|---|---|
| **Суть** | Health check использует `lstatSync().isSymbolicLink()`. Windows junction и copy-fallback не проходят эту проверку → health навсегда false. |

### M7. `.skillignore` паттерны читаются, но не применяются

| **Файл** | `src/multi-file.ts:177-184` |
|---|---|
| **Суть** | `readSkillIgnore()` парсит файл, но ни один copy flow не использует результат для фильтрации. |

### M8. `listExtensionFiles` — неправильный mainFile для директорий

| **Файл** | `src/multi-file.ts:99-106` |
|---|---|
| **Суть** | `path.basename(extPath)` для директории даёт имя директории, не основной файл → mainFile не исключается из списка. |

### M9. Upload agents/commands — metadata расходится с реальностью

| **Файл** | `src/upload.ts:331-340` |
|---|---|
| **Суть** | `buildCatalogEntry` записывает extra files, но upload agents/commands копирует только main file. Каталог ссылается на несуществующие файлы. |

### M10. `generatePrUrl` — недостаточное URL-кодирование

| **Файл** | `src/upload.ts:474-488` |
|---|---|
| **Суть** | Кодируются только `#`, `&`, `?`. Пробелы, кириллица, спецсимволы в title/body могут сломать URL. |

### M11. `detectPlatform` — ложное определение GitLab

| **Файл** | `src/upload.ts:426-430` |
|---|---|
| **Суть** | Любой URL содержащий подстроку `gitlab` → GitLab. URL `github.com/foo/gitlab-tools` неправильно классифицируется. |

### M12. `installMcp` перезаписывает невалидный MCP JSON

| **Файл** | `src/base-setup.ts:110-125` |
|---|---|
| **Суть** | Невалидный JSON конфиг MCP заменяется на `{}` → все остальные MCP серверы пользователя теряются. |

### M13. Config read-modify-write без блокировки (race condition)

| **Файлы** | `src/config.ts`, `src/registry.ts`, `src/base-setup.ts` |
|---|---|
| **Суть** | Параллельные CLI/TUI/MCP записи (load→modify→save) могут потерять обновления друг друга. |

### M14. TUI: глобальные хоткеи поверх модальных окон

| **Файл** | `src/tui/App.tsx:140, 607-638` |
|---|---|
| **Суть** | `dialogActive` отслеживает только app-level диалоги. Esc/1-3/Ctrl+Q проходят через screen-local модалки (confirm, upload, detail). |

### M15. TUI: ScrollableBox — некорректная модель скроллинга

| **Файл** | `src/tui/components/ScrollableBox.tsx:27-35` |
|---|---|
| **Суть** | Считает каждый top-level React child за одну строку, но callers передают многострочные `<Box>` блоки → autoscroll и visible range ломаются. |

### M16. TUI: Codex exposed в conventions UI, но не поддерживается runtime

| **Файлы** | `src/tui/hooks/useConventionsInit.ts`, `useConventionsExit.ts` |
|---|---|
| **Суть** | Типы и UI позволяют выбрать `codex`, но binary/arg maps не содержат его → runtime failure при выборе. |

### M17. MCP install — зависимости без проверки platform support

| **Файл** | `src/mcp.ts:229-249` |
|---|---|
| **Суть** | CLI `installExtension()` проверяет platform support, MCP — нет. Зависимость для другой платформы ставится без предупреждения. |

### M18. MCP search — недокументированный параметр `project`

| **Файл** | `src/mcp.ts:39-48` |
|---|---|
| **Суть** | Handler читает `a.project`, но Zod-схема не декларирует этот параметр. Контракт MCP расходится с реализацией. |

### M19. `mcp-entry.ts` — нет exit code при ошибке

| **Файл** | `src/mcp-entry.ts:4` |
|---|---|
| **Суть** | `.catch(console.error)` логирует, но не ставит `process.exitCode = 1`. Вызывающая сторона (Claude, Cursor) считает MCP-сервер стартовавшим успешно. |

### M20. `findProjectRoot` — agentDir приоритетнее `.skill-hub.json`

| **Файл** | `src/config.ts:119-143` |
|---|---|
| **Суть** | `firstAgentDir` возвращается даже если `.skill-hub.json` лежит в родительской директории. Проектный конфиг может быть проигнорирован. |

---

## 🔵 LOW — Мелкие проблемы, стилистика, inconsistencies

### L1. Ink anti-pattern `{stringVar && <Component>}`
**Файлы:** `App.tsx:859`, `DetailScreen.tsx:106-112`, `InstalledDetailScreen.tsx:176,195,201,213`, `GeneralTab.tsx:165`  
Пустая строка `''` — truthy → Ink бросает `Text string "" must be rendered inside <Text>`.

### L2. `detect-agent.ts` — приоритет проверок расходится с CLAUDE.md
**Файл:** `src/detect-agent.ts:17-31`  
`.cursor/` проверяется раньше Copilot env vars, документация описывает другой порядок.

### L3. `platform.ts` — export-time evaluation
**Файл:** `src/platform.ts:9-15`  
`isWindows`/`isMac`/`isLinux` вычисляются при импорте модуля → невозможно мокать в тестах.

### L4. `system-check.ts` — неточное сообщение об ошибке
**Файл:** `src/system-check.ts:127-136`  
Всегда пишет "не найден" даже если Node присутствует, но версия слишком старая.

### L5. Два `parseFrontmatter()` с разной семантикой
**Файлы:** `src/frontmatter.ts`, `src/upload.ts:111-135`  
Одноимённые функции с разным контрактом → путаница, потенциальная подмена при рефакторинге.

### L6. Документация CLAUDE.md устарела
- Версия: `0.1.11` → фактическая `0.1.17`
- Реестр: `registry.json` → `installed.json`
- detect-agent приоритет расходится с кодом
- `setup-mcp` help не упоминает `copilot`

### L7. CLI help text не полный
**Файл:** `src/index.ts:47,83,107`  
Не упоминает `agents-conventions` и `codex` как поддерживаемые агенты.

### L8. `update [name]` не поддерживает указание типа
**Файл:** `src/commands/update.ts:20-23`  
В отличие от install/remove/move/info, не принимает формат `type:name`.

### L9. `info` fallback игнорирует Codex/agents-conventions
**Файл:** `src/commands/info.ts:32-35`  
Ручные Codex/agents-conventions установки невидимы для `info`.

### L10. Windows browser open не работает
**Файл:** `src/tui/screens/UploadScreen.tsx:219-224`  
`spawn('start', ...)` — shell builtin, нужен `shell: true` на Windows.

### L11. `config set` без валидации значений
**Файл:** `src/commands/config.ts:47-79`  
Можно записать `agent = "foo"`, `defaultScope = "banana"` → сломает поведение.

### L12. Unused props и hooks
`FilterBar.onTypeChange`, `ExtensionList.currentProject`, `useKeymap` hook — определены, но не используются.

### L13. TUI: таймеры auto-clear статуса не отменяются
**Файлы:** `App.tsx:75-83`, `useRegistry.ts:163`  
Старые таймеры могут очистить новые status-сообщения.

### L14. TUI: debounce в `useCatalog` без cleanup
**Файл:** `src/tui/hooks/useCatalog.ts:27, 56-60`  
Таймер не отменяется при unmount.

### L15. TUI: пустые списки → отрицательные индексы
**Файлы:** `CatalogScreen.tsx:94-100`, `InstalledScreen.tsx:135`, `UploadScreen.tsx:267-278`  
Навигация в пустом списке может создать `activeIndex = -1`.

---

## 🧪 Тесты — Основные пробелы

### T1. Stale тесты install/remove
`install.test.ts` / `remove.test.ts` тестируют локальный `computeScope()` helper, не реальные команды. Ожидания stale: default scope `global` vs фактический `project`.

### T2. `conventions.test.ts` — фиктивное покрытие
Один тест проверяет exports, другой вызывает `fs.symlinkSync` напрямую. Реальная логика (enable/disable/health) не покрыта.

### T3. `upload.test.ts` — ключевые flows не протестированы
`checkCatalogWriteAccess()`, `uploadExtensions()` (end-to-end), `getUploadCandidates()` (explicitly skipped).

### T4. Модули без тестов
`sync.ts`, `path-filter.ts`, `frontmatter.ts`, `commands/update.ts`, `commands/search.ts`, `commands/list.ts`, `commands/info.ts`, `commands/setup-mcp.ts`, `commands/config.ts`, `commands/agents-conventions.ts`, `mcp.ts`, `index.ts`.

### T5. TUI полностью не покрыт
Нет ни одного `.test.tsx` файла.

### T6. Adapter edge-cases
- Claude: command scope, scanInstalled
- Copilot: Claude-dir сканирование, marker collision
- Codex: marker corruption
- Cursor: scanInstalled, command paths

---

## 📊 Сводная таблица

| Уровень | Количество | Область |
|---------|-----------|---------|
| 🔴 Critical | 8 | git, registry, upload, config, gitignore |
| 🟠 High | 15 | adapters, TUI, CLI, config, catalog |
| 🟡 Medium | 20 | commands, MCP, TUI, conventions, multi-file |
| 🔵 Low | 15 | docs, UI, validation, helpers |
| 🧪 Тесты | 6 категорий | stale, missing, shallow coverage |
| **Итого** | **64** | |
