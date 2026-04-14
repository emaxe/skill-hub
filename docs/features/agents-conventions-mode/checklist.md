# Чеклист реализации: AGENTS-CONVENTIONS Mode

## Подготовка
- [x] Прочитать spec.md и plan.md
- [x] Создать ветку `feature/agents-conventions` и переключиться на неё

## Задачи
- [x] Задача #1: Расширить AgentName — добавить 'agents-conventions'
- [x] Задача #2: Создать AgentsConventionsAdapter
- [x] Задача #3: Зарегистрировать адаптер в getAdapter
- [x] Задача #4: Создать модуль conventions.ts (enable/disable/status логика)
- [x] Задача #5: Создать CLI-команду agents-conventions
- [x] Задача #6: Зарегистрировать команду в index.ts
- [x] Задача #7: Проверка --global в install
- [x] Задача #8: Проверка --global в remove
- [x] Задача #9: Проверка --to-global в move
- [x] Задача #10: Адаптировать search (catalog.ts: platformKey + filterByAgent)
- [x] Задача #11: Адаптировать list (path-filter.ts: добавлен /.agents/ маркер)
- [x] Задача #12: TUI Settings — agents-conventions в AGENTS + подсказка + scope lock
- [x] Задача #13: TUI InstalledScreen — метка "all agents" для agents-conventions
- [x] Задача #14: TUI CatalogScreen — catalogAgent = claude-code при agents-conventions
- [x] Задача #15: MCP — поддержка agents-conventions во всех инструментах
- [x] Задача #16: Интеграционная проверка — npm run build ✓, баги path-filter и update.ts исправлены

## Финализация
- [x] Все проверки пройдены
- [ ] Код закоммичен
- [ ] Статус в README.md обновлён на `Done`
