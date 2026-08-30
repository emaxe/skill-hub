[English version](README.md)

# Skill-Hub

Open-source менеджер расширений для AI-агентов. Ищите, устанавливайте и управляйте skills, agents и commands из центрального каталога.

## Поддерживаемые AI-агенты

| Агент | Статус | Директории |
|-------|--------|-----------|
| **Claude Code** | Полная поддержка | `~/.claude/` / `.claude/` |
| **Cursor** | Полная поддержка | `~/.cursor/` / `.cursor/` |
| **Copilot** (VS Code) | Полная поддержка | `~/.config/Code/User/` / `.github/` |
| **Codex** (OpenAI) | Полная поддержка | `~/.codex/` / `.codex/` |

Skill-Hub автоматически определяет активного агента по env vars (`CODEX_SANDBOX` → codex, `GITHUB_COPILOT` → copilot, `CURSOR_TRACE` → cursor) и наличию директорий (`.codex/`, `.cursor/`). Можно задать явно:

```bash
skill-hub config set agent cursor
```

## Поддерживаемые платформы

| ОС | Статус | Примечания |
|----|--------|-----------|
| **macOS** | Полная поддержка | — |
| **Linux** | Полная поддержка | — |
| **Windows** | Полная поддержка | cmd.exe, PowerShell, Windows Terminal |

### Windows

```powershell
npm install -g @emaxe/skill-hub
```

Особенности работы на Windows:

| Компонент | Поведение |
|-----------|-----------|
| Запуск агентов `-A` | Генерирует `.bat`-скрипт (CRLF) вместо `.sh`; самоудаляется через `del "%~f0"` |
| Copilot-адаптер | Ищет конфиг VS Code в `%APPDATA%\Code\User\` |
| `agents-conventions enable` | Создаёт symlinks типа `dir` → fallback `junction` → fallback копирование директории |
| Сравнение путей | Case-insensitive (актуально для Claude Code адаптера) |

> **Примечание:** Git Bash и WSL не являются целевой платформой. Рекомендуется нативный Windows.

## Что такое расширения?

Skill-Hub управляет тремя типами расширений:

| Тип | Описание | Пример установки (Claude Code) |
|-----|----------|-------------------------------|
| **Skill** (`SKILL.md`) | Инструкции для AI, активируемые контекстом | `~/.claude/skills/{name}/SKILL.md` |
| **Agent** (`AGENT.md`) | Специализированные AI-ассистенты | `~/.claude/agents/{name}.md` |
| **Command** (`COMMAND.md`) | Пользовательские slash-команды | `.claude/commands/{name}.md` |

Каждый агент хранит расширения в своей структуре директорий. Расширения могут объявлять поддержку конкретных платформ через поле `platforms` — несовместимые комбинации фильтруются автоматически.

### Многофайловые скиллы

Скиллы могут содержать **дополнительные файлы** помимо основного `SKILL.md` — скрипты, шаблоны, конфигурации, данные. Вся директория скилла устанавливается и загружается целиком.

```
skills/clean-runner/
├── SKILL.md              # Основной файл (обязательный)
├── runner.sh             # Shell-скрипт
├── config.json           # Конфигурация
├── .skillignore          # Файлы для исключения (не копируется)
└── filters/
    ├── common.grep       # Паттерны фильтрации
    └── npm.grep
```

**Поведение при установке:**

| Адаптер | Основной файл | Доп. файлы |
|---------|---------------|------------|
| Claude Code / conventions | Копируется вся директория | В той же директории |
| Cursor | Трансформация (Cursor frontmatter) | Копируются as-is |
| Copilot | Marker-injection в конфиг | `.github/skills/{name}/` |
| Codex | Marker-injection в конфиг | `.codex/skills/{name}/` |

**`.skillignore`** — файлы, исключаемые из копирования (сам `.skillignore` также не копируется). Symlinks игнорируются. Максимальный размер директории — 1 МБ, бинарные файлы запрещены при загрузке в каталог.

## Быстрый старт

### Вариант A: CLI + MCP (рекомендуется)

```bash
npm install -g @emaxe/skill-hub

# Настроить для вашего агента (claude-code | cursor | copilot | codex)
skill-hub setup-mcp --agent claude-code
```

После перезапуска агента MCP-инструменты будут доступны автоматически.

### Вариант B: Bootstrap skill (ручной)

```bash
# Для Claude Code:
mkdir -p ~/.claude/skills/skill-hub
cp "$(npm root -g)/@emaxe/skill-hub/base-skills/claude-code/SKILL.md" ~/.claude/skills/skill-hub/SKILL.md

