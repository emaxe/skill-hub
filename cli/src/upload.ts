/**
 * Бизнес-логика загрузки расширений в каталог.
 *
 * Включает: проверку доступа, валидацию расширений, формирование записей каталога,
 * git-операции (branch, commit, push), генерацию URL для PR/MR.
 */

import fs from 'fs';
import path from 'path';
import simpleGit from 'simple-git';
import { AgentName, Extension, ExtensionType, Catalog, loadCatalog, platformKey } from './catalog';
import { ScanResult } from './adapters/types';
import { getAdapter } from './adapters/get-adapter';
import { getCachePath, getRegistryUrl, resetCache, ensureCache } from './git';
import { listExtensionFiles, getExtensionDirSize, findBinaryFiles, MAX_EXTENSION_DIR_SIZE, copyExtensionDir } from './multi-file';

// ─── Типы ────────────────────────────────────────────────────

/** Результат проверки write-доступа к репозиторию каталога */
export interface AccessCheckResult {
  hasAccess: boolean;
  error?: string;
}

/** Результат валидации одного расширения */
export interface ValidationResult {
  extension: ScanResult;
  valid: boolean;
  errors: string[];
  frontmatter?: Frontmatter;
}

/** Фронтматтер расширения (обязательные поля) */
export interface Frontmatter {
  name: string;
  description: string;
  version: string;
  author: string;
  tags?: string[];
}

/** Параметры загрузки */
export interface UploadOptions {
  extensions: ScanResult[];
  frontmatters: Map<string, Frontmatter>;
  catalog: Catalog;
  agent: AgentName;
  branchName: string;
  commitMessage: string;
  cachePath?: string;
}

/** Результат загрузки */
export interface UploadResult {
  success: boolean;
  branchName: string;
  error?: string;
}

// ─── 1. Проверка write-доступа ───────────────────────────────

/**
 * Проверяет write-доступ к репозиторию каталога через `git push --dry-run`.
 * Поддерживает SSH и HTTPS URL — использует системные credentials.
 */
export async function checkCatalogWriteAccess(registryUrl?: string): Promise<AccessCheckResult> {
  const url = registryUrl ?? getRegistryUrl();
  const cachePath = getCachePath();

  if (!fs.existsSync(path.join(cachePath, '.git'))) {
    return { hasAccess: false, error: 'Кеш каталога не найден. Запустите skill-hub update.' };
  }

  try {
    const git = simpleGit(cachePath);
    await git.raw(['push', '--dry-run', url, 'HEAD:refs/heads/__access_check_dry_run__']);
    return { hasAccess: true };
  } catch (err: any) {
    const msg = String(err.message || err);

    if (msg.includes('Permission') || msg.includes('permission') ||
        msg.includes('denied') || msg.includes('403') ||
        msg.includes('not allowed') || msg.includes('protected branch')) {
      return { hasAccess: false, error: 'Нет прав на запись в репозиторий каталога.' };
    }

    if (msg.includes('could not read Username') || msg.includes('could not read Password') ||
        msg.includes('Authentication failed') || msg.includes('terminal prompts disabled') ||
        msg.includes('HTTP Basic: Access denied') || msg.includes('Invalid username or password')) {
      return { hasAccess: false, error: 'Требуется аутентификация. Настройте git credentials для доступа к каталогу.' };
    }

    if (msg.includes('Could not resolve') || msg.includes('unable to access') ||
        msg.includes('Connection refused') || msg.includes('Network is unreachable') ||
        msg.includes('fatal: repository') || msg.includes('not found')) {
      return { hasAccess: false, error: `Не удалось подключиться к каталогу: ${url}` };
    }

    return { hasAccess: false, error: `Ошибка проверки доступа: ${msg.slice(0, 200)}` };
  }
}

// ─── 2. Валидация расширений ─────────────────────────────────

const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/**
 * Парсит YAML-фронтматтер из markdown-файла.
 * Ожидает блок `---` ... `---` в начале файла.
 */
