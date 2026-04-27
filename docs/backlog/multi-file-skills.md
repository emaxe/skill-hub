# Задача: Поддержка многофайловых скиллов

**Slug:** multi-file-skills
**Статус:** Backlog
**Приоритет:** Высокий
**Дата создания:** 2026-04-27

## Краткое описание

Добавить полную поддержку скиллов (и других расширений), содержащих дополнительные файлы помимо основного `SKILL.md` — скрипты (`.sh`, `.py`, `.js`, `.ts`), конфигурации, шаблоны, данные и любые другие ресурсы. Сейчас при установке копируется **только** основной `.md` файл; дополнительные файлы из директории расширения в каталоге игнорируются.

## Проблема

Текущий механизм установки (`install` в каждом адаптере) вызывает `fs.copyFileSync(srcPath, destPath)` — копирует ровно один файл. Это не позволяет создавать скиллы, которые:

- Содержат исполняемые скрипты (bash, python, node), на которые ссылается SKILL.md
- Включают шаблоны файлов, которые агент должен использовать при генерации кода
- Содержат конфигурационные файлы или примеры данных
- Поставляют утилиты/хелперы вместе с инструкцией

### Текущее поведение (по адаптерам)

| Адаптер | Метод install | Что копируется |
|---------|--------------|----------------|
| **claude-code** | `fs.copyFileSync(srcPath, destPath)` | Один файл SKILL.md |
| **cursor** | `fs.writeFileSync(destPath, cursorFm + body)` | Один файл (генерируется с Cursor frontmatter) |
| **copilot** | marker-injection в copilot-instructions.md | Контент вставляется в общий файл |
| **codex** | marker-injection в AGENTS.md | Контент вставляется в общий файл |
| **agents-conventions** | `fs.copyFileSync(srcPath, destPath)` | Один файл SKILL.md |

### Парадокс upload vs install

В `upload.ts` уже есть `copyDirSync()` (строка 347) — при загрузке в каталог, если источник — директория, копируется **всё содержимое**. Но при установке обратно из каталога берётся только основной `.md`. Дополнительные файлы попадают в каталог, но никогда не доставляются пользователю.

## Целевое поведение

### 1. Структура многофайлового скила в каталоге

```
skills/
  git-commit-and-push/
    SKILL.md              # обязательный, основной файл с инструкцией
    commit.sh             # скрипт, вызываемый из SKILL.md
    templates/
      commit-template.txt # шаблон
    utils/
      validate.py         # утилита
```

### 2. Структура после установки (по адаптерам)

#### Claude Code / agents-conventions (файловые адаптеры)

```
.claude/skills/git-commit-and-push/
  SKILL.md
  commit.sh
  templates/
    commit-template.txt
  utils/
    validate.py
```

Эти адаптеры уже работают с директориями (`skills/{name}/`), поэтому дополнительные файлы ложатся рядом с SKILL.md естественным образом.

#### Cursor (файловый адаптер с трансформацией)

```
.cursor/skills/git-commit-and-push/
  SKILL.md              # с Cursor frontmatter (description, alwaysApply)
  commit.sh             # без трансформации
  templates/
    commit-template.txt
  utils/
    validate.py
```

Cursor трансформирует только основной `.md` файл (добавляет frontmatter). Остальные файлы копируются as-is.

#### Copilot / Codex (marker-injection адаптеры)

Эти адаптеры встраивают контент в единый файл (`copilot-instructions.md` / `AGENTS.md`). Для дополнительных файлов нужна **отдельная директория**:

```
# Copilot:
.github/skills/git-commit-and-push/
  commit.sh
  templates/commit-template.txt

# Codex:
.codex/skills/git-commit-and-push/
  commit.sh
  templates/commit-template.txt
```

В injected-контент добавляется указание пути к дополнительным файлам:
```markdown
<!-- skill-hub: git-commit-and-push -->
<!-- additional files: .github/skills/git-commit-and-push/ -->
...контент SKILL.md...
<!-- /skill-hub: git-commit-and-push -->
```

## План реализации

### Фаза 1: Каталог и типы

