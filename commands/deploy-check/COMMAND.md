---
name: deploy-check
description: "Use when the user invokes /deploy-check to validate project readiness before deployment. Runs tests, lint, build, and checks environment configuration."
tags: [ci-cd, safety, testing]
author: maksimklisin
version: "1.0.0"
scope: project
platforms: [claude-code]
dependencies: []
---

# /deploy-check

## Overview

Проверяет готовность проекта к деплою. Последовательно запускает тесты, линтер, сборку и валидирует конфигурацию окружения. Выдаёт структурированный отчёт о готовности.

## Process

1. **Определи стек проекта:**
   - Проверь наличие `package.json` (Node.js), `requirements.txt`/`pyproject.toml` (Python), `go.mod` (Go), `Cargo.toml` (Rust)
   - Определи менеджер пакетов: npm, yarn, pnpm, pip, poetry, cargo

2. **Запусти проверки** (пропускай шаг, если соответствующий скрипт/конфиг отсутствует):

   a. **Тесты:**
   ```bash
   npm test          # или yarn test, pnpm test, pytest, go test ./..., cargo test
   ```

   b. **Линтер:**
   ```bash
   npm run lint      # или эквивалент для стека
   ```

   c. **Сборка:**
   ```bash
   npm run build     # или эквивалент
   ```

   d. **Проверка типов** (если TypeScript):
   ```bash
   npx tsc --noEmit
   ```

3. **Проверь конфигурацию окружения:**
   - Найди `.env.example` или `.env.template`
   - Сравни с `.env.production` или `.env` — все ли переменные определены?
   - Проверь, нет ли секретов в коде: `grep -r "API_KEY\|SECRET\|PASSWORD" --include="*.{ts,js,py}" src/`

4. **Проверь git-состояние:**
   - Есть ли незакоммиченные изменения?
   - На какой ветке находимся?
   - Синхронизирована ли ветка с remote?

5. **Сформируй отчёт:**

```markdown
## Deploy Readiness Report

| Check        | Status | Details          |
|-------------|--------|------------------|
| Tests       | PASS   | 42 tests passed  |
| Lint        | PASS   | No issues        |
| Build       | PASS   | Built in 12s     |
| Types       | PASS   | No errors        |
| Env config  | WARN   | Missing DB_URL   |
| Git status  | PASS   | Clean, up to date|

**Verdict: Ready to deploy** / **Not ready — fix N issue(s)**
```

## Arguments

- `environment` — целевое окружение (по умолчанию: `production`). Влияет на проверку env-файлов.
- `--skip-tests` — пропустить запуск тестов
- `--skip-build` — пропустить сборку

## Examples

```
/deploy-check
/deploy-check staging
/deploy-check --skip-tests
/deploy-check production --skip-build
```

## Rules

- Никогда не выполняй реальный деплой — только проверки
- При ошибке покажи конкретную проблему и предложи команду для исправления
- Не падай при первой ошибке — проведи все проверки и покажи полную картину
- Если проект не имеет тестов/линтера — отметь как WARNING, а не ERROR
- Проверяй наличие секретов в коде перед деплоем