export function parseFrontmatter(content: string): Partial<Frontmatter> {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};

  const result: Record<string, string | string[]> = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+)\s*:\s*(.+)$/);
    if (kv) {
      const key = kv[1].trim();
      let value = kv[2].trim();
      // Снять кавычки
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // Массив через запятую для tags
      if (key === 'tags') {
        result[key] = value.split(',').map(t => t.trim()).filter(Boolean);
      } else {
        result[key] = value;
      }
    }
  }

  return result as unknown as Partial<Frontmatter>;
}

/** Определяет имя основного файла расширения по типу */
function mainFileName(type: ExtensionType): string {
  if (type === 'agent') return 'AGENT.md';
  if (type === 'command') return 'COMMAND.md';
  return 'SKILL.md';
}

/**
 * Находит основной файл расширения.
 * Для skill — ищет SKILL.md в директории, для agent/command — сам файл или {name}.md.
 */
function findMainFile(scan: ScanResult): string | null {
  const p = scan.path;

  // Если путь — директория, ищем основной файл внутри
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
    const main = path.join(p, mainFileName(scan.type));
    if (fs.existsSync(main)) return main;
    return null;
  }

  // Путь — файл
  if (fs.existsSync(p)) return p;
  return null;
}

/**
 * Валидирует расширения перед загрузкой в каталог.
 * Проверяет: наличие файла, фронтматтер, уникальность имени, kebab-case,
 * размер директории, наличие бинарных файлов.
 */
export function validateExtensionsForUpload(
  extensions: ScanResult[],
  catalog: Catalog,
): ValidationResult[] {
  const catalogNames = new Set(catalog.extensions.map(e => `${e.type}:${e.name}`));

  return extensions.map(ext => {
    const errors: string[] = [];

    // 1. Наличие основного файла
    const mainFile = findMainFile(ext);
    if (!mainFile) {
      errors.push(`Файл ${mainFileName(ext.type)} не найден по пути: ${ext.path}`);
      return { extension: ext, valid: false, errors };
    }

    // 2. Фронтматтер
    const content = fs.readFileSync(mainFile, 'utf-8');
    const fm = parseFrontmatter(content);
    const missingFields: string[] = [];
    if (!fm.name) missingFields.push('name');
    if (!fm.description) missingFields.push('description');
    if (!fm.version) missingFields.push('version');
    if (!fm.author) missingFields.push('author');
    if (missingFields.length > 0) {
      errors.push(`Отсутствуют поля во фронтматтере: ${missingFields.join(', ')}`);
    }

    // 3. Kebab-case
    const extName = fm.name || ext.name;
    if (!KEBAB_CASE_RE.test(extName)) {
      errors.push(`Имя "${extName}" не в формате kebab-case (пример: my-extension)`);
    }

    // 4. Уникальность в каталоге
    const key = `${ext.type}:${extName}`;
    if (catalogNames.has(key)) {
      errors.push(`Расширение ${key} уже существует в каталоге`);
    }

    // 5. Проверка размера директории расширения
    const srcDir = path.dirname(mainFile);
    if (fs.statSync(srcDir).isDirectory()) {
      const size = getExtensionDirSize(srcDir);
      if (size > MAX_EXTENSION_DIR_SIZE) {
        const sizeMb = (size / 1024 / 1024).toFixed(2);
        errors.push(`Размер директории (${sizeMb} МБ) превышает лимит в 1 МБ`);
      }
    }

    // 6. Проверка бинарных файлов
    const binaries = findBinaryFiles(path.dirname(mainFile));
    if (binaries.length > 0) {
      errors.push(`Обнаружены бинарные файлы: ${binaries.join(', ')}`);
    }

    const frontmatter = (fm.name && fm.description && fm.version && fm.author)
      ? fm as Frontmatter
      : undefined;

    return { extension: ext, valid: errors.length === 0, errors, frontmatter };
  });
}

// ─── 3. Формирование записи каталога ─────────────────────────

