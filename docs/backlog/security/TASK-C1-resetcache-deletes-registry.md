# 🔴 C1: resetCache() удаляет реестр установленных расширений

**Приоритет:** CRITICAL  
**Статус:** TODO  
**Файл:** `src/git.ts:60-82`

## Проблема

`resetCache()` / `fullCatalogReset()` удаляют **всю** директорию `~/.skill-hub/`, включая `installed.json` — единственное место хранения реестра установленных расширений.

## Воспроизведение

1. Установить несколько расширений через `skill-hub install`
2. Зайти в настройки и изменить `registryUrl`
3. Код вызывает `fullCatalogReset()` → `resetCache()` → `rm -rf ~/.skill-hub/`
4. `installed.json` удалён → все установки потеряны

## Ожидаемое поведение

Смена `registryUrl` должна очищать **только** кеш каталога (git-клон), но **не** реестр установленных расширений.

## Решение

**Вариант A (рекомендуемый):** Перенести `installed.json` за пределы cache-директории:
```
~/.skill-hub/installed.json  →  ~/.skill-hub-registry/installed.json
```

**Вариант B:** Сохранять `installed.json` перед удалением и восстанавливать после:
```typescript
function resetCache() {
  const registryBackup = readRegistryIfExists();
  fs.rmSync(cachePath, { recursive: true });
  fs.mkdirSync(cachePath, { recursive: true });
  if (registryBackup) restoreRegistry(registryBackup);
}
```

**Вариант C (минимальный):** Удалять только содержимое git-клона, не всю директорию:
```typescript
function resetCache() {
  // удалить только git-файлы, оставить installed.json
  const entries = fs.readdirSync(cachePath);
  for (const entry of entries) {
    if (entry !== 'installed.json') {
      fs.rmSync(path.join(cachePath, entry), { recursive: true });
    }
  }
}
```

## Затрагиваемые файлы

- `src/git.ts` — основное исправление
- `src/registry.ts` — возможный перенос пути registry
- Тесты: `src/git.test.ts`

## Связанные задачи

- C3 (registry crash на невалидном JSON)
