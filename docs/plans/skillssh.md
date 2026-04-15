# Анализ: интеграция skills.sh в skill-hub

## Ключевое открытие: skills.sh имеет публичные API

При анализе исходного кода `vercel-labs/skills` (CLI skills.sh) обнаружены два важных API:

### 1. Search API
```
GET https://skills.sh/api/search?q=<query>&limit=10
→ { "skills": [{ "id": "slug", "name": "...", "installs": 12345, "source": "owner/repo" }] }
```

### 2. Download API (Blob)
```
GET https://skills.sh/api/download/{owner}/{repo}/{slug}
→ { "files": [{ "path": "SKILL.md", "contents": "..." }, ...], "hash": "abc123" }
```

Это кардинально меняет подход: **не нужно ни клонировать репозитории, ни строить индекс** — skills.sh уже кеширует снапшоты скиллов и предоставляет поиск.

## Формат данных skills.sh

### SKILL.md frontmatter
```yaml
---
name: vercel-react-best-practices
description: React and Next.js performance optimization guidelines...
license: MIT
metadata:
  author: vercel
  version: "1.0.0"
---
```

### Структура скилла
Каждый скилл — папка с `SKILL.md` + опциональные файлы:
- `SKILL.md` — основные инструкции
- `AGENTS.md` — расширенный вариант
- `scripts/` — вспомогательные скрипты
- `references/` — доп. документация
- `.zip` — предкомпилированный архив

### Ответ Download API
Возвращает **все файлы скилла** с содержимым — не нужно ни git clone, ни доступ к GitHub API.

## Текущая архитектура skill-hub (кратко)

- **Каталог**: `catalog.json` из git-репо `skill-hub-catalog` → `~/.skill-hub/`
- **Установка**: `Extension` из каталога → `adapter.install(ext, scope, cachePath)` → копирует файлы
- **Реестр**: `~/.skill-hub/installed.json` — `InstallRecord {type, name, version, agent, scope, path}`
- **Проектный конфиг**: `.skill-hub.json` — `extensions[] {type, name, version?, scope}`
- **Обновление**: `git pull` кеша → переустановка через adapter

## Варианты реализации

### 🟢 Вариант A: Прямые API skills.sh (рекомендуемый)

**Суть**: Использовать Search API для поиска, Download API для установки. Никаких git clone, никакого индекса.

```bash
skill-hub install skillssh:vercel-react-best-practices
# или
skill-hub search --source skillssh react
```

**Поток установки:**
1. Пользователь указывает `skillssh:<slug>` или `skillssh:<owner/repo>@<skill-name>`
2. CLI вызывает Search API для поиска → выбор скилла
3. CLI вызывает Download API → получает файлы в память
4. Файлы записываются через adapter (как обычная установка)
5. В `installed.json` и `.skill-hub.json` — запись с `source: "skillssh:<owner/repo>@<slug>"`, `version: hash`

**Обновление:**
1. Для записей с `source: "skillssh:..."` → повторный вызов Download API
2. Сравнение `hash` — если изменился → переустановка
3. Обновление `version` в реестре

**Изменения:**
- `InstallRecord` + `ProjectExtensionRecord` → `+ source?: string`
- Новый модуль `skillssh.ts` — обёртки над Search/Download API
- `install.ts` — детекция `skillssh:` префикса → альтернативный путь установки
- `update.ts` — source-aware обновление
- `sync.ts` — source-aware восстановление missing
- `search.ts` — `--source skillssh` флаг для поиска через skills.sh API

**Плюсы:**
- ✅ Нет клонирования репозиториев (ответ на главный вопрос)
- ✅ Поиск из CLI работает через API
- ✅ Минимальный трафик (только нужные файлы)
- ✅ Версия = hash от Download API (встроено)
- ✅ Полная совместимость с `.skill-hub.json` и `sync`

**Минусы:**
- ⚠️ Зависимость от доступности skills.sh API
- ⚠️ Нет офлайн-установки (но и каталог skill-hub требует сеть)
- ⚠️ API недокументирован и может измениться

---

