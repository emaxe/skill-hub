# 🔴 C2: removeSection() / removeMarkerContent() портят файлы

**Приоритет:** CRITICAL  
**Статус:** TODO  
**Файлы:** `src/adapters/copilot.ts:149-155`, `src/adapters/codex.ts:130-136`, `src/conventions.ts:408-413`

## Проблема

Когда начальный маркер `<!-- skill-hub: name -->` найден, а конечный `<!-- /skill-hub: name -->` отсутствует, функция `slice()` удаляет всё от начального маркера до **конца файла**.

## Воспроизведение

1. Установить расширение через Copilot/Codex adapter
2. Вручную отредактировать `copilot-instructions.md` / `AGENTS.md` — удалить или повредить конечный маркер
3. Запустить `skill-hub remove <extension>`
4. Всё содержимое файла после начального маркера удалено

## Код проблемы

```typescript
// copilot.ts / codex.ts
function removeSection(content: string, name: string): string {
  const startIdx = lines.indexOf(startMarker);
  const endIdx = lines.indexOf(endMarker);
  if (startIdx === -1) return content;
  // ⚠️ endIdx может быть -1, slice работает но удаляет до конца
  return [...lines.slice(0, startIdx), ...lines.slice(endIdx + 1)].join('\n');
}
```

## Решение

```typescript
function removeSection(content: string, name: string): string {
  const startIdx = lines.indexOf(startMarker);
  if (startIdx === -1) return content;
  
  const endIdx = lines.indexOf(endMarker);
  if (endIdx === -1) {
    console.warn(`⚠️ Конечный маркер для "${name}" не найден. Файл не изменён.`);
    return content; // НЕ модифицировать файл
  }
  
  return [...lines.slice(0, startIdx), ...lines.slice(endIdx + 1)].join('\n');
}
```

Аналогичный fix для `conventions.ts → removeMarkerContent()`.

## Затрагиваемые файлы

- `src/adapters/copilot.ts`
- `src/adapters/codex.ts`
- `src/conventions.ts`
- Тесты: `src/adapters/copilot.test.ts`, `src/adapters/codex.test.ts`, `src/conventions.test.ts`

## Связанные задачи

- H6 (маркеры без типа), H7 (scan всегда skill)