# Для Cursor:
mkdir -p ~/.cursor/skills/skill-hub
cp "$(npm root -g)/@emaxe/skill-hub/base-skills/cursor/SKILL.md" ~/.cursor/skills/skill-hub/SKILL.md

# Для Codex:
mkdir -p ~/.codex
cp "$(npm root -g)/@emaxe/skill-hub/base-skills/codex/SKILL.md" ~/.codex/AGENTS.md
```

## Установка скиллов из skills.sh

Skill-Hub поддерживает прямую установку скиллов из [skills.sh](https://skills.sh) — публичного реестра AI-скиллов от Vercel Labs. Работает и через **CLI**, и через **TUI**.

### Поиск (CLI)

```bash
skill-hub search --source skillssh react --limit 5
```

### Установка (CLI)

```bash
# По полному ID (рекомендуется)
skill-hub install skillssh:vercel-labs/agent-skills@vercel-react-best-practices --agent claude-code --project

# По slug (skills.sh ищет по ID)
skill-hub install skillssh:vercel-react-best-practices --agent claude-code --project

# По owner/repo — выведет список если несколько скиллов в репозитории
skill-hub install skillssh:vercel-labs/agent-skills --agent claude-code --project
```

### Как это работает

1. CLI вызывает `https://skills.sh/api/search` или `download` API
2. Скачивает все файлы скилла во временную директорию
3. Устанавливает через стандартный адаптер (как обычный скилл из каталога)
4. Сохраняет `source: "skillssh:owner/repo@slug"` в реестр для обновлений

### Обновление (CLI)

```bash
# Обновить все скиллы (включая skills.sh)
skill-hub update --agent claude-code

# Обновить конкретный skills.sh скилл
skill-hub update vercel-react-best-practices --agent claude-code
```

Для skills.sh-скиллов обновление сравнивает hash от API — если изменился, перекачивает и переустанавливает.

### Поддержка в TUI

В табе **Каталог** введите запрос в поле поиска — сначала отображаются результаты из локального каталога, затем live-результаты с skills.sh (помечены `[skills.sh]`). Нажмите `Enter` на skills.sh-результате — откроется карточка, `i` — установить.

Установленные skills.sh-скиллы ведут себя как обычные расширения: видны в табе **Установленные**, версия = API hash, поддерживаются `d` (удалить), `m` (переместить), `u` (обновить) и startup-синхронизация (если записаны в `.skill-hub.json`).

> **Примечание:** Хоткей `c` (содержимое) скрыт для неустановленных skills.sh-элементов, потому что файлы скилла не кешируются локально до установки.

## Интерактивный TUI

Запустите `skill-hub` без аргументов для полноэкранного интерфейса:

```bash
skill-hub
```

> **Минимальный размер терминала:** 60×12. TUI адаптируется к размеру окна:
> при ширине < 80 кол. скрываются второстепенные колонки таблиц и сокращаются лейблы;
> при высоте < 16 строк убирается панель статистики.

![Таб «Каталог» — поиск и установка расширений](imgs/img3.png)

### Общая навигация

| Клавиша | Действие |
|---------|----------|
| `Tab` / `Shift+Tab` | Переключение табов |
| `1` / `2` / `3` | Прямой переход: Каталог / Установленные / Настройки |
| `Esc` | Назад (на вложенных экранах) |
| `Ctrl+Q` | Выход |

### Таб «Каталог»

Поиск и установка расширений из каталога.

| Клавиша | Действие |
|---------|----------|
| `/` | Фокус на поле поиска |
| `↑` `↓` | Навигация по списку |
| `Enter` | Открыть карточку расширения |
| `i` | Установить выбранное расширение |

В строке поиска поддерживается фильтр по типу: `agent:reviewer`, `skill:git`.

### Таб «Установленные»

Управление установленными расширениями.

| Клавиша | Действие |
|---------|----------|
| `↑` `↓` | Навигация по списку |
| `Enter` | Открыть карточку расширения |
| `d` | Удалить расширение (с подтверждением) |
| `m` | Переместить (global ↔ project) |
| `u` | Обновить выбранное расширение |
| `U` | Обновить все расширения |
| `p` | Загрузить в каталог (если есть доступ) |
| `/` | Фокус на поле поиска |
| `s` | Переключить scope (global / project / all) |

![Таб «Установленные» — список расширений с управлением](imgs/img4.png)

При нажатии `Enter` открывается карточка расширения с подробной информацией и доступными действиями:

![Карточка установленного расширения — метаданные, путь и действия](imgs/img5.png)

Из карточки можно просмотреть содержимое файла расширения (`c`):

![Просмотр содержимого файла расширения](imgs/img6.png)

