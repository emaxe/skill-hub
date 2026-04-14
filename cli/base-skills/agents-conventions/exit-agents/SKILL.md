---
name: exit-agents
description: Exit agents-conventions mode. All steps are now handled programmatically by CLI (disableConventions in conventions.ts). This skill is kept for reference only. | Выход из режима agents-conventions. Все шаги теперь выполняются программно через CLI (disableConventions в conventions.ts). Скилл сохранён только для справки.
---

# Выход из режима agents-conventions

> **Примечание:** Все шаги этого скилла теперь выполняются программно через CLI
> (`disableConventions()` в `conventions.ts`). AI-агент больше не нужен.

## Что делает CLI автоматически

1. **Восстановление корневых файлов** — парсит `.agents/rules/project-rules.md`,
   извлекает секции по маркерам (`## Из CLAUDE.md` и т.д.) и записывает обратно
   в соответствующие корневые файлы
2. **Миграция правил** — копирует `.agents/rules/*.md` в формат целевого агента
   (`.claude/*.md`, `.cursor/rules/*.mdc`, `.github/instructions/*.instructions.md`)
3. **Очистка корневых тонких указателей** — удаляет `CLAUDE.md`, `.cursorrules`,
   `.github/copilot-instructions.md` если они остались тонкими указателями
4. **Миграция расширений** — переносит skill-hub расширения в директорию целевого агента
5. **Удаление симлинков** — `.claude/skills`, `.github/skills`, `.cursor/skills`
6. **Удаление тонких указателей** — `.claude/CLAUDE.md`, `.github/instructions/...`,
   `.cursor/rules/...`
7. **Удаление bootstrap-скиллов** — `agents-conventions`, `init-agents`, `exit-agents`
8. **Обновление конфига** — переключает агент на целевой
9. **Удаление артефактов** — `.agents/` и `AGENTS.md` (по подтверждению пользователя)
