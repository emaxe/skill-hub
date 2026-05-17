# 🔴 C6: upload cleanup может оставить кеш на feature branch

**Приоритет:** CRITICAL  
**Статус:** TODO  
**Файл:** `src/upload.ts:380-386`

## Проблема

В блоке `finally` функции `uploadExtensions()` вызов `git.checkout('main')` обёрнут в try/catch, который **проглатывает** ошибку. Если checkout не удался — кеш-репозиторий остаётся на feature branch.

## Последствие

Все последующие операции (`git pull`, `loadCatalog()`, `ensureCache()`) работают с feature branch вместо main:
- Каталог содержит незамерженные изменения
- `git pull` может получить конфликты
- `updateCache()` может зафейлиться

## Решение

```typescript
finally {
  try {
    await git.checkout('main');
  } catch (checkoutErr) {
    console.error('⚠️ Не удалось вернуться на main, сброс кеша...');
    try {
      await git.raw(['reset', '--hard']);
      await git.checkout('main');
    } catch {
      // Крайний случай — полный сброс кеша
      resetCache();
      await ensureCache(registryUrl);
    }
  }
}
```

## Затрагиваемые файлы

- `src/upload.ts`
- Тесты: `src/upload.test.ts`
