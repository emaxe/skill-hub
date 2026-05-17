# 🟠 H15: saveProjectConfig теряет поля при невалидном JSON

**Приоритет:** HIGH  
**Статус:** TODO  
**Файлы:** `src/config.ts:319-345, 510-524`

## Проблема

Если `.skill-hub.json` содержит невалидный JSON, catch-блок начинает с `{}` и записывает только обновляемые поля. Остальные поля (`extensions`, `registryUrl`, `project`, `gitignoreAgentDirs`) теряются.

## Решение

При невалидном JSON:
1. Создать backup повреждённого файла
2. Логировать warning
3. Начинать с дефолтных значений (не `{}`)

```typescript
let existing: Record<string, unknown>;
try {
  existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} catch {
  const backup = configPath + '.backup.' + Date.now();
  fs.copyFileSync(configPath, backup);
  console.warn(`⚠️ Конфиг повреждён, backup: ${backup}`);
  existing = { ...DEFAULT_PROJECT_CONFIG };
}
```

## Затрагиваемые файлы

- `src/config.ts`
- Тесты: `src/config.test.ts`
