# 🟠 H13: update крашится в agents-conventions на global records

**Приоритет:** HIGH  
**Статус:** TODO  
**Файл:** `src/commands/update.ts:44-58`

## Проблема

`adapter.getInstallPath(ext, pe.scope)` вызывается без guard. `AgentsConventionsAdapter` бросает исключение для `scope === 'global'` (не поддерживает глобальные расширения).

## Решение

```typescript
if (agent === 'agents-conventions' && pe.scope === 'global') {
  console.warn(`⚠️ Пропуск "${ext.name}": agents-conventions не поддерживает global scope`);
  continue;
}
```

Или обернуть в try/catch с понятным сообщением.

## Затрагиваемые файлы

- `src/commands/update.ts`
