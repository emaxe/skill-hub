# 🔴 C8: base-setup.ts — JSON.stringify для сравнения конфигов

**Приоритет:** CRITICAL  
**Статус:** TODO  
**Файл:** `src/base-setup.ts:76-89`

## Проблема

`checkMcpUpToDate()` сравнивает MCP-конфигурации через `JSON.stringify(actual) === JSON.stringify(expected)`.

Порядок ключей в JSON-объектах **не гарантирован** спецификацией. Разный порядок ключей при одинаковом содержимом → ложное несовпадение.

## Последствие

- MCP-конфиг перезаписывается при **каждом** запуске TUI (ложный "outdated")
- Перезапись может затереть пользовательские изменения (доп. параметры в MCP entry)
- Лишние операции FS при каждом старте

## Решение

```typescript
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return false;
  
  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  if (keysA.length !== keysB.length) return false;
  
  return keysA.every(key => 
    deepEqual(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key]
    )
  );
}

function checkMcpUpToDate(actual: unknown, expected: unknown): boolean {
  return deepEqual(actual, expected);
}
```

Или использовать `JSON.stringify` с сортировкой ключей:
```typescript
const sortedStringify = (obj: unknown) =>
  JSON.stringify(obj, Object.keys(obj as object).sort());
```

## Затрагиваемые файлы

- `src/base-setup.ts`
- Тесты: `src/base-setup.test.ts`

## Связанные задачи

- M12 (installMcp перезаписывает невалидный JSON)