/**
 * Создаёт объект Extension для вставки в catalog.json.
 * Сканирует директорию расширения на наличие дополнительных файлов.
 */
export function buildCatalogEntry(
  scan: ScanResult,
  frontmatter: Frontmatter,
  agent: AgentName,
): Extension {
  const pKey = platformKey(agent);
  const file = mainFileName(scan.type);
  const extPath = `${scan.type}s/${frontmatter.name}/${file}`;

  // Сканировать дополнительные файлы в директории расширения.
  // scan.path может быть директорией (многофайловое расширение) или файлом —
  // path.dirname() от директории вернёт родительскую, сканируя чужие файлы.
  const srcDir = fs.existsSync(scan.path) && fs.statSync(scan.path).isDirectory()
    ? scan.path
    : path.dirname(scan.path);
  const additionalFiles = listAdditionalFilesFromDir(srcDir, file);

  const entry: Extension = {
    type: scan.type,
    name: frontmatter.name,
    description: frontmatter.description,
    tags: frontmatter.tags ?? [],
    author: frontmatter.author,
    version: frontmatter.version,
    scope: 'both',
    platforms: { [pKey]: file },
    path: extPath,
    dependencies: [],
    projects: [],
  };

  if (additionalFiles.length > 0) {
    entry.files = additionalFiles;
  }

  return entry;
}

/**
 * Собирает относительные пути дополнительных файлов в директории расширения.
 * Исключает основной файл и .skillignore.
 */
function listAdditionalFilesFromDir(dirPath: string, mainFile: string): string[] {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return [];

  const files: string[] = [];
  function walk(current: string): void {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === '.skillignore') continue;
      if (entry.isSymbolicLink()) continue;

      const full = path.join(current, entry.name);
      const rel = path.relative(dirPath, full);

      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        if (current === dirPath && entry.name === mainFile) continue;
        files.push(rel);
      }
    }
  }
  walk(dirPath);
  return files;
}

// ─── 4. Git-операции загрузки ─────────────────────────────────

/**
 * Полный цикл загрузки расширений в каталог:
 * 1. Создать ветку от main
 * 2. Скопировать файлы расширений
 * 3. Обновить catalog.json
 * 4. Commit
 * 5. Push
 * 6. Вернуться на main
 */
export async function uploadExtensions(opts: UploadOptions): Promise<UploadResult> {
  const cachePath = opts.cachePath ?? getCachePath();
  const git = simpleGit(cachePath);

  try {
    // 1. Убедиться что на main, создать ветку
    await git.checkout('main');
    await git.checkoutLocalBranch(opts.branchName);

    // 2. Скопировать файлы расширений в структуру каталога
    for (const ext of opts.extensions) {
      const fm = opts.frontmatters.get(`${ext.type}:${ext.name}`);
      if (!fm) continue;

      const extName = fm.name;
      const targetDir = path.join(cachePath, `${ext.type}s`, extName);
      fs.mkdirSync(targetDir, { recursive: true });

      const srcPath = ext.path;
      if (fs.statSync(srcPath).isDirectory()) {
        // Копируем всю папку расширения
        copyExtensionDir(srcPath, targetDir);
      } else if (ext.type === 'skill') {
        // Скиллы: копировать родительскую директорию (SKILL.md + доп. файлы)
        copyExtensionDir(path.dirname(srcPath), targetDir);
      } else {
        // Агенты/команды: копировать один файл
        const destFile = path.join(targetDir, path.basename(srcPath));
        fs.copyFileSync(srcPath, destFile);
      }
    }

    // 3. Обновить catalog.json
    const catalogPath = path.join(cachePath, 'catalog.json');
    const catalogRaw = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
    const existingExtensions: unknown[] = catalogRaw.extensions || catalogRaw.skills || [];

    for (const ext of opts.extensions) {
      const fm = opts.frontmatters.get(`${ext.type}:${ext.name}`);
      if (!fm) continue;

      const entry = buildCatalogEntry(ext, fm, opts.agent);
      existingExtensions.push(extensionToRaw(entry));
    }

    catalogRaw.extensions = existingExtensions;
    // Обновить counts
    const counts: Record<string, number> = {};
    for (const e of existingExtensions as Array<{ type?: string }>) {
      const t = e.type || 'skill';
      counts[t] = (counts[t] || 0) + 1;
    }
    catalogRaw.counts = counts;
    catalogRaw.generated_at = new Date().toISOString();

    fs.writeFileSync(catalogPath, JSON.stringify(catalogRaw, null, 2) + '\n');

    // 4. Stage и commit
    await git.add('.');
    await git.commit(opts.commitMessage);

    // 5. Push
    const registryUrl = getRegistryUrl();
    await git.push(registryUrl, opts.branchName);

    return { success: true, branchName: opts.branchName };
  } catch (err: any) {
    return { success: false, branchName: opts.branchName, error: String(err.message || err) };
  } finally {
    // 6. Всегда вернуться на main, чтобы не сломать кеш каталога
    try {
      await git.checkout('main');
      // Очистить неотслеживаемую ветку
      try { await git.branch(['-D', opts.branchName]); } catch { /* ignore */ }
    } catch (checkoutErr) {
      console.error('⚠️ Не удалось вернуться на main, сброс кеша...');
      try {
        await git.raw(['reset', '--hard']);
        await git.checkout('main');
      } catch {
        // Крайний случай — полный сброс кеша
        resetCache(cachePath);
        await ensureCache(cachePath);
      }
    }
  }
}