### Таб «Настройки»

Две подвкладки: **Основное** и **AI-агенты**.

#### Подвкладка «Основное»

| Поле | Клавиша | Описание |
|------|---------|----------|
| Агент | `←` `→` | Переключение между claude-code, cursor, copilot, codex, agents-conventions |
| Scope | `←` `→` | Scope по умолчанию: global или project |
| Проект | — | Имя текущего проекта |
| Registry URL | `Enter` | Редактировать URL репозитория каталога |
| Обновить кеш | `Enter` | Загрузить актуальную версию каталога |
| Папки ИИ-агентов в .gitignore | `←` `→` | Добавлять агентские папки в .gitignore (только проектный конфиг) |
| Установить MCP | `Enter` | Зарегистрировать MCP-сервер для текущего агента |
| Установить base skill | `Enter` | Установить bootstrap-скилл |
| Обновить CLI | `Enter` | Обновить сам skill-hub до последней версии |
| Сохранить в глобальный | `Enter` | Скопировать проектный конфиг в глобальный |
| Сбросить к глобальному | `Enter` | Восстановить проектный конфиг из глобального |
| Синхронизация | `Enter` | Проверить missing/untracked расширения |

![Настройки — подвкладка «Основное»: агент, scope, registry URL и MCP](imgs/img1.png)

#### Подвкладка «AI-агенты»

Настройка запуска AI-агентов через skill-hub:

| Поле | Клавиша | Описание |
|------|---------|----------|
| claude-code / cursor / copilot / codex | `←` `→` | Включить/выключить агента |
| Proxy URL | `Enter` | Общий прокси для всех агентов |
| Использовать прокси (per-agent) | `←` `→` | Вкл/выкл прокси для конкретного агента |

![Настройки — подвкладка «AI-агенты»: включение агентов и настройка прокси](imgs/img2.png)

### Экран «Загрузка в каталог»

Загрузка собственных расширений в репозиторий каталога.

| Клавиша | Действие |
|---------|----------|
| `↑` `↓` | Навигация по списку расширений |
| `Space` | Выбрать/снять расширение |
| `a` | Выбрать все |
| `s` | Переключить scope (global / project) |
| `c` | Просмотреть содержимое выбранного расширения |
| `b` | Редактировать имя ветки |
| `e` | Редактировать заголовок PR |
| `Enter` | Начать загрузку |
| `Esc` | Назад |

После загрузки:
| `o` | Открыть ссылку для создания merge request в браузере |

### Диалог синхронизации

При запуске TUI автоматически проверяется соответствие расширений проектному конфигу (`.skill-hub.json`). Если найдены несоответствия, отображается диалог:

- **Не установлены** — расширения из конфига, отсутствующие на диске
- **Не указаны** — расширения на диске, отсутствующие в конфиге

| Клавиша | Действие |
|---------|----------|
| `Enter` | Синхронизировать (установить + добавить в конфиг) |
| `p` | Загрузить в каталог (для расширений, отсутствующих в каталоге) |
| `Esc` | Пропустить |

### Диалог .gitignore

Если в проектном конфиге включена настройка `gitignoreAgentDirs`, при старте TUI проверяется, все ли папки ИИ-агентов (`.claude/`, `.cursor/`, `.github/`, `.codex/`, `.agents/`, `.cursorrules`) добавлены в `.gitignore`. При наличии пропущенных записей отображается диалог:

| Клавиша | Действие |
|---------|----------|
| `Enter` | Добавить в .gitignore |
| `Esc` | Пропустить |

> **Примечание:** все хоткеи работают и в русской раскладке (й→q, ц→w, у→e и т.д.)

## Работа с AI-агентами

### Подключение через MCP

MCP-сервер предоставляет 7 инструментов для управления расширениями из AI-агента:

```bash
# Автоматическая настройка
skill-hub setup-mcp --agent claude-code
```

После настройки агент получает доступ к инструментам:
- `search_extensions` — поиск по каталогу
- `install_extension` — установка с автоматическим разрешением зависимостей
- `remove_extension` — удаление
- `move_extension` — перемещение между scope
- `list_extensions` — список установленных
- `suggest_extensions` — рекомендации на основе проекта
- `get_extension_info` — полная информация о расширении

### Настройка прокси

Если AI-агенты работают через прокси (например, для доступа к API):

**Через TUI:**
1. Откройте вкладку **Настройки** → подвкладка **AI-агенты**
2. Перейдите к полю **Proxy URL** → нажмите `Enter`
3. Введите URL прокси
4. Включите «Использовать прокси» для нужных агентов