#### 1.1. Обновить тип `Extension` в `catalog.ts`

Добавить опциональное поле для указания дополнительных файлов:

```typescript
export interface Extension {
  // ...существующие поля...
  /** Список дополнительных файлов/директорий относительно директории расширения */
  files?: string[];
}
```

**Варианты дизайна `files`:**

- **Явный список** (`files: ["commit.sh", "templates/"]`) — контролируемый, но требует ручного перечисления
- **Неявный** (копировать всё кроме основного `.md`) — проще для авторов, но менее предсказуемо
- **Рекомендуемый подход:** неявный (копировать всю директорию), но с поддержкой `.skillignore` для исключений

#### 1.2. Обновить `parseExtension()` в `catalog.ts`

Парсить поле `files` из catalog.json.

#### 1.3. Обновить `buildCatalogEntry()` в `upload.ts`

При загрузке сканировать директорию расширения на наличие дополнительных файлов и заполнять `files`.

### Фаза 2: Адаптеры — установка

#### 2.1. Claude Code адаптер (`adapters/claude-code.ts`)

**Изменить метод `install()`:**

```typescript
async install(ext: Extension, scope: 'global' | 'project', cachePath: string): Promise<void> {
  const sourceFile = this.getSourceFile(ext);
  const srcDir = path.join(cachePath, ext.path);  // директория расширения
  const srcPath = path.join(srcDir, sourceFile);
  const destDir = path.dirname(this.getInstallPath(ext, scope));  // skills/{name}/

  if (!fs.existsSync(srcPath)) {
    throw new Error(`Source file not found: ${srcPath}`);
  }

  // Копировать всю директорию расширения
  copyExtensionDir(srcDir, destDir);
}
```

**Важно:** `ext.path` в каталоге сейчас указывает на файл (`skills/{name}/SKILL.md`), нужно будет вычислять директорию через `path.dirname(ext.path)` или изменить формат `path` на директорию.

#### 2.2. Cursor адаптер (`adapters/cursor.ts`)

**Изменить метод `install()`:**
- Основной `.md` файл: трансформация с Cursor frontmatter (как сейчас)
- Дополнительные файлы: копирование as-is в ту же директорию

```typescript
async install(ext: Extension, scope: 'global' | 'project', cachePath: string): Promise<void> {
  // 1. Трансформация основного файла (как сейчас)
  // ...

  // 2. Копирование дополнительных файлов
  const srcDir = path.join(cachePath, path.dirname(ext.path));
  const destDir = path.dirname(destPath);
  copyAdditionalFiles(srcDir, destDir, sourceFile);  // исключая основной .md
}
```

#### 2.3. Copilot адаптер (`adapters/copilot.ts`)

**Изменить метод `install()`:**
- Контент основного файла: marker-injection (как сейчас)
- Дополнительные файлы: копировать в `.github/skills/{name}/`
- Добавить HTML-комментарий с путём к файлам в injected-секцию

**Изменить метод `remove()`:**
- Удалять и marker-секцию, и директорию `.github/skills/{name}/`

**Новый метод `getAdditionalFilesPath()`:**
```typescript
getAdditionalFilesPath(ext: Extension, scope: 'global' | 'project'): string {
  if (scope === 'project') {
    return path.join(this.projectDir, '.github', 'skills', ext.name);
  }
  // global: рядом с copilot-instructions.md
  return path.join(path.dirname(this.getInstallPath(ext, scope)), 'skills', ext.name);
}
```

#### 2.4. Codex адаптер (`adapters/codex.ts`)

Аналогично Copilot:
- Контент: marker-injection в AGENTS.md
- Дополнительные файлы: `.codex/skills/{name}/`

#### 2.5. agents-conventions адаптер (`adapters/agents-conventions.ts`)

Аналогично Claude Code — копирование всей директории в `.agents/skills/{name}/`.

### Фаза 3: Адаптеры — удаление и перемещение

#### 3.1. Обновить `remove()` во всех адаптерах

- **Claude Code, Cursor, conventions:** уже удаляют директорию целиком (`fs.rmSync(dir, { recursive: true })`) — работает корректно.
- **Copilot, Codex:** добавить удаление директории дополнительных файлов.

