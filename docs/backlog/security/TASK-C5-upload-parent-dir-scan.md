# 🔴 C5: buildCatalogEntry сканирует родительскую директорию

**Приоритет:** CRITICAL  
**Статус:** TODO  
**Файл:** `src/upload.ts:248-250`

## Проблема

`buildCatalogEntry()` использует `path.dirname(scan.path)` для определения директории расширения. Когда `scan.path` уже является директорией (многофайловое расширение), `path.dirname()` возвращает **родительскую** директорию.

## Пример

```
scan.path = "/cache/skills/my-skill/"    // директория
path.dirname(scan.path) = "/cache/skills/"  // родительская!
// Сканируются файлы ВСЕХ расширений в skills/
```

## Решение

```typescript
function buildCatalogEntry(scan: ScanResult): CatalogEntry {
  const extDir = fs.statSync(scan.path).isDirectory()
    ? scan.path
    : path.dirname(scan.path);
  // ... используем extDir для сканирования файлов
}
```

Или использовать `getExtensionDirRel()` из `multi-file.ts`, который уже обрабатывает оба случая.

## Затрагиваемые файлы

- `src/upload.ts`
- Тесты: `src/upload.test.ts`

## Связанные задачи

- M9 (upload metadata расходится с реальностью)