### 🟡 Вариант B: Локальный индекс (то, что предложил пользователь)

**Суть**: Периодически собирать метаданные skills.sh скиллов в индексный JSON, хранить его локально или в репо.

**Откуда брать данные для индекса:**
- Search API: `https://skills.sh/api/search?q=*` (но он требует query ≥ 2 символа)
- GitHub Code Search: `SKILL.md filename:SKILL.md` (находит все SKILL.md на GitHub)
- Парсинг HTML skills.sh/official — ~80 орг с verified скиллами

**Формат индекса:**
```json
{
  "version": 1,
  "updated_at": "2026-04-13T...",
  "skills": [
    {
      "name": "vercel-react-best-practices",
      "slug": "vercel-react-best-practices",
      "description": "React and Next.js performance...",
      "source": "vercel-labs/agent-skills",
      "author": "vercel",
      "installs": 500000,
      "tags": ["react", "nextjs", "performance"]
    }
  ]
}
```

**Где хранить индекс:**
1. **В `skill-hub-catalog` репо** — обновляется через CI (GitHub Actions cron). При `skill-hub update` загружается вместе с catalog.json.
2. **Как отдельный файл** — `~/.skill-hub/skillssh-index.json`, обновляется при `skill-hub update`.

**Как генерировать:**
- Скрипт в `skill-hub-catalog/scripts/` — раз в сутки парсит skills.sh API/HTML → генерирует `skillssh-index.json`
- Или: встроить в CLI — при `skill-hub update` фетчить индекс с URL

**Плюсы:**
- ✅ Офлайн-поиск (после первой загрузки)
- ✅ Не зависит от стабильности skills.sh API для поиска
- ✅ Можно показывать skills.sh скиллы прямо в TUI (вкладка "Каталог")

**Минусы:**
- ⚠️ Индекс устаревает (но обновляется при `skill-hub update`)
- ⚠️ Нужен механизм генерации (CI или API-фетчер)
- ⚠️ Для установки всё равно нужен Download API (индекс содержит только метаданные)
- ⚠️ Дублирование данных: каталог + индекс

---

### 🔵 Вариант C: Гибрид (A + B) — наиболее полный

**Суть**: комбинация обоих подходов.

- **Поиск**: сначала локальный индекс (если есть), затем fallback на skills.sh API
- **Установка**: всегда через Download API (без git clone)
- **Индекс**: опциональный, хранится в `skill-hub-catalog`, обновляется CI-скриптом ежедневно
- **TUI**: вкладка "Каталог" показывает расширения из catalog.json + skills.sh-index.json (если есть), с пометкой источника

Это позволяет:
1. Работать с skills.sh даже если индекс не загружен (через API)
2. Показывать skills.sh скиллы в TUI без сетевого запроса (через индекс)
3. Не клонировать репозитории никогда

---

## Анализ: нужен ли индекс?

### Аргументы **за** индекс:

1. **TUI интеграция**: чтобы показать skills.sh скиллы в TUI (вкладка "Каталог"), нужны данные в памяти. API search работает по запросу, а для каталога нужен полный список. Без индекса невозможно показать все skills.sh скиллы в TUI browse mode.

2. **Стабильность**: API skills.sh не документирован, может измениться. Индекс — буфер стабильности.

3. **Производительность**: загруженный локально JSON быстрее HTTP-запросов.

### Аргументы **против** индекса:

1. **Масштаб**: на skills.sh тысячи скиллов от 80+ организаций. Индекс быстро вырастет до сотен КБ — мегабайт. Это утяжеляет `skill-hub-catalog` репо.

2. **Актуальность**: skills.sh активно растёт, индекс будет отставать.

3. **Нет необходимости для MVP**: Search API + Download API полностью покрывают use case "найти и установить".

4. **Дублирование инфраструктуры**: добавлять CI-скрипт, поддерживать формат индекса — overhead.

### Вывод

**Для MVP: Вариант A (без индекса)**. Search API + Download API — достаточно для полноценной работы. Установка, обновление, трекинг в `.skill-hub.json` — всё работает через API.

