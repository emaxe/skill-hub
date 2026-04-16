# Чеклист реализации: Перенос базовых скиллов

## Подготовка
- [x] Прочитать spec.md и plan.md
- [x] Создать ветку `feature/relocate-base-skills` и переключиться на неё

## Задачи
- [x] Задача #1: Модифицировать `installBootstrapSkills()` — `init-agents`/`exit-agents` → `~/.skill-hub/bootstrap/`
- [x] Задача #2: Модифицировать `disableConventions()` — не удалять bootstrap-скиллы из глобальной директории
- [x] Задача #3: Обновить промпт в `useConventionsInit.ts` — абсолютный путь
- [x] Задача #4: Обновить промпт в `useConventionsExit.ts` — абсолютный путь
- [x] Задача #5: Cleanup `sync.ts` — убрать `init-agents`/`exit-agents` из `BASE_SKILLS`
- [x] Задача #6: Обновить `CLAUDE.md`
- [x] Задача #7: Тесты и сборка — финальная валидация

## Финализация
- [x] Все проверки пройдены
- [ ] Код закоммичен
- [ ] Статус в README.md обновлён на `Done`
