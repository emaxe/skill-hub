# 🟠 H11: TUI — retry обновления каталога не работает

**Приоритет:** HIGH  
**Статус:** TODO  
**Файл:** `src/tui/App.tsx:151-160`

## Проблема

`handleCatalogUpdateRetry()` сбрасывает refs, но ставит тот же `startupPhase` → `useEffect` с зависимостью `[startupPhase]` НЕ перезапускается.

## Решение

Ввести отдельный retry counter:

```typescript
const [retryCount, setRetryCount] = useState(0);

const handleCatalogUpdateRetry = () => {
  // reset refs...
  setRetryCount(c => c + 1);
};

useEffect(() => {
  if (startupPhase !== 'catalog') return;
  // ... update logic
}, [startupPhase, retryCount]);
```

## Затрагиваемые файлы

- `src/tui/App.tsx`
