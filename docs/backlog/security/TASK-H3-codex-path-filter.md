# 🟠 H3: path-filter.ts — нет маркера для Codex

**Приоритет:** HIGH  
**Статус:** TODO  
**Файл:** `src/path-filter.ts:8-9`

## Проблема

`AGENT_MARKERS` не содержит `/.codex/`. Проектные Codex-расширения невидимы для `classifyRecord()`.

## Решение

```typescript
const AGENT_MARKERS = [
  '/.claude/',
  '/.cursor/',
  '/.codex/',      // ← добавить
  '/.github/',
  '/.agents/',
];
```

## Затрагиваемые файлы

- `src/path-filter.ts`
- Тесты: нужно создать `src/path-filter.test.ts`
