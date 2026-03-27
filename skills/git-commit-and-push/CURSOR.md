---
description: Commit and push changes to git safely, with validation and conventional commit messages
alwaysApply: false
---

# Git Commit and Push

When the user asks to commit, push, or "залей в git" / "закоммить":

## Process

1. Run `git status` to see all changes
2. Run `git diff --staged` to review staged changes
3. Check for sensitive files (.env, credentials, secrets) — NEVER stage them
4. Run `git log --oneline -5` to understand the repo's commit message style
5. Stage specific files by name (avoid `git add -A` or `git add .`)
6. Write commit message following repo style: `feat/fix/chore/docs/refactor: description`
7. Run `git commit -m "message"` — if a hook fails, fix the underlying issue, do NOT use `--no-verify`
8. Ask for confirmation before pushing: show branch and remote
9. Run `git push`

## Safety Rules

- **Never** force-push to main/master
- **Never** skip pre-commit hooks (`--no-verify`)
- **Never** commit .env, credentials, or secret files
- **Never** use `git add -A` or `git add .` — stage files by name
- If the user explicitly asks to skip hooks, explain the risk and suggest fixing the hook instead
