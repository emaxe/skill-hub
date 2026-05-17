# 🟠 H1: Поиск в каталоге — не case-insensitive для name/tags

**Приоритет:** HIGH  
**Статус:** TODO  
**Файл:** `src/catalog.ts:119-127`

## Проблема

`searchExtensions()` применяет `query.toLowerCase()`, но `e.name` и `e.tags` сравниваются без приведения к нижнему регистру.

## Решение

```typescript
const q = query.toLowerCase();
return extensions.filter(e =>
  e.name.toLowerCase().includes(q) ||
  e.description?.toLowerCase().includes(q) ||
  e.tags?.some(t => t.toLowerCase().includes(q))
);
```

## Затрагиваемые файлы

- `src/catalog.ts`
- Тесты: `src/catalog.test.ts`
