# 🟠 H9: TUI — DetailScreen удаляет из defaultScope вместо реального

**Приоритет:** HIGH  
**Статус:** TODO  
**Файл:** `src/tui/screens/DetailScreen.tsx:41, 137-149`

## Проблема

При удалении расширения из DetailScreen используется `defaultScope` из настроек, а не фактический scope установленного расширения.

## Решение

Получать фактический scope из registry record:

```typescript
const installedRecord = registry.find(r => r.name === ext.name && r.type === ext.type);
const actualScope = installedRecord?.scope || defaultScope;
onRemove(ext, actualScope);
```

## Затрагиваемые файлы

- `src/tui/screens/DetailScreen.tsx`