#### 3.2. Обновить логику `move` (global ↔ project)

Перемещение должно переносить и дополнительные файлы. Для файловых адаптеров это уже работает (перенос директории). Для marker-injection адаптеров нужно:
1. Удалить marker-секцию из source
2. Вставить marker-секцию в destination
3. Переместить директорию дополнительных файлов

### Фаза 4: Утилиты

#### 4.1. Общая функция `copyExtensionDir()`

```typescript
/**
 * Рекурсивно копирует содержимое директории расширения.
 * Пропускает файлы из .skillignore (если есть).
 */
function copyExtensionDir(src: string, dest: string, ignore?: string[]): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (ignore?.includes(entry.name)) continue;
    const srcEntry = path.join(src, entry.name);
    const destEntry = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyExtensionDir(srcEntry, destEntry, ignore);
    } else {
      fs.copyFileSync(srcEntry, destEntry);
    }
  }
}
```

#### 4.2. Функция `copyAdditionalFiles()`

Для адаптеров, которые трансформируют основной файл (Cursor) или используют injection (Copilot, Codex):

```typescript
/**
 * Копирует все файлы из директории расширения, кроме основного .md.
 */
function copyAdditionalFiles(srcDir: string, destDir: string, mainFile: string): void {
  if (!fs.existsSync(srcDir)) return;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.name === mainFile) continue;
    // ...рекурсивное копирование
  }
}
```

#### 4.3. Функция `hasAdditionalFiles()`

Проверка наличия дополнительных файлов у расширения в каталоге:

```typescript
function hasAdditionalFiles(ext: Extension, cachePath: string): boolean {
  const dir = path.join(cachePath, path.dirname(ext.path));
  if (!fs.existsSync(dir)) return false;
  const entries = fs.readdirSync(dir);
  return entries.length > 1;  // > 1, т.к. основной файл всегда есть
}
```

### Фаза 5: Обновление `ext.path` в каталоге

**Проблема:** сейчас `ext.path` указывает на файл (`skills/git-commit-and-push/SKILL.md`). Для многофайловых скиллов удобнее указывать на директорию.

**Решение — обратная совместимость:**
- Если `ext.path` заканчивается на `.md` — однофайловый скилл (old format), `path.dirname()` для директории
- Если `ext.path` не заканчивается на `.md` — многофайловый, это путь к директории
- Либо оставить path как есть (всегда к файлу) и вычислять директорию через `path.dirname(ext.path)`

**Рекомендация:** оставить `path` как путь к основному файлу (обратная совместимость), а директорию вычислять через `path.dirname()`.

### Фаза 6: Валидация и upload

#### 6.1. Обновить `validateExtensionsForUpload()`

- Проверять дополнительные файлы на наличие бинарников (запретить или предупредить)
- Проверять суммарный размер директории (лимит, например 1 МБ)
- Добавить проверку `.skillignore`

#### 6.2. Обновить `buildCatalogEntry()`

- Сканировать директорию расширения
- Заполнять поле `files` списком дополнительных файлов

### Фаза 7: TUI и CLI

#### 7.1. Обновить `DetailScreen.tsx` / `InstalledDetailScreen.tsx`

Показывать список дополнительных файлов в карточке расширения:
```
📦 git-commit-and-push
   SKILL.md
   commit.sh
   templates/commit-template.txt
```

#### 7.2. Обновить `ContentScreen.tsx`

Возможность просматривать не только основной файл, но и дополнительные.

#### 7.3. Обновить `info` CLI-команду

Выводить список файлов расширения.

### Фаза 8: MCP-сервер

#### 8.1. Обновить `get_extension_info`

Возвращать список дополнительных файлов в ответе.

### Фаза 9: Тестирование

#### 9.1. Unit-тесты для каждого адаптера

- Установка многофайлового скила: все файлы на месте
- Удаление: все файлы удалены (включая дополнительные)
- Перемещение: все файлы перенесены

#### 9.2. Unit-тесты для утилит