**Через CLI:**
```bash
skill-hub config set aiAgents.proxy "http://proxy.example.com:8080"
```

### Запуск AI-агентов через skill-hub

Skill-Hub может запускать AI-агентов напрямую, применяя настройки прокси и другие параметры:

```bash
# Запуск через exec
skill-hub -a claude-code "напиши тест для auth.ts"

# Запуск через временный скрипт
skill-hub -A cursor "review this code"
```

## Переключение репозитория каталога

По умолчанию skill-hub использует каталог `https://github.com/emaxe/skill-hub-catalog.git`. Вы можете переключиться на свой форк или корпоративный каталог.

### Через TUI

1. Откройте **Настройки** → поле **Registry URL** → `Enter`
2. Введите URL нового репозитория (HTTPS или SSH)
3. Подтвердите — старый кеш будет удалён
4. Каталог автоматически загрузится из нового репозитория

> При смене репозитория список расширений в проектном конфиге `.skill-hub.json` будет очищен, так как они привязаны к конкретному каталогу. Файлы расширений на диске останутся.

### Через CLI

```bash
skill-hub config set registryUrl "https://gitlab.example.com/team/my-catalog.git"
```

### Требования к каталогу

Ваш каталог должен содержать:
- `catalog.json` — индекс расширений (генерируется скриптами из `skill-hub-catalog`)
- Директории `skills/`, `agents/`, `commands/` с расширениями

История использованных URL хранится (до 6 записей) и доступна при редактировании через TUI.

## Загрузка расширений в каталог

Вы можете загрузить собственные расширения в репозиторий каталога прямо из skill-hub.

### Предусловия

- У вас есть **write-доступ** к репозиторию каталога (git push)
- Расширение имеет заполненный **frontmatter** (name, description, version, author)

> **Примечание:** встроенные базовые скиллы CLI (`skill-hub`, `agents-conventions`, `init-agents`, `exit-agents`) автоматически исключаются из списка кандидатов на загрузку.

### Процесс загрузки

1. **Откройте экран загрузки** одним из способов:
   - В табе «Установленные» нажмите `p`
   - В карточке установленного расширения выберите «Загрузить в каталог»
   - В диалоге синхронизации нажмите `p` (для расширений, отсутствующих в каталоге)

2. **Выберите расширения** для загрузки:
   - `Space` — выбрать/снять
   - `a` — выбрать все
   - `s` — переключить scope
   - `c` — просмотреть содержимое перед загрузкой

3. **Настройте параметры:**
   - Имя ветки (автоматически: `upload/{username}-{timestamp}`)
   - Заголовок PR (автоматически из выбранных расширений)

4. **Нажмите `Enter`** для загрузки — расширения будут:
   - Провалидированы (frontmatter, kebab-case имена)
   - Скопированы в структуру каталога
   - Закоммичены и запушены в отдельную ветку

5. **Создайте merge request** — нажмите `o` для открытия формы MR/PR в браузере

### Формат frontmatter

```yaml
---
name: my-extension
description: "Описание расширения"
version: 1.0.0
author: "Имя Автора"
tags: tag1, tag2, tag3
platforms: claude-code, cursor
---
```

## Agents-Conventions Mode

Режим для мультиагентных проектов — общая директория `.agents/` с расширениями, доступными всем агентам через symlinks.

### Включение

```bash
skill-hub agents-conventions enable
```

Или через TUI: Настройки → Агент → `agents-conventions` → Init Conventions.

Что происходит:
- Создаётся `.agents/` с поддиректориями `skills/`, `agents/`, `commands/`
- Создаётся `AGENTS.md` (общие правила проекта)
- Создаются symlinks: `.claude/` → `.agents/`, `.cursor/` → `.agents/`, `.codex/` → `.agents/`
- Для Copilot создаётся thin pointer в `.github/copilot-instructions.md`
- Bootstrap-скилл `agents-conventions` устанавливается глобально во все AI-агенты
- Скиллы `init-agents` / `exit-agents` устанавливаются в `~/.skill-hub/bootstrap/`

### Выключение

```bash
skill-hub agents-conventions disable
```

Расширения мигрируют обратно в директории конкретных агентов, symlinks удаляются.

## Справочник CLI-команд

### search

Поиск расширений по имени, тегам, ключевым словам.

```bash
skill-hub search git
skill-hub search agent:reviewer
skill-hub search "testing typescript"
```

### install

Установка расширения. Без префикса — skill, с префиксом — по типу.

```bash
skill-hub install git-commit-and-push
skill-hub install agent:code-reviewer
skill-hub install command:deploy-check
skill-hub install git-helper --scope=global
skill-hub install git-helper -y              # без подтверждения
```