/** Конвертирует Extension в сырой объект для catalog.json */
function extensionToRaw(ext: Extension): Record<string, unknown> {
  const raw: Record<string, unknown> = {
    type: ext.type,
    name: ext.name,
    description: ext.description,
    tags: ext.tags,
    author: ext.author,
    version: ext.version,
    scope: ext.scope,
    platforms: ext.platforms,
    path: ext.path,
    dependencies: ext.dependencies,
    projects: ext.projects,
  };
  if (ext.files && ext.files.length > 0) {
    raw.files = ext.files;
  }
  return raw;
}

// ─── 5. Генерация URL для PR/MR ─────────────────────────────

/** Тип платформы git-хостинга */
export type GitPlatform = 'github' | 'gitlab' | 'unknown';

/** Результат генерации URL для PR */
export interface PrUrlResult {
  platform: GitPlatform;
  url: string | null;
  instruction: string;
}

/**
 * Определяет платформу по URL каталога.
 */
export function detectPlatform(registryUrl: string): GitPlatform {
  const lower = registryUrl.toLowerCase();
  if (lower.includes('github.com')) return 'github';
  if (lower.includes('gitlab.com') || lower.includes('gitlab')) return 'gitlab';
  return 'unknown';
}

/**
 * Извлекает owner/repo из git URL.
 * Поддерживает HTTPS (`https://github.com/owner/repo.git`) и SSH (`git@github.com:owner/repo.git`).
 */
export function parseGitUrl(url: string): { host: string; owner: string; repo: string } | null {
  // HTTPS: https://github.com/owner/repo.git
  const httpsMatch = url.match(/https?:\/\/([^/]+)\/([^/]+)\/([^/.]+)/);
  if (httpsMatch) {
    return { host: httpsMatch[1], owner: httpsMatch[2], repo: httpsMatch[3].replace(/\.git$/, '') };
  }

  // SSH: git@github.com:owner/repo.git
  const sshMatch = url.match(/git@([^:]+):([^/]+)\/([^/.]+)/);
  if (sshMatch) {
    return { host: sshMatch[1], owner: sshMatch[2], repo: sshMatch[3].replace(/\.git$/, '') };
  }

  return null;
}

/**
 * Генерирует URL для создания PR/MR в браузере.
 * Поддерживает GitHub, GitLab; для неизвестных платформ — текстовая инструкция.
 */
