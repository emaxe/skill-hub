# Чеклист реализации: Поддержка Windows

## Подготовка
- [x] Прочитать spec.md и plan.md
- [x] Создать ветку `feature/windows-support` и переключиться на неё

## Задачи
- [x] Задача #1: Создать хелпер `platform.ts`
- [x] Задача #2: Windows-ветка в agent-launcher (exec + .bat script)
- [x] Задача #3: Symlinks в conventions (type 'dir' + junction fallback + copy fallback + нормализация)
- [x] Задача #4: Copilot Adapter — Windows путь VS Code
- [x] Задача #5: Claude Code Adapter — case-insensitive сравнение путей
- [x] Задача #6: App.tsx — кроссплатформенный разбор путей
- [x] Задача #7: Кроссплатформенный kill/spawn в хуках conventions
- [x] Задача #8: Исправить тесты move.test.ts (HOME → os.homedir)
- [ ] Задача #9: Unit-тесты для platform.ts
- [ ] Задача #10: Unit-тесты для Windows-веток всех модулей

## Финализация
- [ ] Все проверки пройдены
- [ ] Код закоммичен
- [ ] Статус в README.md обновлён на `Done`
