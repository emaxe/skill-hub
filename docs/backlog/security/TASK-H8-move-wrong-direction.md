# 🟠 H8: TUI — InstalledScreen передаёт toScope вместо currentScope

**Приоритет:** HIGH  
**Статус:** TODO  
**Файл:** `src/tui/screens/InstalledScreen.tsx:182-189`

## Проблема

`InstalledScreen` вычисляет `toScope` (целевой scope) и передаёт его как prop в `MoveScreen`. Однако `MoveScreen` интерпретирует полученное значение как **текущий** scope.

## Последствие

Экран перемещения показывает обратное направление. Может выполнить перемещение в неправильную сторону.

## Решение

Передавать фактический scope расширения (`currentScope`), а не вычисленный `toScope`:

```typescript
onMoveExt(extension, extension.scope); // текущий scope, не целевой
```

## Затрагиваемые файлы

- `src/tui/screens/InstalledScreen.tsx`
- Проверить `src/tui/screens/MoveScreen.tsx` (как использует prop)
