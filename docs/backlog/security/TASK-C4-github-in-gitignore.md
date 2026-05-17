# 🔴 C4: .github/ в AGENT_GITIGNORE_ENTRIES ломает CI/CD

**Приоритет:** CRITICAL  
**Статус:** DONE  
**Файл:** `src/gitignore-agents.ts:12-19`

## Проблема

Массив `AGENT_GITIGNORE_ENTRIES` содержит `.github/` как директорию AI-агента. При `gitignoreAgentDirs: true` вся директория `.github/` добавляется в `.gitignore`.

## Последствие

`.github/` содержит критические файлы проекта:
- `workflows/` — GitHub Actions CI/CD
- `CODEOWNERS`
- `dependabot.yml`
- Issue/PR templates
- `copilot-instructions.md` (единственный Copilot-файл)

Добавление `.github/` в `.gitignore` скрывает **все** эти файлы от Git.

## Решение

Заменить `.github/` на конкретные пути Copilot-файлов:

```typescript
export const AGENT_GITIGNORE_ENTRIES = [
  '.claude/',
  '.cursor/',
  '.codex/',
  '.agents/',
  // НЕ .github/ целиком — только Copilot-специфичные файлы
  '.github/copilot-instructions.md',
  '.github/skills/',
];
```

Или вообще убрать `.github/` файлы из авто-gitignore, т.к. `copilot-instructions.md` обычно **должен** быть в Git (общие инструкции для команды).

## Затрагиваемые файлы

- `src/gitignore-agents.ts`
- Тесты: `src/gitignore-agents.test.ts`

## Миграция

При обновлении: если `.github/` уже в `.gitignore` с маркером skill-hub — предложить удалить и заменить на конкретные пути.
