# Отчет: caveman → skill-hub

## Вердикт

**Частичная интеграция возможна.** Основные скиллы и агенты адаптируются. Plugin/hooks/MCP/statusline — нет. Два пути: (A) static skills в каталог, (B) гибрид skill-hub + standalone installer.

---

## Структура caveman (7 skills + 3 agents + 4 commands + plugin)

| Компонент | Путь | Формат | Назначение |
|---|---|---|---|
| **skill caveman** | `skills/caveman/SKILL.md` | Markdown + YAML frontmatter | Основной режим сжатия |
| **skill caveman-commit** | `skills/caveman-commit/SKILL.md` | Markdown + YAML | Commit messages |
| **skill caveman-review** | `skills/caveman-review/SKILL.md` | Markdown + YAML | PR review |
| **skill caveman-help** | `skills/caveman-help/SKILL.md` | Markdown + YAML | Справка |
| **skill caveman-stats** | `skills/caveman-stats/SKILL.md` | Markdown + YAML | Token stats |
| **skill caveman-compress** | `SKILL.md` + `scripts/*.py` | Markdown + Python | Сжатие memory файлов |
| **skill cavecrew** | `skills/cavecrew/SKILL.md` | Markdown + YAML | Subagent skill |
| **agent cavecrew-builder** | `agents/cavecrew-builder.md` | Markdown + YAML (`tools: [...]`) | Subagent builder |
| **agent cavecrew-investigator** | `agents/cavecrew-investigator.md` | Markdown + YAML (`tools: [...]`) | Subagent investigator |
| **agent cavecrew-reviewer** | `agents/cavecrew-reviewer.md` | Markdown + YAML (`tools: [...]`) | Subagent reviewer |
| **commands** | `commands/*.toml` | TOML (`[[commands]]`) | Codex/Gemini commands |
| **plugin** | `.claude-plugin/*` | JSON (marketplace, plugin) | Claude Code plugin |
| **hooks** | `src/hooks/*.{js,sh,ps1}` | Node.js / Shell | SessionStart/UserPromptSubmit |
| **installer** | `bin/install.js` | Node.js | Unified installer 30+ агентов |

---

## Что skill-hub ожидает (подтверждено из CLI-кода)

Три типа расширений в `skillHubCatalog/`:

- **skills/** — `SKILL.md` + YAML frontmatter (`name`, `description`, `tags`, `version`, `scope`, `platforms`, `dependencies`, `files`)
- **agents/** — `AGENT.md` + frontmatter (`name`, `description`, `model`, `color`, ...)
- **commands/** — `COMMAND.md` + frontmatter

**catalog.json** (`cli/src/catalog.ts:Extension`):

```typescript
interface Extension {
  type: 'skill' | 'agent' | 'command';
  name: string;
  description: string;
  tags: string[];
  author?: string;
  version?: string;
  scope: 'global' | 'project' | 'both';
  platforms: Partial<Record<AgentName, string | null>>;
  path: string;           // "skills/my-skill/SKILL.md"
  dependencies: string[];
  model?: string;
  color?: string;
  projects: string[];
  files?: string[];       // доп. файлы относительно директории расширения
}
```

**Ключевые правила из `upload.ts` / `multi-file.ts`:**

- `MAX_EXTENSION_DIR_SIZE = 1_048_576` (1 MB)
- `BINARY_EXTENSIONS` Set — `.exe`, `.dll`, `.so`, `.dylib`, `.bin`, `.zip`, `.pyc`, `.o`, `.wasm`, `.node` и др. — запрещены для upload
- `.skillignore` — исключения при копировании (как `.gitignore`)
- `copyExtensionDir()` — рекурсивное копирование, пропускает symlinks
- `platformKey()` — `agents-conventions` и `codex` reuse `claude-code` source files
- `BASE_SKILLS` (`skill-hub`, `agents-conventions`, `init-agents`, `exit-agents`) — excluded from upload candidates

---

## Совместимость по компонентам

### skills/caveman (основной скилл)

**Статус:** Адаптируется.

SKILL.md уже имеет frontmatter (`name`, `description`). Нужно добавить `tags`, `version`, `scope`, `platforms`, `author`. Содержимое — чистый markdown, работает как skill.

**Проблема:** В skill-hub скилл = static markdown. Caveman как plugin использует hooks (`SessionStart` → `caveman-activate.js`, `UserPromptSubmit` → `caveman-mode-tracker.js`) для auto-activation и statusline. Skill-hub **не поддерживает hooks**. Пользователь должен вручную сказать `/caveman` каждую сессию. Auto-activate потерян.

### skills/caveman-commit, caveman-review, caveman-help, caveman-stats

**Статус:** Адаптируются напрямую.

Простые SKILL.md. Нужен skill-hub frontmatter. Никаких hooks/scripts. Работают как обычные skills.

### skills/caveman-compress

**Статус:** Адаптируется с оговорками.

Содержит Python скрипты (`scripts/__main__.py`, `compress.py`, `detect.py`, `validate.py`, `cli.py`, `benchmark.py`). SKILL.md инструктирует: `python3 -m scripts <filepath>`.

Skill-hub поддерживает `files` в `catalog.json`. При установке в `~/.claude/skills/caveman-compress/` будут скопированы и `SKILL.md`, и `scripts/` через `copyExtensionDir()` (`multi-file.ts`). Путь `python3 -m scripts` работает если Python запущен из директории скилла.

**Но:** `upload.ts` validation ищет `BINARY_EXTENSIONS`. Python `.py` — разрешены. Нужно проверить директорию < 1 MB. Скрипты caveman-compress — небольшие, проходят.

**Python dependency:** `caveman-compress` требует `python3` в PATH и `anthropic` SDK (`pip install anthropic`). Skill-hub не управляет system dependencies. Нужно указать в README skill.

### skills/cavecrew

**Статус:** Адаптируется.

Простой SKILL.md. Нет доп. файлов.

### agents/cavecrew-***

**Статус:** Требует адаптации.

Caveman агенты — `.md` файлы без стандартного skill-hub frontmatter. Пример `cavecrew-builder.md`:

```yaml
---
name: cavecrew-builder
description: > ...
tools: [Read, Edit, Write, Grep, Glob]
---
```

Skill-hub agents ожидают `AGENT.md` с полями `model`, `color`, `platforms`. Поле `tools` — **не в schema**. `agent-frontmatter.schema.json` — `additionalProperties: false`. `tools` сломает валидацию при upload.

**Нужно:**
- Переименовать `.md` → `AGENT.md`
- Добавить `model: claude-sonnet-4-6` (или подходящий)
- Добавить `color: "#8B4513"`
- Убрать `tools` из frontmatter (skill-hub управляет tools при spawn агента через `Agent` tool)

### commands/caveman*.toml

**Статус:** Несовместимы.

Skill-hub commands ожидают `COMMAND.md` (markdown + frontmatter). Caveman использует TOML (`commands/caveman.toml`). TOML содержит `[[commands]]` секции с `name`, `description`, `pattern`, `script`.

Нужна полная конвертация TOML → COMMAND.md или добавление support TOML commands в skill-hub.

### plugin / hooks / MCP shrink / statusline

**Статус:** Не интегрируются через skill-hub.

| Фича | Почему не работает |
|---|---|
| `marketplace.json` + `plugin.json` | Skill-hub не поддерживает Claude Code plugin API. Устанавливает skills, не plugins. |
| `SessionStart` hook | Skill-hub не управляет hooks. Требует модификации `settings.json`. |
| `UserPromptSubmit` hook | То же. |
| `caveman-statusline.sh` | Требует hook + запись в `~/.claude/`. Skill-hub не трогает settings.json. |
| `caveman-shrink` MCP | Отдельный npm-пакет. Устанавливается через `npm install`, не через skill-hub. |
| `caveman-init.js` | Инструмент инициализации репозитория. Требует запуска скрипта, не копирования файлов. |

---

## Что теряется при skill-hub интеграции

- **Auto-activation** — без hooks нужен ручной `/caveman` каждую сессию
- **Statusline badge** — `[CAVEMAN] ⛏ 12.4k` не появится
- **MCP shrink middleware** — не устанавливается
- **TOML commands** — не доступны в Codex/Gemini через skill-hub (только если конвертировать)
- **Install.sh one-liner** — skill-hub использует `skill-hub install caveman`, не `curl | bash`

---

## Что работает

- Все **SKILL.md** скиллы (caveman, commit, review, help, stats, compress, cavecrew)
- **AGENT.md** агенты после адаптации frontmatter
- **Python скрипты** caveman-compress при правильном `files` в catalog.json
- **Cross-platform** — skill-hub уже поддерживает Windows/Linux/macOS адаптеры

---

## Пути интеграции

### Вариант A: Static skills в skillHubCatalog (рекомендуется)

Создать в `skillHubCatalog/` отдельные entries:

```
skills/
  caveman/SKILL.md
  caveman-commit/SKILL.md
  caveman-review/SKILL.md
  caveman-help/SKILL.md
  caveman-stats/SKILL.md
  caveman-compress/
    SKILL.md
    scripts/__main__.py
    scripts/compress.py
    scripts/detect.py
    scripts/validate.py
    scripts/cli.py
    scripts/benchmark.py
  cavecrew/SKILL.md

agents/
  cavecrew-builder/AGENT.md
  cavecrew-investigator/AGENT.md
  cavecrew-reviewer/AGENT.md
```

catalog.json entries:

```json
{
  "type": "skill",
  "name": "caveman-compress",
  "description": "Compress natural language memory files (CLAUDE.md, todos, preferences) into caveman format to save input tokens...",
  "tags": ["productivity", "compression"],
  "author": "JuliusBrussee",
  "version": "1.0.0",
  "scope": "global",
  "platforms": {"claude-code": "SKILL.md", "cursor": "SKILL.md", "copilot": null, "gemini": null, "codex": null},
  "path": "skills/caveman-compress/SKILL.md",
  "files": ["scripts/__main__.py", "scripts/compress.py", "scripts/detect.py", "scripts/validate.py", "scripts/cli.py", "scripts/benchmark.py"],
  "dependencies": [],
  "projects": []
}
```

**Плюс:** Полная интеграция с `skill-hub search/install/remove/update`. Версионирование. Sync. Upload workflow.
**Минус:** Теряются hooks, plugin system, statusline, MCP shrink.

### Вариант B: Гибрид (skill + отдельный plugin)

- Основные скиллы через skill-hub (search, install, remove, update)
- Plugin/hooks/MCP устанавливаются отдельно через `npx -y github:JuliusBrussee/caveman -- --only claude --with-hooks --with-mcp-shrink`
- В `caveman` SKILL.md добавить секцию: "Для hooks, statusline, MCP shrink — запусти `npx ...`"

**Плюс:** Полный функционал caveman сохраняется.
**Минус:** Два пути установки. Пользователь может запутаться.

### Вариант C: Доработка skill-hub

Добавить в skill-hub:
1. Поддержку **plugin** типа расширения (Claude Code `plugin.json` + `marketplace.json`)
2. Поддержку **hooks** (SessionStart, UserPromptSubmit) через модификацию `settings.json`
3. Поддержку **TOML commands** (или конвертер при build catalog)
4. Поддержку **pre/post install scripts** (для MCP shrink, init scripts)

**Плюс:** Caveman integrates natively, no compromises.
**Минус:** Большая архитектурная доработка. Не быстро.

---

## Конкретные проблемы при адаптации

### 1. `platforms` в frontmatter vs catalog.json

- `schema/frontmatter.schema.json`: `platforms` — `string[]` (`[claude-code, cursor, ...]`)
- `catalog.json` реально: `{"claude-code": "SKILL.md", "cursor": "SKILL.md", ...}` — объект с путями.

При добавлении в catalog.json используй объект-формат. В SKILL.md frontmatter — массив. `parseExtension()` в `catalog.ts` нормализует массив в объект автоматически.

### 2. `files` в catalog.json

Текущий `catalog.json` у всех `"files": ["SKILL.md"]` (даже однофайловые). Для caveman-compress:
```json
"files": ["scripts/__main__.py", "scripts/compress.py", "scripts/detect.py", "scripts/validate.py", "scripts/cli.py", "scripts/benchmark.py"]
```

### 3. `agent-frontmatter.schema.json` — `additionalProperties: false`

`agents/cavecrew-*.md` содержат `tools: [Read, Edit, ...]`. Это поле **сломает валидацию** при upload. Убрать `tools` из frontmatter при адаптации.

### 4. Python dependency

`caveman-compress` требует `python3` и `anthropic` SDK. Skill-hub не управляет system dependencies. Нужно либо:
- Указать в README skill: `pip install anthropic`
- Или добавить `requirements.txt` в `files`

### 5. Auto-activation workaround

Без hooks пользователь теряет auto-activate. Можно добавить в skill-hub **base-skill** (как `init-agents`/`exit-agents`) — bootstrap скилл, который при `ensureConventionsStructure` добавляет caveman в `AGENTS.md` или `CLAUDE.md`. Но это conventions-level хак, не native plugin.

---

## Итоговая рекомендация

**Вариант A — static skills.** Создать адаптированные копии основных caveman skills и agents в `skillHubCatalog`. Забыть про plugin/hooks/MCP/TOML commands для первой итерации.

Потеря auto-activation — приемлемый компромисс. Пользователь говорит `/caveman` или "talk like caveman" — skill срабатывает. Всё остальное (commit, review, compress, cavecrew) работает через стандартный skill-hub flow.

Если нужен полный plugin experience — Вариант B (гибрид). Пользователь ставит skills через skill-hub, а hooks/plugin через `npx caveman-installer --only claude`.