### remove

Удаление установленного расширения.

```bash
skill-hub remove git-commit-and-push
skill-hub remove agent:code-reviewer
```

### list

Список установленных расширений с версиями и scope.

```bash
skill-hub list
skill-hub list --type=agent
```

### move

Перемещение расширения между scope.

```bash
skill-hub move git-helper project
skill-hub move agent:code-reviewer global
```

### info

Подробная информация о расширении из каталога.

```bash
skill-hub info git-commit-and-push
skill-hub info agent:code-reviewer
```

### update

Обновление расширений до последних версий.

```bash
skill-hub update                     # обновить все
skill-hub update agent:code-reviewer # обновить конкретное
skill-hub -u code-reviewer           # сокращение
skill-hub -U                         # обновить все (сокращение)
```

### config

Управление конфигурацией.

```bash
skill-hub config set agent cursor
skill-hub config set registryUrl "https://gitlab.example.com/catalog.git"
skill-hub config set defaultScope global
skill-hub config get agent
skill-hub config reset
```

### setup-mcp

Регистрация MCP-сервера для AI-агента.

```bash
skill-hub setup-mcp --agent claude-code
skill-hub setup-mcp --agent cursor
skill-hub setup-mcp --agent copilot
skill-hub setup-mcp --agent codex
```

### agents-conventions

Управление мультиагентным режимом.

```bash
skill-hub agents-conventions enable
skill-hub agents-conventions disable
```

### help

Полная справка по командам, флагам и опциям.

```bash
skill-hub help
skill-hub -h
skill-hub --help
```

### Специальные флаги

```bash
skill-hub -a claude-code "задание"   # запуск агента через exec
skill-hub -A cursor "задание"        # запуск через temp-скрипт
skill-hub --then                     # цепочка двух команд
```

## Проектный конфиг (`.skill-hub.json`)

Файл `.skill-hub.json` в корне проекта позволяет:
- Зафиксировать набор расширений для проекта (командная синхронизация)
- Переопределить глобальные настройки для конкретного проекта
- Автоматически синхронизировать расширения при открытии проекта в TUI
- Управлять добавлением папок ИИ-агентов в `.gitignore`

```json
{
  "registryUrl": "https://github.com/emaxe/skill-hub-catalog.git",
  "project": "my-project",
  "gitignoreAgentDirs": true,
  "extensions": [
    { "type": "skill", "name": "git-commit-and-push", "version": "1.0.0", "scope": "project" },
    { "type": "agent", "name": "code-reviewer", "version": "1.0.0", "scope": "global" }
  ]
}
```

Коллеги, клонировав проект, при первом запуске `skill-hub` увидят диалог синхронизации и смогут автоматически установить все перечисленные расширения.

## Архитектура

```
skill-hub (этот репо)
├── cli/                     # CLI + MCP-сервер (npm: @emaxe/skill-hub)
│   ├── src/
│   │   ├── adapters/        # Адаптеры агентов (claude-code, cursor, copilot, codex)
│   │   ├── commands/        # CLI-команды
│   │   └── tui/             # Интерактивный TUI (Ink/React)
│   └── base-skills/         # Бутстрап-скиллы для каждого агента
├── docs/                    # Документация по фичам
└── CLAUDE.md                # Инструкции для AI-агентов

skill-hub-catalog (отдельный репо)
├── skills/                  # Опубликованные скиллы
├── agents/                  # Опубликованные агенты
├── commands/                # Опубликованные команды
├── catalog.json             # Автогенерируемый индекс
├── schema/                  # Схемы валидации frontmatter
└── docs/                    # Гайды по созданию расширений
```

**Поток доставки:**
1. `git clone --depth 1 skill-hub-catalog` → `~/.skill-hub/catalogs/<repo-hash>/` (изолированный локальный кеш для каждого registry URL)
2. Установка = адаптер копирует расширение в целевую директорию агента
3. Обновление = `git pull` в кеше, повторное копирование установленных

## Локальная разработка CLI

```bash
cd cli && npm run build       # сборка
npm link                      # глобальная линковка
skill-hub search git          # тестирование
npm unlink -g @emaxe/skill-hub # удалить линк
cd cli && npm test            # тесты (299 тестов)
```

При изменениях в исходниках достаточно пересобрать (`npm run build`) — линк обновится автоматически.

## Contributing

Расширения (skills, agents, commands) публикуются в [skill-hub-catalog](https://github.com/emaxe/skill-hub-catalog). Смотрите `docs/` каталога для гайдов по созданию.

Для доработки CLI — открывайте PR в этом репозитории. Подробности в [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
