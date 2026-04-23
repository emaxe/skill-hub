# /publish-cli — Публикация CLI пакета в npm

## Overview

Публикует `@emaxe/skill-hub` CLI пакет в npm с автоматическим поднятием версии.

## Process

1. Перейти в `cli/` директорию
2. Спросить пользователя тип версии (patch / minor / major). По умолчанию — patch
3. Поднять версию в `cli/package.json` с помощью `npm version <тип> --no-git-tag-version`
4. Скопировать актуальный README из корня репозитория: `cp ../README.md ./README.md` (npm берёт README из директории пакета, а не из корня репо — без этого шага на npmjs.com будет устаревший `cli/README.md`)
5. Выполнить `npm run build` — убедиться, что билд проходит
6. Выполнить `npm pack --dry-run` — показать содержимое пакета пользователю
7. Спросить подтверждение перед публикацией
8. Выполнить `npm publish --access public`
9. Показать итоговую версию и ссылку: `https://www.npmjs.com/package/@emaxe/skill-hub`

## Arguments

- `patch` / `minor` / `major` — тип версии (по умолчанию: patch)

## Rules

- ВСЕГДА поднимать версию перед публикацией — npm не позволяет перезаписывать существующие версии
- ВСЕГДА запускать билд перед публикацией
- ВСЕГДА показывать `npm pack --dry-run` и спрашивать подтверждение перед `npm publish`
- Рабочая директория для всех npm-команд: `cli/`
- Имя пакета: `@emaxe/skill-hub`
- Флаг `--access public` обязателен (scoped пакет)
