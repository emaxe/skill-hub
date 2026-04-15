---
description: Use when adding permission checks in Vue UI apps — route guards, button visibility, form read-only mode. Covers useAppPermissions, guardPermission, _CONST.permissions, and checkRoute patterns.
alwaysApply: false
---

# Работа с правами (permissions) в UI

Проверка прав в проекте централизована в Pinia-сторе `useAppPermissions` (Shared.UI). Права приходят с бэкенда и сохраняются в `useConfigStore().permissions` (устанавливаются при логине/загрузке профиля через `userRole` store).

## Источник и инициализация

- **Стор:** `Shared.UI/stores/commonPermissions.js` — экспортирует `useAppPermissions`.
- **Импорт в приложении:** `import { useAppPermissions } from '@rt/shared/stores/commonPermissions'` или `import { useAppPermissions } from '@shared/stores/commonPermissions'` (в зависимости от алиасов в проекте).
- **Данные прав:** хранятся в `useConfigStore().permissions` (массив строк). Заполняются при загрузке профиля через стор `userRole` (например, `getMyPermissions` → `configStore.setPermissions(...)`).

## API useAppPermissions

| Метод | Назначение |
|-------|------------|
| `check(permission)` | Проверка одного права. Учитывает суперпользователя и `includedPermissions`: если у пользователя есть право из списка «включённых» (например, View), то считается, что есть и связанное (например, Manage). |
| `checkRoute(to)` | Проверка доступа к маршруту: все `to.meta.permissions` должны проходить `check`, плюс при `meta.accessSuperUserOnly` проверяется суперпользователь. |
| `onLoad()` | Возвращает Promise, который резолвится, когда права загружены (или пользователь — суперпользователь). Вызывать в guard перед проверкой маршрута. |

## Константы прав

- В каждом приложении: `app/src/constants/permissions.ts` — объект `permissions` (например, `Companies.Manage`, `Companies.View`) и `includedPermissions` (какие права «включают» другие).
- В коде использовать через `_CONST`: `_CONST.permissions.Companies.Manage`, `_CONST.permissions.Settings.View` и т.д.

## Общие правила и подходы

### 1. Защита маршрутов

- В `meta` маршрута задавать `permissions: [_CONST.permissions.*.View]` (или нужный набор).
- В `beforeEnter` маршрута подключать `guardAuth` и `guardPermission`.
- В guard: при наличии `to.meta.permissions` вызывать `await appPermissions.onLoad()`, затем `appPermissions.checkRoute(to)`; при отказе — редирект (например, на `/invoices` или главную).

### 2. Скрытие пунктов меню (sidebar)

- В layout для каждого пункта с маршрутом использовать `appPermissions.checkRoute({ name: link.route })`.
- Рендерить пункт только если `!link.route || appPermissions.checkRoute({ name: link.route })`.

### 3. Проверка прав в компонентах

- Вызывать `const appPermissions = useAppPermissions()` в `<script setup>` (в блоке composable после импортов).
- Для **одного права** (кнопка, режим редактирования): `computed(() => appPermissions.check(_CONST.permissions.Companies.Manage))`. Использовать в `v-if`, `:disable`, `isShow` и т.д.
- Для **доступа по маршруту** (ссылка, вкладка по роуту): `computed(() => !appPermissions.checkRoute(props.to))` → отключать элемент при `true`.

### 4. Кнопки и ссылки

- **btnsGenerator:** для кнопок с `to` уже вызывается `appPermissions.checkRoute(btn.to)` внутри `getDisable` — дополнительная проверка в компоненте не нужна.
- **xBtnLink:** при наличии `to` ссылка автоматически получает `_disable` через `appPermissions.checkRoute(props.to)`.
- Кнопки без `to` (действия по праву Manage/Edit): передавать `isShow: () => _hasManagePermission.value` или `:disable="!appPermissions.check(_CONST.permissions.*.Manage)"`.

### 5. Формы и настройки

- Режим «только чтение» формы: вычислять флаг через `appPermissions.check(permissionManage)`. Permission может приходить через `inject('settingsConfig')` (например, `settingsConfig.permissionManage`) или напрямую `_CONST.permissions.Settings.BaseSettingsManage`.
- Использовать один и тот же permission для блокировки кнопки «Сохранить» и полей.

### 6. Единый стиль

- Именование: `_hasManagePermission`, `_disableManage`, `_canEdit` — computed, возвращающие результат `appPermissions.check(...)`.
- Права для страницы — уровень View; для действий (создать, изменить, удалить) — уровень Manage (или специализированные, например `Applicants.Create`).

## Примеры

**Страница/список — кнопка «Добавить» только при Manage:**
```javascript
const _hasManagePermission = computed(() => appPermissions.check(_CONST.permissions.Companies.Manage))
// ...
pageStore.setBtns(btns.filter(c => !c.isShow || c.isShow())) // isShow: () => !!_hasManagePermission.value
```

**Таблица — действие только при Manage:**
```javascript
:disable="!appPermissions.check(_CONST.permissions.Users.Manage)"
```

**Guard (router):**
```javascript
if (to.meta?.permissions) {
  await appPermissions.onLoad()
  if (!appPermissions.checkRoute(to)) return { path: '/invoices' }
}
```

## Чеклист

- [ ] Маршруты с ограничением по правам имеют `meta.permissions` и `beforeEnter: [guardAuth, guardPermission]`.
- [ ] В компонентах используется `_CONST.permissions.*`, а не строки напрямую.
- [ ] Для скрытия/отключения по одному праву — `appPermissions.check(permission)`; по маршруту — `appPermissions.checkRoute(to)`.
- [ ] В guard перед `checkRoute` вызывается `await appPermissions.onLoad()`.
