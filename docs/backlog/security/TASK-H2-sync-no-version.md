# 🟠 H2: sync.ts — расширения без version считаются "не в каталоге"

**Приоритет:** HIGH  
**Статус:** TODO  
**Файл:** `src/sync.ts:79-100`

## Проблема

`inCatalog` определяется по наличию `catalogVersion`. Если каталожная запись не содержит `version` → `inCatalog = false` → расширение ложно предлагается как "untracked".

## Решение

Определять `inCatalog` по наличию расширения в каталоге (name + type match), независимо от version:

```typescript
const catalogEntry = catalog.find(c => c.name === ext.name && c.type === ext.type);
const inCatalog = !!catalogEntry;
const catalogVersion = catalogEntry?.version;
```

## Затрагиваемые файлы

- `src/sync.ts`
- Тесты: нужно создать `src/sync.test.ts`
