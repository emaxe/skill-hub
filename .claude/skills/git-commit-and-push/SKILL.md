---
name: git-commit-and-push
description: Use when the user asks to commit changes, push to git, "залей в git", "закоммить", or save work to the repository. Covers staging, commit message formatting, and push.
tags: [git, workflow, safety]
author: maksimklisin
version: "1.0.0"
scope: global
platforms: [claude-code]
dependencies: []
language: any
---

# Git Commit and Push

## Overview

Стабильный процесс заливки изменений: проверить статус → изучить diff → составить сообщение в стиле репозитория → закоммитить → запушить.

## Process

### 1. Проверить состояние

```bash
git status
git diff --stat
git log --oneline -5
```

Запускать параллельно — все три команды независимы.

### 2. Составить commit message

- Смотри последние коммиты (`git log`) — копируй стиль (feat/fix/chore/docs)
- Формат: `<тип>: <краткое описание на языке репозитория>`
- Если изменений много — добавляй bullet-list в тело

### 3. Стейджить и коммитить

Стейджить конкретные файлы (не `git add -A` — рискованно):

```bash
git add path/to/file1 path/to/file2
git commit -m "$(cat <<'EOF'
feat: краткое описание

- деталь 1
- деталь 2

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

Всегда добавлять `Co-Authored-By` строку.

### 4. Пушить

```bash
git push origin <branch>
```

Определить ветку заранее из `git status` (строка `On branch ...`).

## Правила безопасности

| Ситуация | Действие |
|----------|----------|
| Файлы `.env`, credentials | Не стейджить, предупредить пользователя |
| `git push --force` на main/master | Спросить подтверждение, предупредить об опасности |
| Нет явной просьбы пушить | Только коммит, без push |
| Pre-commit hook упал | Починить проблему, создать НОВЫЙ коммит (не --amend) |

## Частые ошибки

- **`git add .` или `git add -A`** — может захватить лишнее; предпочитай явные пути
- **`--no-verify`** — никогда без явного разрешения пользователя
- **`--amend` на опубликованных коммитах** — только если пользователь явно попросил
- **Пуш без коммита** — проверить `git status` после коммита перед push
