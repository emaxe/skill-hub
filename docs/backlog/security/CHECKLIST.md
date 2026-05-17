# ✅ Чеклист выполнения задач аудита

> **Создан:** 2026-05-05  
> **Полный отчёт:** [AUDIT-REPORT.md](./AUDIT-REPORT.md)

---

## 🔴 CRITICAL (8 задач)

- [x] **C1** — `resetCache()` удаляет реестр `installed.json` → [TASK-C1](./TASK-C1-resetcache-deletes-registry.md)
- [x] **C2** — `removeSection()` портит файлы без конечного маркера → [TASK-C2](./TASK-C2-remove-marker-corruption.md)
- [x] **C3** — `registry.ts` JSON.parse без try/catch → [TASK-C3](./TASK-C3-registry-json-parse-crash.md)
- [x] **C4** — `.github/` в `AGENT_GITIGNORE_ENTRIES` ломает CI/CD → [TASK-C4](./TASK-C4-github-in-gitignore.md)
- [x] **C5** — `buildCatalogEntry` сканирует родительскую директорию → [TASK-C5](./TASK-C5-upload-parent-dir-scan.md)
- [x] **C6** — upload cleanup оставляет кеш на feature branch → [TASK-C6](./TASK-C6-upload-cache-on-branch.md)
- [x] **C7** — Git auth URL → бесконечный цикл reclone → [TASK-C7](./TASK-C7-git-auth-url-loop.md)
- [x] **C8** — `JSON.stringify` для сравнения конфигов → [TASK-C8](./TASK-C8-json-stringify-config-compare.md)

## 🟠 HIGH (15 задач)

- [ ] **H1** — Поиск case-sensitive для name/tags → [TASK-H1](./TASK-H1-search-case-sensitive.md)
- [ ] **H2** — sync: расширения без version = "не в каталоге" → [TASK-H2](./TASK-H2-sync-no-version.md)
- [ ] **H3** — `path-filter.ts` нет маркера для Codex → [TASK-H3](./TASK-H3-codex-path-filter.md)
- [ ] **H4** — Claude commands всегда project scope → [TASK-H4](./TASK-H4-claude-cmd-always-project.md)
- [ ] **H5** — Copilot сканирует Claude-директории → [TASK-H5](./TASK-H5-copilot-scans-claude.md)
- [ ] **H6** — Copilot/Codex маркеры без типа → коллизии → [TASK-H6](./TASK-H6-marker-no-type.md)
- [ ] **H7** — Copilot/Codex scan всегда `type: skill` → [TASK-H7](./TASK-H7-scan-always-skill.md)
- [ ] **H8** — TUI: MoveScreen получает toScope вместо currentScope → [TASK-H8](./TASK-H8-move-wrong-direction.md)
- [ ] **H9** — TUI: DetailScreen удаляет из defaultScope → [TASK-H9](./TASK-H9-detail-wrong-scope-delete.md)
- [ ] **H10** — TUI: InstalledDetailScreen crash для parent entries → [TASK-H10](./TASK-H10-parent-crash.md)
- [ ] **H11** — TUI: retry обновления каталога зависает → [TASK-H11](./TASK-H11-retry-hangs.md)
- [ ] **H12** — `translateShortcuts` ломает аргументы агента → [TASK-H12](./TASK-H12-shortcut-rewrite-agent-args.md)
- [ ] **H13** — `update` crash в agents-conventions на global → [TASK-H13](./TASK-H13-update-conventions-crash.md)
- [ ] **H14** — shallow copy `DEFAULT_CONFIG` → мутации → [TASK-H14](./TASK-H14-shallow-copy-default.md)
- [ ] **H15** — `saveProjectConfig` теряет поля при невалидном JSON → [TASK-H15](./TASK-H15-save-config-loses-fields.md)

## 🟡 MEDIUM (20 задач)

- [ ] **M1** — `list` дедупликация по `name:scope` без `type`
- [ ] **M2** — `--project`/`--local` флаги мёртвые в install/remove
- [ ] **M3** — Невалидный `--agent` не валидируется
- [ ] **M4** — `remove` / MCP не вызывают `ensureCache()`
- [ ] **M5** — `disableConventions` не мигрирует Codex
- [ ] **M6** — Windows junction/copy не считается валидным линком
- [ ] **M7** — `.skillignore` паттерны читаются, но не применяются
- [ ] **M8** — `listExtensionFiles` неправильный mainFile для директорий
- [ ] **M9** — Upload agents/commands: metadata ≠ реальность
- [ ] **M10** — `generatePrUrl` недостаточное URL-кодирование
- [ ] **M11** — `detectPlatform` ложное определение GitLab
- [ ] **M12** — `installMcp` перезаписывает невалидный MCP JSON
- [ ] **M13** — Config read-modify-write без блокировки (race)
- [ ] **M14** — TUI: глобальные хоткеи поверх модальных окон
- [ ] **M15** — TUI: ScrollableBox некорректная модель скроллинга
- [ ] **M16** — TUI: Codex exposed но не поддерживается runtime
- [ ] **M17** — MCP install: зависимости без проверки platform
- [ ] **M18** — MCP search: недокументированный параметр `project`
- [ ] **M19** — `mcp-entry.ts` нет exit code при ошибке
- [ ] **M20** — `findProjectRoot` agentDir > `.skill-hub.json`

## 🔵 LOW (15 задач)

- [ ] **L1** — Ink anti-pattern `{stringVar && <Component>}`
- [ ] **L2** — `detect-agent.ts` приоритет ≠ документация
- [ ] **L3** — `platform.ts` export-time evaluation
- [ ] **L4** — `system-check.ts` неточное сообщение об ошибке
- [ ] **L5** — Два `parseFrontmatter()` с разной семантикой
- [ ] **L6** — CLAUDE.md устарела (версия, registry, detect-agent)
- [ ] **L7** — CLI help text не упоминает agents-conventions/codex
- [ ] **L8** — `update [name]` не поддерживает тип
- [ ] **L9** — `info` fallback не учитывает Codex/agents-conventions
- [ ] **L10** — Windows browser open не работает
- [ ] **L11** — `config set` без валидации значений
- [ ] **L12** — Unused props и hooks
- [ ] **L13** — TUI: таймеры auto-clear не отменяются
- [ ] **L14** — TUI: debounce без cleanup при unmount
- [ ] **L15** — TUI: пустые списки → отрицательные индексы

## 🧪 Тесты

- [ ] **T1** — Stale тесты install/remove (тестируют helper, не команды)
- [ ] **T2** — `conventions.test.ts` фиктивное покрытие
- [ ] **T3** — `upload.test.ts` ключевые flows не протестированы
- [ ] **T4** — Модули без тестов (sync, path-filter, frontmatter, 7+ commands, mcp)
- [ ] **T5** — TUI полностью не покрыт тестами
- [ ] **T6** — Adapter edge-cases не протестированы

---

## Прогресс

| Уровень | Всего | Готово | % |
|---------|-------|-------|---|
| 🔴 Critical | 8 | 8 | 100% |
| 🟠 High | 15 | 0 | 0% |
| 🟡 Medium | 20 | 0 | 0% |
| 🔵 Low | 15 | 0 | 0% |
| 🧪 Тесты | 6 | 0 | 0% |
| **Итого** | **64** | **8** | **13%** |
