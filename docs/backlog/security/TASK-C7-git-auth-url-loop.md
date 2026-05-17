# 🔴 C7: Git auth URL вызывает бесконечный цикл reclone

**Приоритет:** CRITICAL  
**Статус:** TODO  
**Файл:** `src/git.ts:112-126`

## Проблема

При клонировании с credentials origin URL содержит `username:token@host`. При следующем запуске:
1. `ensureCacheWithCredentials()` получает "чистый" URL из конфига
2. Сравнивает с origin в кеше (содержит credentials)
3. URL не совпадают → система решает что origin изменился
4. Вызывает `resetCache()` → удаляет кеш
5. Заново клонирует с credentials
6. Goto 1

## Решение

Нормализовать URL перед сравнением — удалять userinfo:

```typescript
function normalizeGitUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    // SSH URL или невалидный — сравнивать as-is
    return url;
  }
}

// В ensureCacheWithCredentials:
const currentOrigin = await git.remote(['get-url', 'origin']);
if (normalizeGitUrl(currentOrigin) !== normalizeGitUrl(registryUrl)) {
  // Действительно другой origin — нужен reset
}
```

## Затрагиваемые файлы

- `src/git.ts`
- Тесты: `src/git.test.ts`

## Связанные задачи

- C1 (resetCache удаляет registry — усугубляет последствия цикла)
