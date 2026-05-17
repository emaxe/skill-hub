# 🟠 H4: Claude Code — команды всегда ставятся в project scope

**Приоритет:** HIGH  
**Статус:** TODO  
**Файл:** `src/adapters/claude-code.ts:39-40`

## Проблема

`getInstallPath()` для типа `command` всегда использует `this.projectDir`, игнорируя параметр `scope`.

## Решение

```typescript
getInstallPath(ext: Extension, scope: Scope): string {
  const baseDir = scope === 'global'
    ? path.join(os.homedir(), '.claude')
    : path.join(this.projectDir, '.claude');
    
  if (ext.type === 'command') {
    return path.join(baseDir, 'commands', ext.name + '.md');
  }
  return path.join(baseDir, 'skills', ext.name, 'SKILL.md');
}
```

## Затрагиваемые файлы

- `src/adapters/claude-code.ts`
- Тесты: `src/adapters/claude-code.test.ts`
