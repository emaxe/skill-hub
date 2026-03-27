#!/usr/bin/env bash
# dev-link.sh — собирает CLI и линкует глобально для локального тестирования
set -euo pipefail

# cd to repo root (parent of scripts/)
cd "$(dirname "$0")/.."

CLI_DIR="cli"

if [[ "${1:-}" == "unlink" ]]; then
  echo "Удаляю глобальный линк @emaxe/skill-hub..."
  cd "$CLI_DIR"
  npm unlink -g @emaxe/skill-hub 2>/dev/null || true
  echo "Готово. Линк удалён."
  exit 0
fi

echo "Устанавливаю зависимости..."
cd "$CLI_DIR"
npm install

echo "Собираю CLI..."
npm run build

echo "Создаю глобальный линк..."
npm link

echo ""
echo "Готово! Команды skill-hub и skill-hub-mcp доступны глобально."
echo "При изменениях: npm run build в cli/ и тестируй сразу."
echo "Для удаления: bash scripts/dev-link.sh unlink"
