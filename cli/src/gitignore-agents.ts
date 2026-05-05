/**
 * Утилиты для добавления проектных папок ИИ-агентов в .gitignore.
 *
 * Используется настройкой gitignoreAgentDirs из публичного проектного конфига.
 * При включении — проверяет, какие агентские элементы присутствуют в проекте,
 * но отсутствуют в .gitignore, и добавляет их.
 */
import fs from 'fs';
import path from 'path';

/** Записи для .gitignore — директории ИИ-агентов и файлы конфигурации */
export const AGENT_GITIGNORE_ENTRIES = [
  '.claude/',
  '.cursor/',
  // НЕ .github/ целиком — только Copilot-специфичные файлы,
  // чтобы не скрывать workflows/, CODEOWNERS, dependabot.yml и др.
  '.github/copilot-instructions.md',
  '.github/skills/',
  '.codex/',
  '.agents/',
  '.cursorrules',
];

/** Устаревшая запись, которую нужно мигрировать в конкретные Copilot-пути */
const LEGACY_GITHUB_ENTRY = '.github/';

const GITIGNORE_SECTION_HEADER = '# AI agent directories (skill-hub)';

/**
 * Проверяет, покрывает ли .gitignore указанную запись.
 * Учитывает: точное совпадение, запись без слеша покрывает вариант со слешем,
 * родительская директория покрывает дочерние записи (.github/ покрывает .github/skills/).
 */
function isEntryCovered(gitignoreLines: string[], entry: string): boolean {
  const trimmedEntry = entry.trim();
  const entryWithoutSlash = trimmedEntry.endsWith('/') ? trimmedEntry.slice(0, -1) : trimmedEntry;

  return gitignoreLines.some(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return false;
    // Точное совпадение
    if (trimmed === trimmedEntry) return true;
    // Запись без слеша покрывает и файл, и директорию
    const lineWithoutSlash = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
    if (lineWithoutSlash === entryWithoutSlash) return true;
    // Родительская директория покрывает дочерние записи
    // Например, .github/ покрывает .github/copilot-instructions.md и .github/skills/
    const parentDir = trimmed.endsWith('/') ? trimmed : trimmed + '/';
    if (trimmedEntry.startsWith(parentDir)) return true;
    return false;
  });
}

/**
 * Возвращает список агентских элементов, присутствующих в проекте на диске.
 */
export function getExistingAgentEntries(projectRoot: string): string[] {
  return AGENT_GITIGNORE_ENTRIES.filter(entry => {
    const entryPath = entry.endsWith('/')
      ? path.join(projectRoot, entry.slice(0, -1))
      : path.join(projectRoot, entry);
    try {
      const stat = fs.statSync(entryPath);
      if (entry.endsWith('/')) return stat.isDirectory();
      return stat.isFile() || stat.isDirectory();
    } catch {
      return false;
    }
  });
}

/**
 * Возвращает список агентских элементов, присутствующих в проекте,
 * но отсутствующих в .gitignore.
 * Автоматически мигрирует устаревшую запись `.github/` при обнаружении.
 */
export function getMissingGitignoreEntries(projectRoot: string): string[] {
  // Мигрируем устаревшую `.github/` → конкретные Copilot-пути
  migrateGithubGitignoreEntry(projectRoot);
  const existing = getExistingAgentEntries(projectRoot);
  if (existing.length === 0) return [];

  const gitignorePath = path.join(projectRoot, '.gitignore');
  let lines: string[] = [];
  try {
    if (fs.existsSync(gitignorePath)) {
      lines = fs.readFileSync(gitignorePath, 'utf-8').split('\n');
    }
  } catch {
    // .gitignore не существует — все записи отсутствуют
  }

  return existing.filter(entry => !isEntryCovered(lines, entry));
}

/**
 * Удаляет секцию skill-hub из .gitignore.
 * Убирает строку-заголовок `# AI agent directories (skill-hub)` и все следующие
 * за ней записи до ближайшей пустой строки или следующего `#`-комментария.
 * Если секции нет — ничего не делает.
 */
