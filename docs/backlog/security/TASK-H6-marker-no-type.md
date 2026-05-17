# 🟠 H6: Copilot/Codex маркеры без типа — коллизия имён

**Приоритет:** HIGH  
**Статус:** TODO  
**Файлы:** `src/adapters/copilot.ts:14-15`, `src/adapters/codex.ts:15-16`

## Проблема

Маркер `<!-- skill-hub: {name} -->` не содержит тип расширения. Skill и command с одинаковым именем перезаписывают друг друга.

## Решение

Новый формат маркера:
```
<!-- skill-hub:skill:my-extension -->
...
<!-- /skill-hub:skill:my-extension -->
```

Обратная совместимость — при парсинге проверять оба формата:
```typescript
const MARKER_REGEX = /<!-- skill-hub:(?:(\w+):)?(\S+) -->/;
// group 1 = type (optional), group 2 = name
```

## Затрагиваемые файлы

- `src/adapters/copilot.ts`
- `src/adapters/codex.ts`
- Тесты: `src/adapters/copilot.test.ts`, `src/adapters/codex.test.ts`

## Связанные задачи

- H7 (scan всегда возвращает type: skill)
- C2 (removeSection при отсутствии конечного маркера)
