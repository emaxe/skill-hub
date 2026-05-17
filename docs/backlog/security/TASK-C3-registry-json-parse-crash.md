# 🔴 C3: registry.ts — JSON.parse без try/catch

**Приоритет:** CRITICAL  
**Статус:** TODO  
**Файл:** `src/registry.ts:35-45`

## Проблема

Метод `load()` вызывает `JSON.parse(fs.readFileSync(...))` без обработки исключений. Повреждённый `installed.json` крашит **все** операции CLI.

## Воспроизведение

1. Повредить `~/.skill-hub/installed.json` (неполная запись, ручное редактирование с ошибкой)
2. Запустить любую команду: `skill-hub list`, `skill-hub install`, `skill-hub` (TUI)
3. Unhandled `SyntaxError: Unexpected token...`

## Решение

```typescript
load(): RegistryData {
  if (!fs.existsSync(this.path)) {
    return { version: 3, extensions: [] };
  }
  try {
    const raw = fs.readFileSync(this.path, 'utf-8');
    const data = JSON.parse(raw);
    return { version: 3, extensions: data.extensions || [] };
  } catch (err) {
    // Backup повреждённого файла
    const backupPath = this.path + '.backup.' + Date.now();
    try { fs.copyFileSync(this.path, backupPath); } catch {}
    console.warn(`⚠️ Реестр повреждён, создан backup: ${backupPath}`);
    return { version: 3, extensions: [] };
  }
}
```

## Затрагиваемые файлы

- `src/registry.ts`
- Тесты: `src/registry.test.ts` — добавить тест на corrupted JSON

## Связанные задачи

- C1 (resetCache удаляет registry)
