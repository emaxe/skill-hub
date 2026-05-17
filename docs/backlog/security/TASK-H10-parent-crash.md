# 🟠 H10: TUI — InstalledDetailScreen крашится для parent-managed

**Приоритет:** HIGH  
**Статус:** TODO  
**Файл:** `src/tui/screens/InstalledDetailScreen.tsx:58-79, 98-107`

## Проблема

Массив `actions` пуст для `effectiveScope === 'parent'`. Keyboard navigation может выставить `actionIndex = -1`, и Enter вызывает `actions[actionIndex].id` → crash.

## Решение

```typescript
// Guard в обработчике Enter
if (actions.length === 0) return;
if (actionIndex < 0 || actionIndex >= actions.length) return;

// Clamp actionIndex при навигации
setActionIndex(prev => Math.max(0, Math.min(prev, actions.length - 1)));
```

## Затрагиваемые файлы

- `src/tui/screens/InstalledDetailScreen.tsx`
