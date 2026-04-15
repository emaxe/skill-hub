---
description: Use when adding a new page with a base domain component to a Vue/Quasar UI app (Admin.UI, Company.UI, Widget.UI). Triggers: 'добавь страницу', 'создай страницу', 'новая страница с компонентом', 'add page'.
alwaysApply: false
---

# Добавление новой страницы с базовым компонентом

Пошаговый сценарий: одна страница + одна папка домена в `components` + один базовый компонент (заглушка).

## Нейминг от формулировки

Из фразы пользователя выбери **домен** (существительное на английском) и примени схему:

| Что | Правило | Пример: «страница товаров» |
|-----|--------|-----------------------------|
| Страница | `pages/{Domain}Page.vue` | `ProductPage.vue` или `ProductsPage.vue` |
| Папка компонентов | `components/{domain}/` (camelCase) | `components/products/` |
| Базовый компонент | `{domain}Component.vue` | `productsComponent.vue` |

- **Domain** — в PascalCase (Product, Products, Reports).
- **domain** — тот же корень в camelCase (product, products, reports).
- Имя маршрута в constants: camelCase, например `products` или `product`.

Если пользователь явно назвал страницу (например «ProductPage») — используй это имя; иначе выбери по смыслу (ProductsPage для списка, ProductPage для одной сущности).

## Чеклист шагов

1. **Константы**  
   В `app/src/constants/route.ts` добавить имя маршрута, например:  
   `products: 'products'` (или нужное по домену).

2. **Роутер**  
   В `app/src/router/routes.ts` добавить маршрут:
   - `path: '/products'` (или `/product`),
   - `component: () => import('@layouts/MainLayout.vue')`,
   - `children: [{ path: '', name: _CONST.route.products, component: () => import('@pages/ProductsPage.vue') }]`,
   - при необходимости `meta.permissions` и `beforeEnter: [guardAuth, guardPermission]`.

3. **Страница**  
   Создать `app/src/pages/ProductsPage.vue`:
   - обёртка `<x-page>`,
   - внутри один тег доменного компонента, например `<products-component />`,
   - в script: `usePageStore()`, `pageStore.init({ title: 'Товары' })`, импорт страницы и компонента через алиасы (`@pages`, `@components/...`).

4. **Папка и базовый компонент**  
   - Создать папку `app/src/components/products/`.
   - Создать `productsComponent.vue` — минимальная заглушка:
     - один блок `<x-page-block title="…">` с комментарием «заполним позже» или пустой разметкой,
     - в script — только импорт `XPageBlock` из `@rt/shared/components/page/xPageBlock.vue`.

## Шаблон страницы

```vue
<template>
  <x-page class="flex flex-center">
    <products-component/>
  </x-page>
</template>

<script setup>
import { usePageStore } from '@rt/shared/stores/mainStore'
import XPage from '@rt/shared/components/page/xPage'
import ProductsComponent from '@components/products/productsComponent.vue'

const pageStore = usePageStore()
pageStore.init({ title: 'Товары' })
</script>
```

## Шаблон базового компонента-заглушки

```vue
<template>
  <x-page-block title="Товары">
    <!-- Заполним позже -->
  </x-page-block>
</template>

<script setup>
import XPageBlock from '@rt/shared/components/page/xPageBlock.vue'
</script>
```

## Важно

- Импорты только через алиасы (`@pages`, `@components`, `@rt/shared`, `@constants` и т.д.).
- Страница не должна содержать бизнес-логику — только layout, один доменный компонент и `pageStore.init`.
- Детали кодстайла и роутинга — в скилле **ui-code-style**.
