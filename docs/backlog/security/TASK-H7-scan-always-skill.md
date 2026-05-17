# 🟠 H7: Copilot/Codex scan всегда возвращает type: 'skill'

**Приоритет:** HIGH  
**Статус:** TODO  
**Файлы:** `src/adapters/copilot.ts:115-125`, `src/adapters/codex.ts:113-123`

## Проблема

`parseMarkers()` всегда возвращает `type: 'skill'` для найденных расширений, независимо от фактического типа.

## Решение

После реализации H6 (маркеры с типом) — извлекать тип из маркера. Для legacy-маркеров без типа — fallback на registry lookup:

```typescript
function parseMarkers(content: string, registry: Registry): ScanResult[] {
  // ... parse markers
  const type = markerType || registry.getType(name) || 'skill';
  return { name, type, ... };
}
```

## Затрагиваемые файлы

- `src/adapters/copilot.ts`
- `src/adapters/codex.ts`
- Тесты: `src/adapters/copilot.test.ts`, `src/adapters/codex.test.ts`

## Зависимости

- Блокируется H6 (формат маркера с типом)
