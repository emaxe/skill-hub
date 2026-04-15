---
description: Use when the user needs a code style overview for Vue.js UI projects, asks about UI conventions, or wants a quick checklist for naming, components, imports, styles, and linting in Vue/Quasar projects.
alwaysApply: false
---

# Кодстайл UI-проектов — индекс

Кодстайл разбит на специализированные скиллы. Используй нужный по ситуации.

## Скиллы

| Скилл | Когда применять |
|-------|-----------------|
| **ui-naming-conventions** | Именование компонентов, файлов, сторов, констант, переменных |
| **ui-component-structure** | Порядок блоков в `<script setup>`, разделители, template (DIALOGS), роли компонентов |
| **ui-imports-aliases** | Алиасы импортов, порядок import-выражений |
| **ui-styles-css** | CSS-классы, BEM, `// $` в style, переменные из vars.scss |
| **ui-linting-formatting** | ESLint, Prettier, TypeScript, язык текстов (русский) |

## Краткий чеклист

- [ ] Имена компонентов: PascalCase, суффикс *Component / *Block / *Dialog / *Page
- [ ] Сторы: `use*Store` в компонентах; `use*Repo` — внутри `stores/repo`
- [ ] Импорты через алиасы (`@shared`, `@components`, `@stores` и т.д.)
- [ ] Константы: `_CONST` (приложение), `_sCONST` (Shared)
- [ ] В script setup: порядок блоков с разделителем `//----------------------`
- [ ] В template: блок диалогов отделён `<!--  DIALOGS  -->`
- [ ] Стили: BEM-именование, переменные из vars.scss, `// $` в начале `<style>`
- [ ] Линт: ESLint + Prettier; после правок — `read_lints`
- [ ] Тексты UI — на русском языке