**Для V2: Вариант C (гибрид с индексом)**. Когда понадобится показывать skills.sh скиллы в TUI каталоге — добавить индекс в `skill-hub-catalog`. Но это отдельная задача.

---

## Возможные проблемы и решения

### 1. API skills.sh не документирован
- **Риск**: endpoints могут измениться
- **Решение**: обернуть все вызовы в `skillssh.ts`, легко обновить при изменении. Добавить error handling с fallback-сообщением "skills.sh API недоступен"

### 2. Несколько скиллов в одном репо
- **Проблема**: `vercel-labs/agent-skills` содержит 6+ скиллов
- **Решение**: при `skillssh:owner/repo` без указания скилла → Search API по source → интерактивный выбор. Или `skillssh:owner/repo@skill-name` для прямой установки

### 3. Скилл содержит скрипты и доп. файлы
- **Проблема**: Download API возвращает все файлы скилла (SKILL.md, AGENTS.md, scripts/, references/)
- **Решение**: skill-hub адаптеры ожидают SKILL.md. Нужно решить: копировать только SKILL.md или всю директорию? Рекомендация: копировать всю директорию (как это делает `npx skills add`)

### 4. Маппинг формата
- **Проблема**: skills.sh frontmatter → skill-hub Extension
- **Решение**:
  ```typescript
  function skillsshToExtension(skill: SkillsshSkill): Extension {
    return {
      type: 'skill',
      name: skill.name,
      description: skill.description,
      tags: [],
      author: skill.metadata?.author,
      version: skill.hash,
      scope: 'both',
      platforms: { 'claude-code': 'SKILL.md', cursor: 'SKILL.md', copilot: 'SKILL.md' },
      path: '', // виртуальный — файлы в памяти
      dependencies: [],
      projects: [],
    };
  }
  ```

### 5. Адаптеры и files-in-memory
- **Проблема**: текущие адаптеры (claude-code, cursor, copilot) ожидают `cachePath` с файлами на диске. Download API возвращает файлы в памяти.
- **Решение**: записать файлы во временную директорию (`~/.skill-hub/tmp/`) → вызвать `adapter.install()` → удалить tmp. Или расширить адаптеры для поддержки in-memory файлов.

### 6. Обновление github-скиллов при `sync`
- **Проблема**: `sync.ts` при `missing` расширении ищет его в catalog
- **Решение**: расширить `ProjectExtensionRecord` полем `source`, `sync.ts` проверяет source → если `skillssh:` → вызывает Download API для доустановки

---

## Рекомендуемый план реализации (MVP)

### Задачи

1. **`skillssh.ts`** — модуль для работы с skills.sh API
   - `searchSkillssh(query: string): Promise<SkillsshSearchResult[]>`
   - `downloadSkillssh(source: string, slug: string): Promise<SkillsshDownload>`
   - Типы: `SkillsshSearchResult`, `SkillsshDownload`, `SkillsshFile`
   - Error handling с понятными сообщениями

2. **Расширить типы** — `source?: string` в `InstallRecord` и `ProjectExtensionRecord`
   - Файлы: `registry.ts`, `config.ts`
   - Обратная совместимость: поле опциональное

3. **Расширить `install.ts`** — поддержка `skillssh:` префикса
   - Парсинг: `skillssh:owner/repo@skill-name` или `skillssh:slug`
   - Если только `skillssh:owner/repo` → search + выбор
   - Download → temp dir → adapter.install() → cleanup

4. **Расширить `update.ts`** — source-aware обновление
   - Для записей с `source: "skillssh:..."` → re-download → сравнить hash → переустановить

5. **Расширить `sync.ts`** — source-aware восстановление
   - Missing расширения с `source` → вызов соответствующего установщика

6. **Расширить `search.ts`** — `--source skillssh` флаг
   - Вызывает Search API, выводит результаты с количеством установок

7. **MCP tool** — расширить `search_extensions` и `install_extension` для поддержки skills.sh source

### Не входит в MVP
- TUI: отдельная вкладка/фильтр для skills.sh
- Индекс skills.sh в skill-hub-catalog
- Офлайн-поиск по skills.sh
