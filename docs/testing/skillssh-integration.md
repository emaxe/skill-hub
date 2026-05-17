# Чеклист тестирования: интеграция skills.sh

## 1. Быстрая проверка

```bash
cd cli && npm test --silent
# Ожидается: 285 passed, 1 skipped
```

## 2. Ручное тестирование (требуется сеть)

### 2.1 Сборка

```bash
cd cli && npm run build
# Ожидается: tsc без ошибок
```

### 2.2 Поиск

```bash
node dist/index.js search --source skillssh react --agent claude-code --limit 5
```

**Проверка:**
- [ ] Вывод начинается с "Найдено N скиллов на skills.sh:"
- [ ] Каждая строка: `[skill] <id>  <source>  <installs> installs`
- [ ] Есть описание под каждым скиллом
- [ ] `--limit` и `--offset` работают

### 2.3 Установка — полный ref (owner/repo@slug)

```bash
# Требуется пустой тестовый проект
mkdir -p /tmp/skillssh-test && cd /tmp/skillssh-test && git init

node /path/to/skillHub/cli/dist/index.js install skillssh:vercel-labs/skills@react-best-practices --agent claude-code --project
```

**Проверка:**
- [ ] В консоли: "Установлен skill:react-best-practices (claude-code, project) [skills.sh]"
- [ ] Файлы появились: `.claude/skills/react-best-practices/SKILL.md`
- [ ] Реестр: `cat ~/.skill-hub/installed.json | jq '.installations[] | select(.name == "react-best-practices")'`
  - [ ] Поле `"source": "skillssh:vercel-labs/skills@react-best-practices"` присутствует
  - [ ] Поле `"version"` не пустое (это hash)
- [ ] Проектный конфиг: `cat .skill-hub.json | jq '.extensions[] | select(.name == "react-best-practices")'`
  - [ ] Поле `"source"` присутствует

### 2.4 Установка — по slug (без owner/repo)

```bash
cd /tmp/skillssh-test
node /path/to/skillHub/cli/dist/index.js install skillssh:react-best-practices --agent claude-code --project
```

**Проверка:**
- [ ] Если slug найден — устанавливается (может совпасть с 2.3)
- [ ] Если не найден — ошибка "Скилл 'react-best-practices' не найден на skills.sh"

### 2.5 Установка — по owner/repo (интерактивный выбор)

```bash
cd /tmp/skillssh-test
node /path/to/skillHub/cli/dist/index.js install skillssh:vercel-labs/skills --agent claude-code --project
```

**Проверка:**
- [ ] Если в репо один скилл — устанавливается автоматически
- [ ] Если несколько — выводится список с инструкцией указать `@slug`

### 2.6 Каталог поиск (regression)

```bash
node dist/index.js search git --agent claude-code --limit 3
```

**Проверка:**
- [ ] Результаты из catalog.json, не из skills.sh
- [ ] Нет [skills.sh] метки в выводе

### 2.7 Установка из каталога (regression)

```bash
node dist/index.js install git-commit-and-push --agent claude-code --project
```

**Проверка:**
- [ ] Устанавливается без ошибок
- [ ] В реестре НЕТ поля `source` (или `"source": undefined`)

### 2.8 Обновление skills.sh расширения

```bash
cd /tmp/skillssh-test
node /path/to/skillHub/cli/dist/index.js update react-best-practices --agent claude-code
```

**Проверка:**
- [ ] Если hash не изменился — "Обновлено 0 расширений"
- [ ] Если hash изменился — переустановка, version обновляется в реестре

### 2.9 Обновление с восстановлением missing

```bash
cd /tmp/skillssh-test
rm -rf .claude/skills/react-best-practices
node /path/to/skillHub/cli/dist/index.js update --agent claude-code
```

**Проверка:**
- [ ] Missing skills.sh расширение восстанавливается из API
- [ ] В консоли: "Восстановлено N расширений из проектного конфига"

### 2.10 Удаление

```bash
cd /tmp/skillssh-test
node /path/to/skillHub/cli/dist/index.js remove react-best-practices --agent claude-code --project
```

**Проверка:**
- [ ] Файлы удалены: `.claude/skills/react-best-practices/` не существует
- [ ] Запись удалена из `~/.skill-hub/installed.json`
- [ ] Запись удалена из `.skill-hub.json`

## 3. MCP тестирование

### 3.1 MCP search

Через Claude Code или другой MCP-клиент:

```json
{
  "name": "search_extensions",
  "arguments": {
    "query": "react",
    "source": "skillssh",
    "limit": 5
  }
}
```

**Проверка:**
- [ ] Результаты приходят в JSON
- [ ] Каждый результат содержит `id`, `source`, `installs`, `description`

### 3.2 MCP install

```json
{
  "name": "install_extension",
  "arguments": {
    "name": "skillssh:vercel-labs/skills@react-best-practices",
    "agent": "claude-code",
    "scope": "project"
  }
}
```

**Проверка:**
- [ ] Ответ: "Установлен skill:react-best-practices v<hash> (claude-code, project) [skills.sh]"
- [ ] Файлы на диске
- [ ] Реестр обновлён

### 3.3 MCP install без @slug (ошибка)

```json
{
  "name": "install_extension",
  "arguments": {
    "name": "skillssh:vercel-labs/skills",
    "agent": "claude-code"
  }
}
```

**Проверка:**
- [ ] Ошибка: "Для MCP укажите полный skillssh:owner/repo@slug"

## 4. Edge cases

### 4.1 Невалидный skillssh ref

```bash
node dist/index.js install skillssh:invalid-format --agent claude-code --project
```

**Проверка:**
- [ ] Сообщение об ошибке (не падает с необработанным exception)

### 4.2 Несуществующий скилл

```bash
node dist/index.js install skillssh:nonexistent-owner/nonexistent-repo@fake-skill --agent claude-code --project
```

**Проверка:**
- [ ] Сообщение об ошибке от skills.sh API

### 4.3 API недоступен (network offline)

```bash
# Отключить сеть или заблокировать skills.sh
node dist/index.js search --source skillssh react
```

**Проверка:**
- [ ] Понятное сообщение об ошибке (не raw stack trace)

### 4.4 Установка с `--global`

```bash
node dist/index.js install skillssh:vercel-labs/skills@react-best-practices --agent claude-code --global
```

**Проверка:**
- [ ] Файлы в `~/.claude/skills/react-best-practices/SKILL.md`
- [ ] Реестр: `cat ~/.skill-hub/installed.json | jq '.installations[] | select(.name == "react-best-practices") | .scope'` → `"global"`

### 4.5 Удаление временной директории

```bash
# После любой установки из skills.sh
ls ~/.skill-hub/tmp/
```

**Проверка:**
- [ ] Нет подвисших `skillssh-*` директорий (cleanup в `finally`/`catch`)

## 5. Cleanup после тестирования

```bash
# Удалить тестовый проект
rm -rf /tmp/skillssh-test

# Очистить установленные skills.sh скиллы из реестра
cat ~/.skill-hub/installed.json | jq 'del(.installations[] | select(.source | contains("skillssh")))' > ~/.skill-hub/installed.json.tmp
mv ~/.skill-hub/installed.json.tmp ~/.skill-hub/installed.json

# Удалить файлы с диска
rm -rf ~/.claude/skills/react-best-practices
rm -rf .claude/skills/react-best-practices
```