- `copyExtensionDir()` — рекурсивное копирование
- `copyAdditionalFiles()` — исключение основного файла
- `hasAdditionalFiles()` — корректная проверка

#### 9.3. Тесты upload

- Загрузка многофайлового скила в каталог
- `buildCatalogEntry()` с дополнительными файлами
- Валидация размера и содержимого

#### 9.4. Тесты обратной совместимости

- Однофайловые скиллы продолжают работать без изменений
- Старый формат `ext.path` корректно обрабатывается

### Фаза 10: Документация

- Обновить `CLAUDE.md` — раздел про адаптеры, структуру файлов
- Обновить `README.md` — инструкции по созданию многофайловых скиллов
- Обновить `CONTRIBUTING.md` — правила оформления скилов с доп. файлами
- Добавить раздел в каталог-документацию о структуре многофайлового расширения

## Файлы для изменения

| Файл | Что менять |
|------|-----------|
| `cli/src/catalog.ts` | Тип `Extension`: поле `files?`, `parseExtension()` |
| `cli/src/adapters/claude-code.ts` | `install()`: копирование директории целиком |
| `cli/src/adapters/cursor.ts` | `install()`: доп. файлы + трансформация основного |
| `cli/src/adapters/copilot.ts` | `install()`, `remove()`: директория доп. файлов |
| `cli/src/adapters/codex.ts` | `install()`, `remove()`: директория доп. файлов |
| `cli/src/adapters/agents-conventions.ts` | `install()`: копирование директории целиком |
| `cli/src/upload.ts` | `buildCatalogEntry()`, `validateExtensionsForUpload()` |
| `cli/src/mcp.ts` | `get_extension_info`: поле files |
| `cli/src/commands/info.ts` | Вывод списка файлов |
| `cli/src/tui/screens/DetailScreen.tsx` | Список файлов в карточке |
| `cli/src/tui/screens/InstalledDetailScreen.tsx` | Список файлов в карточке |
| `cli/src/tui/screens/ContentScreen.tsx` | Просмотр доп. файлов |
| `CLAUDE.md` | Документация по структуре |
| `README.md` | Инструкции для пользователей |

## Правила оформления многофайлового скила (для документации)

### Структура директории

```
skills/{skill-name}/
  SKILL.md              # обязательный, точка входа
  [дополнительные файлы] # опциональные
```

### Frontmatter SKILL.md

```yaml
---
name: my-multi-file-skill
description: Скилл с дополнительными файлами
version: 1.0.0
author: username
tags: tag1, tag2
---
```

### Ссылки на дополнительные файлы в SKILL.md

Рекомендация — использовать **относительные пути** от директории скила:

```markdown
## Использование

Запусти скрипт `./deploy.sh` для деплоя.
Шаблон коммита находится в `./templates/commit.txt`.
```

### Ограничения

- Максимальный размер директории расширения: **1 МБ** (настраиваемо)
- Запрещены бинарные файлы (кроме изображений?)
- Запрещены symlinks внутри расширения
- `.skillignore` — файл со списком исключений (аналог `.gitignore`)

### Примеры хороших скилов с доп. файлами

```
skills/git-commit-and-push/
  SKILL.md          # инструкция: "используй commit.sh для коммита"
  commit.sh         # bash-скрипт

skills/project-setup/
  SKILL.md          # инструкция: "создай проект по шаблонам из templates/"
  templates/
    tsconfig.json
    eslint.config.js
    .prettierrc

skills/code-review/
  SKILL.md          # инструкция: "используй checklist.md при ревью"
  checklist.md      # чеклист для code review
  prompts/
    security.md     # промпт для проверки безопасности
    performance.md  # промпт для проверки производительности
```

## Обратная совместимость

- Однофайловые скиллы (только SKILL.md) **должны продолжить работать без изменений**
- Поле `files` в `Extension` опционально — отсутствие = однофайловый скилл
- Формат `ext.path` не меняется — всегда путь к основному файлу
- Версия catalog.json не меняется (поле `files` добавляется опционально)

## Соглашение об имени файла задачи

После полной реализации переименовать файл: `multi-file-skills.md` → `_multi-file-skills.md`
