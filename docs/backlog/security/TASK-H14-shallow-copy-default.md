# 🟠 H14: config.ts — shallow copy DEFAULT_CONFIG

**Приоритет:** HIGH  
**Статус:** TODO  
**Файл:** `src/config.ts:156-165`

## Проблема

`{ ...DEFAULT_CONFIG }` создаёт shallow copy. Вложенный объект `aiAgents` (содержит `agents` map) разделяется между всеми вызовами.

## Последствие

Мутация в одном месте загрязняет дефолты для всего процесса (CLI, TUI, MCP).

## Решение

```typescript
function getDefaultConfig(): SkillHubConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  // или: return structuredClone(DEFAULT_CONFIG);
}
```

## Затрагиваемые файлы

- `src/config.ts`
- Тесты: `src/config.test.ts`