export function removeAgentDirsFromGitignore(projectRoot: string): void {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  let content = '';
  try {
    if (!fs.existsSync(gitignorePath)) return;
    content = fs.readFileSync(gitignorePath, 'utf-8');
  } catch {
    return;
  }

  if (!content.includes(GITIGNORE_SECTION_HEADER)) return;

  const lines = content.split('\n');
  const headerIdx = lines.findIndex(l => l.trim() === GITIGNORE_SECTION_HEADER);
  if (headerIdx === -1) return;

  // Находим конец секции (следующая пустая строка, следующий # комментарий или конец файла)
  let endIdx = headerIdx + 1;
  while (endIdx < lines.length && lines[endIdx].trim() !== '' && !lines[endIdx].trim().startsWith('#')) {
    endIdx++;
  }

  // Удаляем заголовок + записи секции
  lines.splice(headerIdx, endIdx - headerIdx);

  // Убираем лишнюю пустую строку перед секцией, если она осталась
  if (headerIdx > 0 && lines[headerIdx - 1].trim() === '' && (headerIdx >= lines.length || lines[headerIdx]?.trim() === '')) {
    lines.splice(headerIdx - 1, 1);
  }

  fs.writeFileSync(gitignorePath, lines.join('\n'));
}

/**
 * Мигрирует устаревшую запись `.github/` в секции skill-hub.
 * Заменяет `.github/` на конкретные Copilot-пути: `.github/copilot-instructions.md` и `.github/skills/`.
 * Если секции skill-hub нет или `.github/` отсутствует — ничего не делает.
 */
export function migrateGithubGitignoreEntry(projectRoot: string): void {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  let content = '';
  try {
    if (!fs.existsSync(gitignorePath)) return;
    content = fs.readFileSync(gitignorePath, 'utf-8');
  } catch {
    return;
  }

  if (!content.includes(GITIGNORE_SECTION_HEADER)) return;

  const lines = content.split('\n');
  const headerIdx = lines.findIndex(l => l.trim() === GITIGNORE_SECTION_HEADER);
  if (headerIdx === -1) return;

  // Ищем `.github/` в секции skill-hub
  let endIdx = headerIdx + 1;
  let githubLineIdx = -1;
  while (endIdx < lines.length && lines[endIdx].trim() !== '' && !lines[endIdx].trim().startsWith('#')) {
    if (lines[endIdx].trim() === LEGACY_GITHUB_ENTRY) {
      githubLineIdx = endIdx;
    }
    endIdx++;
  }

  if (githubLineIdx === -1) return;

  // Заменяем `.github/` на конкретные Copilot-пути
  const replacementEntries = AGENT_GITIGNORE_ENTRIES.filter(e => e.startsWith('.github/'));
  // Фильтруем те, которых ещё нет в файле (кроме тех, что покрываются .github/)
  const newEntries = replacementEntries.filter(e => {
    // Не добавлять если уже есть точное совпадение
    return !lines.some(l => l.trim() === e);
  });

  lines.splice(githubLineIdx, 1, ...newEntries);
  fs.writeFileSync(gitignorePath, lines.join('\n'));
}

/**
 * Добавляет указанные агентские записи в .gitignore с секцией-комментарием.
 * Создаёт .gitignore если он не существует.
 */
export function addAgentDirsToGitignore(projectRoot: string, entries: string[]): void {
  if (entries.length === 0) return;

  const gitignorePath = path.join(projectRoot, '.gitignore');
  let content = '';
  try {
    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, 'utf-8');
    }
  } catch {
    // ignore
  }

  // Проверяем, есть ли уже секция skill-hub
  const hasSection = content.includes(GITIGNORE_SECTION_HEADER);

  if (hasSection) {
    // Добавляем записи после существующей секции
    const lines = content.split('\n');
    const headerIdx = lines.findIndex(l => l.trim() === GITIGNORE_SECTION_HEADER);
    // Находим конец секции (следующая пустая строка или конец файла)
    let insertIdx = headerIdx + 1;
    while (insertIdx < lines.length && lines[insertIdx].trim() !== '' && !lines[insertIdx].trim().startsWith('#')) {
      insertIdx++;
    }
    // Фильтруем записи, которых ещё нет во всём файле
    const newEntries = entries.filter(e => !isEntryCovered(lines, e));
    if (newEntries.length === 0) return;
    lines.splice(insertIdx, 0, ...newEntries);
    fs.writeFileSync(gitignorePath, lines.join('\n'));
  } else {
    // Фильтруем записи, которых ещё нет
    const existingLines = content.split('\n');
    const newEntries = entries.filter(e => !isEntryCovered(existingLines, e));
    if (newEntries.length === 0) return;
    // Создаём новую секцию
    const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
    const section = `${separator}\n${GITIGNORE_SECTION_HEADER}\n${newEntries.join('\n')}\n`;
    fs.writeFileSync(gitignorePath, content + section);
  }
}
