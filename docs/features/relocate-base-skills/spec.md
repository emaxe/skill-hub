# Спецификация: Перенос базовых скиллов

## Контекст

Bootstrap-скиллы `init-agents` и `exit-agents` используются при включении/выключении режима agents-conventions. Сейчас они копируются из бандла CLI (`cli/base-skills/agents-conventions/`) в `.agents/skills/` — ту же директорию, где хранятся обычные пользовательские скиллы. Это создаёт путаницу: системные скиллы визуально не отличимы от установленных пользователем.

**Цель:** Перенести `init-agents` и `exit-agents` в глобальное расположение `~/.skill-hub/bootstrap/`, отделив их от пользовательских скиллов. Скилл `agents-conventions` остаётся в `.agents/skills/` без изменений.

### Текущий flow

1. `enableConventions()` → `installBootstrapSkills()` — копирует все 3 скилла в `.agents/skills/{name}/`
2. TUI hooks (`useConventionsInit.ts`, `useConventionsExit.ts`) — формируют промпт с путём `.agents/skills/init-agents/SKILL.md` и передают AI-агенту
3. `disableConventions()` — удаляет все 3 скилла из `.agents/skills/`
4. `sync.ts` — исключает `init-agents`, `exit-agents` из синхронизации через `BASE_SKILLS`

### Целевой flow

1. `enableConventions()` → `installBootstrapSkills()` — копирует `init-agents` и `exit-agents` в `~/.skill-hub/bootstrap/`, а `agents-conventions` по-прежнему в `.agents/skills/`
2. TUI hooks — формируют промпт с **абсолютным путём** к `~/.skill-hub/bootstrap/{name}/SKILL.md`
3. `disableConventions()` — **не удаляет** `init-agents`/`exit-agents` из `~/.skill-hub/bootstrap/` (они глобальные, общие для всех проектов); удаляет только `agents-conventions` из `.agents/skills/`
4. `sync.ts` — `init-agents` и `exit-agents` больше не появляются в `.agents/skills/`, можно убрать из `BASE_SKILLS` (но `agents-conventions` и `skill-hub` остаются)

## Требования

- **REQ-1:** `init-agents` и `exit-agents` должны копироваться в `~/.skill-hub/bootstrap/init-agents/SKILL.md` и `~/.skill-hub/bootstrap/exit-agents/SKILL.md` при вызове `enableConventions()`.
- **REQ-2:** `agents-conventions` продолжает устанавливаться в `.agents/skills/agents-conventions/` без изменений.
- **REQ-3:** Промпты в `useConventionsInit.ts` и `useConventionsExit.ts` должны использовать абсолютный путь к `~/.skill-hub/bootstrap/{name}/SKILL.md` вместо относительного `.agents/skills/{name}/SKILL.md`.
- **REQ-4:** При `disableConventions()` НЕ удалять `init-agents`/`exit-agents` из `~/.skill-hub/bootstrap/` — они глобальные и используются всеми проектами.
- **REQ-5:** При `disableConventions()` продолжать удалять `agents-conventions` из `.agents/skills/`.
- **REQ-6:** `init-agents` и `exit-agents` НЕ должны регистрироваться в реестре (registry) как установленные расширения — это системные файлы, не пользовательские.
- **REQ-7:** `sync.ts` — убрать `init-agents` и `exit-agents` из `BASE_SKILLS` (они больше не в `.agents/skills/` и не конфликтуют с синхронизацией). `agents-conventions` и `skill-hub` остаются.
- **REQ-8:** `getConventionsStatus()` — `extensionCount` не должен включать `init-agents`/`exit-agents` (они больше не в `.agents/skills/`, так что это решается автоматически).
- **REQ-9:** Обновление bootstrap-скиллов при повторном вызове `enableConventions()` — `init-agents`/`exit-agents` в `~/.skill-hub/bootstrap/` перезаписываются актуальной версией из бандла CLI.
- **REQ-10:** Существующие тесты должны продолжать проходить.

## Ограничения

- **Не входит в скоуп:** перенос скилла `agents-conventions` — он остаётся в `.agents/skills/`.
- **Не входит в скоуп:** изменение base-skills для других агентов (`claude-code`, `cursor`, `copilot`, `codex` в `base-setup.ts`) — эта фича только про conventions bootstrap.
- **Не входит в скоуп:** изменение содержимого SKILL.md файлов `init-agents`/`exit-agents` — только перенос расположения.
- **Кроссплатформенность:** `~/.skill-hub/` уже используется как кеш каталога, путь формируется через `os.homedir()`. Нет специфичных проблем.

## Макеты и референсы

> Не применимо.

## Кодстайл и конвенции

- TypeScript, сборка через `tsc`.
- JSDoc на русском для экспортируемых функций.
- Комментарии — «почему», а не «что».
- Для платформенных различий использовать `platform.ts`.
- Пути через `path.join()`, домашнюю директорию через `os.homedir()`.
- Версии и документация синхронизированы с кодом.

## Переиспользуемые решения

- `cli/src/base-setup.ts` — аналогичный паттерн: `getBaseSkillSourcePath()` / `getBaseSkillDestPath()` / `installBaseSkill()` — копирование base-skill из бандла CLI в глобальную директорию. Можно использовать как образец.
- `cli/src/config.ts` → `os.homedir()` + `path.join()` для формирования `~/.skill-hub/` пути.
- `cli/src/conventions.ts` → `installBootstrapSkills()` — текущая функция, которую нужно модифицировать.
- `cli/src/tui/hooks/useConventionsInit.ts` / `useConventionsExit.ts` — хуки с промптами.

## Критерии приёмки

1. После `enableConventions()` — файлы `~/.skill-hub/bootstrap/init-agents/SKILL.md` и `~/.skill-hub/bootstrap/exit-agents/SKILL.md` существуют и содержат актуальное содержимое из бандла.
2. После `enableConventions()` — в `.agents/skills/` **нет** директорий `init-agents/` и `exit-agents/`.
3. После `enableConventions()` — скилл `agents-conventions` присутствует в `.agents/skills/agents-conventions/`.
4. TUI init/exit промпты содержат абсолютный путь к `~/.skill-hub/bootstrap/`.
5. После `disableConventions()` — файлы в `~/.skill-hub/bootstrap/` **остаются**.
6. `npm test` — все тесты проходят.
7. `npm run build` — сборка без ошибок.

## Затронутые файлы

| Файл | Изменение |
|------|-----------|
| `cli/src/conventions.ts` | `installBootstrapSkills()` — разделить логику: `agents-conventions` → `.agents/skills/`, `init-agents`/`exit-agents` → `~/.skill-hub/bootstrap/`. Убрать регистрацию init/exit в registry. В `disableConventions()` не удалять из bootstrap. |
| `cli/src/tui/hooks/useConventionsInit.ts` | Заменить путь в `INIT_PROMPT` на абсолютный `~/.skill-hub/bootstrap/init-agents/SKILL.md` (через `os.homedir()` в рантайме). |
| `cli/src/tui/hooks/useConventionsExit.ts` | Аналогично — путь в `EXIT_PROMPT`. |
| `cli/src/sync.ts` | Убрать `init-agents` и `exit-agents` из `BASE_SKILLS`. |
| `CLAUDE.md` | Обновить описание расположения bootstrap-скиллов. |
