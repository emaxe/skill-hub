# 🟠 H12: translateShortcuts ломает аргументы агента

**Приоритет:** HIGH  
**Статус:** TODO  
**Файл:** `src/index.ts:10-30, 38-53`

## Проблема

`translateShortcuts()` выполняется **до** обнаружения `-a`/`-A` флагов. Аргументы предназначенные для агента обрабатываются как CLI shortcuts.

## Пример

```bash
skill-hub -a claude -u my-project
# -u → translateShortcuts → "update"
# Агент получает: ["update", "my-project"] вместо ["-u", "my-project"]
```

## Решение

Сначала находить позицию `-a`/`-A`, затем применять shortcuts только к аргументам **до** этой позиции:

```typescript
const launcherIdx = argv.findIndex(a => a === '-a' || a === '-A');
const cliArgs = launcherIdx === -1 ? argv : argv.slice(0, launcherIdx);
const agentArgs = launcherIdx === -1 ? [] : argv.slice(launcherIdx);
const translatedCli = translateShortcuts(cliArgs);
const finalArgs = [...translatedCli, ...agentArgs];
```

## Затрагиваемые файлы

- `src/index.ts`