export function generatePrUrl(
  registryUrl: string,
  branch: string,
  title: string,
  body: string,
): PrUrlResult {
  const platform = detectPlatform(registryUrl);
  const parsed = parseGitUrl(registryUrl);

  if (!parsed) {
    return {
      platform: 'unknown',
      url: null,
      instruction: `Создайте PR/MR из ветки «${branch}» в «main» вручную в вашем git-хостинге.`,
    };
  }

  // Для GitLab и GitHub не используем encodeURIComponent — macOS open и xdg-open
  // сами кодируют спецсимволы. Предварительное кодирование вызывает двойное
  // энкодирование: %2F → %252F, и GitLab получает несуществующую ветку.
  // Заменяем только символы, которые реально ломают структуру URL.
  const safeTitle = title.replace(/[#&?]/g, encodeURIComponent as any);
  const safeBody = body.replace(/[#&?]/g, encodeURIComponent as any);

  if (platform === 'github') {
    const url = `https://${parsed.host}/${parsed.owner}/${parsed.repo}/compare/main...${branch}?expand=1&title=${safeTitle}&body=${safeBody}`;
    return { platform, url, instruction: 'Откройте ссылку для создания Pull Request на GitHub.' };
  }

  if (platform === 'gitlab') {
    const url = `https://${parsed.host}/${parsed.owner}/${parsed.repo}/-/merge_requests/new?merge_request[source_branch]=${branch}&merge_request[title]=${safeTitle}`;
    return { platform, url, instruction: 'Откройте ссылку для создания Merge Request на GitLab.' };
  }

  return {
    platform: 'unknown',
    url: null,
    instruction: `Создайте PR/MR из ветки «${branch}» в «main» вручную в вашем git-хостинге.`,
  };
}

/**
 * Формирует body для PR из списка загруженных расширений.
 */
export function generatePrBody(extensions: ScanResult[], frontmatters: Map<string, Frontmatter>): string {
  const lines: string[] = ['## Загруженные расширения\n'];

  for (const ext of extensions) {
    const fm = frontmatters.get(`${ext.type}:${ext.name}`);
    if (fm) {
      lines.push(`- **${ext.type}:** \`${fm.name}\` — ${fm.description} (v${fm.version}, автор: ${fm.author})`);
    }
  }

  return lines.join('\n');
}

/**
 * Генерирует заголовок PR из списка расширений.
 */
export function generatePrTitle(extensions: ScanResult[], frontmatters: Map<string, Frontmatter>): string {
  const parts: string[] = [];
  for (const ext of extensions) {
    const fm = frontmatters.get(`${ext.type}:${ext.name}`);
    const name = fm?.name ?? ext.name;
    parts.push(`${ext.type}: ${name}`);
  }
  return `Add ${parts.join(', ')}`;
}

// ─── 6. Получение кандидатов для загрузки ────────────────────

/**
 * Возвращает список расширений на диске, отсутствующих в каталоге.
 * Фильтрует по scope (global/project).
 */
export function getUploadCandidates(
  agent: AgentName,
  scope: 'global' | 'project',
  catalog: Catalog,
): ScanResult[] {
  const adapter = getAdapter(agent);
  const scanned = adapter.scanInstalled();

  const catalogNames = new Set(catalog.extensions.map(e => `${e.type}:${e.name}`));

  return scanned.filter(s => {
    // Фильтр по scope (parent считается project)
    const effectiveScope = s.scope === 'parent' ? 'project' : s.scope;
    if (effectiveScope !== scope) return false;

    // Исключить расширения, уже имеющиеся в каталоге
    if (catalogNames.has(`${s.type}:${s.name}`)) return false;

    return true;
  });
}

/**
 * Генерирует имя ветки для загрузки.
 */
export function generateBranchName(): string {
  const timestamp = Date.now();
  let username = 'user';
  try {
    username = require('os').userInfo().username || 'user';
  } catch { /* ignore */ }
  return `upload/${username}-${timestamp}`;
}
