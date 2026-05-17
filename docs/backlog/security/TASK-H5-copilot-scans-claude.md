# 🟠 H5: Copilot adapter сканирует Claude-директории

**Приоритет:** HIGH  
**Статус:** TODO  
**Файл:** `src/adapters/copilot.ts:130-143`

## Проблема

`scanInstalled()` парсит `.claude/skills/` → Claude-скиллы ложно отображаются как Copilot-установки.

## Решение

Удалить сканирование Claude-директорий из Copilot адаптера. Copilot should only scan:
- `copilot-instructions.md` (маркеры)
- `.github/skills/` (дополнительные файлы)

## Затрагиваемые файлы

- `src/adapters/copilot.ts`
- Тесты: `src/adapters/copilot.test.ts`
