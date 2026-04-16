# Спецификация: Перенос базовых скиллов

## Контекст

Bootstrap-скиллы `init-agents` и `exit-agents` используются при включении/выключении режима agents-conventions. Сейчас они копируются из бандла CLI (`cli/base-skills/agents-conventions/`) в `.agents/skills/` — ту же директорию, где хранятся обычные пользовательские скиллы. Это создаёт путаницу: системные скиллы визуально не отличимы от установленных пользователем.

**Цель:** Перенести все bootstrap-скиллы из проектного scope в глобальные расположения, отделив их от пользовательских скиллов.

### Итоговый flow

1. `enableConventions()` → `installBootstrapSkills()`:
   - `init-agents`/`exit-agents` → `~/.skill-hub/bootstrap/{name}/`
   - `agents-conventions` → глобально во все AI-агенты (`~/.claude/skills/`, `~/.cursor/skills/`, copilot/codex через marker-injection)
2. TUI hooks — формируют промпт с **абсолютным путём** к `~/.skill-hub/bootstrap/{name}/SKILL.md`
3. `disableConventions()` — удаляет `agents-conventions` из всех глобальных расположений; **не удаляет** `init-agents`/`exit-agents` из `~/.skill-hub/bootstrap/`
4. `sync.ts` — `init-agents` и `exit-agents` убраны из `BASE_SKILLS`; `agents-conventions` и `skill-hub` остаются
5. `skill-hub -U` — полная реконсиляция: восстановление структуры conventions + установка расширений из `.skill-hub.json`

## Требования

- **REQ-1:** `init-agents` и `exit-agents` должны копироваться в `~/.skill-hub/bootstrap/init-agents/SKILL.md` и `~/.skill-hub/bootstrap/exit-agents/SKILL.md` при вызове `enableConventions()`.
- **REQ-2:** `agents-conventions` устанавливается глобально во все поддерживаемые AI-агенты (claude-code, cursor — копия директории; copilot, codex — marker-injection).
- **REQ-3:** Промпты в `useConventionsInit.ts` и `useConventionsExit.ts` должны использовать абсолютный путь к `~/.skill-hub/bootstrap/{name}/SKILL.md` вместо относительного `.agents/skills/{name}/SKILL.md`.
- **REQ-4:** При `disableConventions()` НЕ удалять `init-agents`/`exit-agents` из `~/.skill-hub/bootstrap/` — они глобальные и используются всеми проектами.
- **REQ-5:** При `disableConventions()` удалять `agents-conventions` из всех глобальных расположений AI-агентов.
- **REQ-6:** `init-agents` и `exit-agents` НЕ должны регистрироваться в реестре (registry) как установленные расширения — это системные файлы, не пользовательские.
- **REQ-7:** `sync.ts` — убрать `init-agents` и `exit-agents` из `BASE_SKILLS` (они больше не в `.agents/skills/` и не конфликтуют с синхронизацией). `agents-conventions` и `skill-hub` остаются.
- **REQ-8:** `getConventionsStatus()` — `extensionCount` не должен включать `init-agents`/`exit-agents` (они больше не в `.agents/skills/`, так что это решается автоматически).
- **REQ-9:** Обновление bootstrap-скиллов при повторном вызове `enableConventions()` — `init-agents`/`exit-agents` в `~/.skill-hub/bootstrap/` перезаписываются актуальной версией из бандла CLI.
- **REQ-10:** Существующие тесты должны продолжать проходить.

## Ограничения

- **~~Не входит в скоуп:~~ перенос скилла `agents-conventions`** — реализован в ходе фичи (глобальная установка во все агенты).
- **~~Не входит в скоуп:~~ изменение base-skills для других агентов** — `agents-conventions` теперь устанавливается глобально во все 4 агента.
- **Не входит в скоуп:** изменение содержимого SKILL.md файлов `init-agents`/`exit-agents` — только перенос расположения.
- **Кроссплатформенность:** `~/.skill-hub/` уже используется как кеш каталога, путь формируется через `os.homedir()`. Нет специфичных проблем.

## Отклонения от плана

1. **`agents-conventions` — глобальная установка.** Изначально планировалось оставить в `.agents/skills/` (проектный scope). В ходе реализации переделано на глобальную установку во все 4 AI-агента (claude-code, cursor — копия директории; copilot, codex — marker-injection) — без регистрации в registry.
2. **`skill-hub -U` — полная реконсиляция.** Добавлена функция `ensureConventionsStructure()` и логика восстановления расширений из `.skill-hub.json` в команде `update`. Не входило в исходный план.

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
