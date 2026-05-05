import fs from 'fs';
import path from 'path';
import os from 'os';
import { resolveConfig, saveResolvedConfig } from './config';
import { createRegistry } from './registry';
import { getAdapter } from './adapters/get-adapter';
import { AgentName, Extension } from './catalog';
import { isWindows } from './platform';
import { stripFrontmatter } from './frontmatter';

const SYMLINK_TARGETS: Array<{ dir: string; link: string; target: string }> = [
  { dir: '.claude', link: 'skills', target: path.join('..', '.agents', 'skills') },
  { dir: '.claude', link: 'agents', target: path.join('..', '.agents', 'agents') },
  { dir: '.claude', link: 'commands', target: path.join('..', '.agents', 'commands') },
  { dir: '.github', link: 'skills', target: path.join('..', '.agents', 'skills') },
  { dir: '.cursor', link: 'skills', target: path.join('..', '.agents', 'skills') },
  { dir: '.cursor', link: 'agents', target: path.join('..', '.agents', 'agents') },
  { dir: '.cursor', link: 'commands', target: path.join('..', '.agents', 'commands') },
  { dir: '.codex', link: 'skills', target: path.join('..', '.agents', 'skills') },
  { dir: '.codex', link: 'agents', target: path.join('..', '.agents', 'agents') },
  { dir: '.codex', link: 'commands', target: path.join('..', '.agents', 'commands') },
];

// Корневые файлы ИИ-агентов для миграции в .agents/rules/project-rules.md
const ROOT_AI_CONFIGS: Array<{
  file: string;      // путь от корня проекта
  marker: string;    // заголовок секции в project-rules.md
  pointer: string;   // тонкий указатель, заменяющий оригинал
}> = [
  {
    file: 'CLAUDE.md',
    marker: '## Из CLAUDE.md',
    pointer: 'Все правила проекта описаны в [AGENTS.md](AGENTS.md).\nПрочитай AGENTS.md перед началом работы.\n',
  },
  {
    file: '.cursorrules',
    marker: '## Из .cursorrules',
    pointer: 'Все правила проекта описаны в AGENTS.md.\nПрочитай AGENTS.md перед началом работы.\n',
  },
  {
    file: path.join('.github', 'copilot-instructions.md'),
    marker: '## Из .github/copilot-instructions.md',
    pointer: 'Все правила проекта описаны в [AGENTS.md](../AGENTS.md).\nПрочитай AGENTS.md перед началом работы.\n',
  },
  {
    file: path.join('.codex', 'AGENTS.md'),
    marker: '## Из .codex/AGENTS.md',
    pointer: 'Все правила проекта описаны в [AGENTS.md](../AGENTS.md).\nПрочитай AGENTS.md перед началом работы.\n',
  },
];

const AGENTS_MD_TEMPLATE = `# Название проекта

Краткое описание проекта.

## Мета

Перед добавлением или изменением правил, скилов, инструкций -- прочитай скилл
\`agents-conventions\`.

## Правила
`;

const AGENTS_MD_PROJECT_RULES_SECTION = `
### Правила проекта
Основные правила и описание проекта.
[Подробности](.agents/rules/project-rules.md)
`;

/** Проверяет, является ли содержимое файла тонким указателем на AGENTS.md */
function isRootThinPointer(content: string): boolean {
  return content.includes('Прочитай AGENTS.md перед началом работы');
}

/**
 * Программная генерация project-rules.md по метаданным проекта (без AI).
 * Покрывает ~80% случаев: парсит package.json, requirements.txt, go.mod и т.д.
 */
function generateProjectRules(projectDir: string): string | null {
  const sections: string[] = ['# Правила проекта\n'];
  let lang = '';
  let framework = '';
  let pkgManager = '';
  const commands: Array<{ label: string; cmd: string }> = [];

  // Определяем стек по файлам-маркерам
  const pkgJsonPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      lang = 'TypeScript/JavaScript';
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (allDeps['next']) framework = 'Next.js';
      else if (allDeps['nuxt']) framework = 'Nuxt';
      else if (allDeps['react']) framework = 'React';
      else if (allDeps['vue']) framework = 'Vue';
      else if (allDeps['svelte'] || allDeps['@sveltejs/kit']) framework = 'Svelte';
      else if (allDeps['express']) framework = 'Express';
      else if (allDeps['fastify']) framework = 'Fastify';
      else if (allDeps['@nestjs/core']) framework = 'NestJS';

      if (fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml'))) pkgManager = 'pnpm';
      else if (fs.existsSync(path.join(projectDir, 'yarn.lock'))) pkgManager = 'yarn';
      else if (fs.existsSync(path.join(projectDir, 'bun.lockb')) || fs.existsSync(path.join(projectDir, 'bun.lock'))) pkgManager = 'bun';
      else pkgManager = 'npm';

      if (pkg.scripts) {
        if (pkg.scripts.build) commands.push({ label: 'Сборка', cmd: `${pkgManager} run build` });
        if (pkg.scripts.test) commands.push({ label: 'Тесты', cmd: `${pkgManager} test` });
        if (pkg.scripts.lint) commands.push({ label: 'Линтинг', cmd: `${pkgManager} run lint` });
        if (pkg.scripts.dev) commands.push({ label: 'Dev-сервер', cmd: `${pkgManager} run dev` });
      }
    } catch { /* невалидный package.json */ }
  } else if (fs.existsSync(path.join(projectDir, 'requirements.txt')) || fs.existsSync(path.join(projectDir, 'pyproject.toml'))) {
    lang = 'Python';
    pkgManager = fs.existsSync(path.join(projectDir, 'poetry.lock')) ? 'poetry'
      : fs.existsSync(path.join(projectDir, 'Pipfile')) ? 'pipenv' : 'pip';
  } else if (fs.existsSync(path.join(projectDir, 'go.mod'))) {
    lang = 'Go';
    pkgManager = 'go';
  } else if (fs.existsSync(path.join(projectDir, 'Cargo.toml'))) {
    lang = 'Rust';
    pkgManager = 'cargo';
  } else if (fs.existsSync(path.join(projectDir, 'Gemfile'))) {
    lang = 'Ruby';
    pkgManager = 'bundler';
  } else {
    // Не удалось определить стек — лучше оставить для AI
    return null;
  }

  // Секция «Стек»
  sections.push('## Стек\n');
  sections.push(`- Язык: ${lang}`);
  if (framework) sections.push(`- Фреймворк: ${framework}`);
  sections.push(`- Менеджер пакетов: ${pkgManager}`);
  sections.push('');

  // Секция «Структура проекта» — верхнеуровневые директории
  try {
    const entries = fs.readdirSync(projectDir, { withFileTypes: true })
      .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
      .slice(0, 15);
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name + path.sep);
    if (dirs.length > 0) {
      sections.push('## Структура проекта\n');
      sections.push('```');
      for (const d of dirs) sections.push(d);
      sections.push('```');
      sections.push('');
    }
  } catch { /* ignore */ }

  // Секция «Ключевые команды»
  if (commands.length > 0) {
    sections.push('## Ключевые команды\n');
    for (const c of commands) {
      sections.push(`- ${c.label}: \`${c.cmd}\``);
    }
    sections.push('');
  }

  // README — первые строки описания
  const readmePath = path.join(projectDir, 'README.md');
  if (fs.existsSync(readmePath)) {
    try {
      const readme = fs.readFileSync(readmePath, 'utf-8');
      const lines = readme.split('\n').slice(0, 10);
      // Ищем первый непустой абзац после заголовка
      let description = '';
      let pastTitle = false;
      for (const line of lines) {
        if (line.startsWith('#')) { pastTitle = true; continue; }
        if (pastTitle && line.trim().length > 0) {
          description = line.trim();
          break;
        }
      }
      if (description) {
        // Вставляем описание в начало после заголовка
        sections.splice(1, 0, description + '\n');
      }
    } catch { /* ignore */ }
  }

  return sections.join('\n');
}

/**
 * Парсит project-rules.md с маркерами источников.
 * Возвращает Map<marker, content> или null если маркеров нет (автосгенерированный файл).
 */
function parseProjectRulesMarkers(content: string): Map<string, string> | null {
  const markers = ROOT_AI_CONFIGS.map(c => c.marker);
  const hasMarkers = markers.some(m => content.includes(m));
  if (!hasMarkers) return null;

  const result = new Map<string, string>();
  for (const marker of markers) {
    const markerIdx = content.indexOf(marker);
    if (markerIdx === -1) continue;
    const start = markerIdx + marker.length;
    let end = content.length;
    for (const other of markers) {
      if (other === marker) continue;
      const otherIdx = content.indexOf(other, start);
      if (otherIdx !== -1 && otherIdx < end) end = otherIdx;
    }
    result.set(marker, content.slice(start, end).trim());
  }
  return result;
}

export interface EnableConventionsResult {
  /** Нужен ли автоанализ проекта (нет корневых конфигов, project-rules.md не создан) */
  needsAutoAnalysis: boolean;
}

// Тонкие указатели: содержат только ссылку на AGENTS.md
const THIN_POINTERS: Array<{ filePath: string; content: string }> = [
  {
    filePath: path.join('.claude', 'CLAUDE.md'),
    content: 'Все правила проекта описаны в [AGENTS.md](../AGENTS.md).\nПрочитай AGENTS.md перед началом работы.\n',
  },
  {
    filePath: path.join('.github', 'instructions', 'project-rules.instructions.md'),
    content: '---\napplyTo: "**"\n---\nВсе правила проекта описаны в [AGENTS.md](../../AGENTS.md).\nПрочитай AGENTS.md перед началом работы.\n',
  },
  {
    filePath: path.join('.cursor', 'rules', 'project-rules.mdc'),
    content: '---\ndescription: Правила проекта\nalwaysApply: true\n---\nВсе правила описаны в [AGENTS.md](../AGENTS.md).\nПрочитай AGENTS.md перед началом работы.\n',
  },
];

export interface ConventionsStatus {
  active: boolean;
  hasAgentsDir: boolean;
  hasAgentsMd: boolean;
  symlinks: Array<{ path: string; exists: boolean; valid: boolean }>;
  pointers: Array<{ path: string; exists: boolean }>;
  extensionCount: number;
  isHealthy: boolean;
}

export function isConventionsActive(): boolean {
  return resolveConfig().config.agent === 'agents-conventions';
}

export function getConventionsStatus(projectDir: string = process.cwd()): ConventionsStatus {
  const { config } = resolveConfig();
  const active = config.agent === 'agents-conventions';
  const agentsDir = path.join(projectDir, '.agents');
  const hasAgentsDir = fs.existsSync(agentsDir);

  const symlinks = SYMLINK_TARGETS.map(s => {
    const linkPath = path.join(projectDir, s.dir, s.link);
    const exists = fs.existsSync(linkPath);
    let valid = false;
    if (exists) {
      try {
        const stat = fs.lstatSync(linkPath);
        valid = stat.isSymbolicLink();
      } catch { /* ignore */ }
    }
    return { path: linkPath, exists, valid };
  });

  const pointers = THIN_POINTERS.map(p => {
    const fullPath = path.join(projectDir, p.filePath);
    return { path: fullPath, exists: fs.existsSync(fullPath) };
  });

  let extensionCount = 0;
  const skillsDir = path.join(agentsDir, 'skills');
  if (fs.existsSync(skillsDir)) {
    extensionCount += fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(e => e.isDirectory()).length;
  }
  const agentsDirPath = path.join(agentsDir, 'agents');
  if (fs.existsSync(agentsDirPath)) {
    extensionCount += fs.readdirSync(agentsDirPath, { withFileTypes: true })
      .filter(e => e.isFile() && e.name.endsWith('.md')).length;
  }
  const commandsDir = path.join(agentsDir, 'commands');
  if (fs.existsSync(commandsDir)) {
    extensionCount += fs.readdirSync(commandsDir, { withFileTypes: true })
      .filter(e => e.isFile() && e.name.endsWith('.md')).length;
  }
  const hasAgentsMd = fs.existsSync(path.join(projectDir, 'AGENTS.md'));
  const isHealthy = hasAgentsDir
    && hasAgentsMd
    && symlinks.every(s => s.valid);

  return { active, hasAgentsDir, hasAgentsMd, symlinks, pointers, extensionCount, isHealthy };
}

/**
 * Устанавливает/обновляет bootstrap-скиллы из бандла CLI.
 * `agents-conventions` → глобально во все поддерживаемые AI-агенты (без registry).
 * `init-agents`/`exit-agents` → `~/.skill-hub/bootstrap/` (глобальные, без registry).
 */
function installBootstrapSkills(): void {
  const bundleDir = path.join(__dirname, '..', 'base-skills', 'agents-conventions');

  // init-agents / exit-agents → глобальный ~/.skill-hub/bootstrap/
  const globalBootstrapDir = path.join(os.homedir(), '.skill-hub', 'bootstrap');
  for (const skillName of ['init-agents', 'exit-agents']) {
    const srcDir = path.join(bundleDir, skillName);
    if (!fs.existsSync(srcDir)) continue;

    const destDir = path.join(globalBootstrapDir, skillName);
    fs.mkdirSync(destDir, { recursive: true });
    fs.cpSync(srcDir, destDir, { recursive: true });
  }

  // agents-conventions → глобально во все AI-агенты
  installAgentsConventionsGlobal();
}

// Маркеры для copilot/codex marker-based injection
const AC_MARKER_START = '<!-- skill-hub: agents-conventions -->';
const AC_MARKER_END = '<!-- /skill-hub: agents-conventions -->';

/**
 * Устанавливает скилл agents-conventions глобально во все поддерживаемые AI-агенты.
 * claude-code, cursor — копия директории в ~/.{agent}/skills/.
 * copilot — marker-injection в глобальный copilot-instructions.md.
 * codex — marker-injection в ~/.codex/AGENTS.md.
 */
function installAgentsConventionsGlobal(): void {
  const bundleDir = path.join(__dirname, '..', 'base-skills', 'agents-conventions', 'agents-conventions');
  if (!fs.existsSync(bundleDir)) return;

  const homeDir = os.homedir();
  const skillMdPath = path.join(bundleDir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) return;

  // claude-code и cursor — копируем директорию целиком (SKILL.md + assets/)
  for (const agentDir of ['.claude', '.cursor']) {
    const destDir = path.join(homeDir, agentDir, 'skills', 'agents-conventions');
    fs.mkdirSync(destDir, { recursive: true });
    fs.cpSync(bundleDir, destDir, { recursive: true });
  }

  // copilot и codex — marker-based injection
  const rawContent = fs.readFileSync(skillMdPath, 'utf-8');
  const content = stripFrontmatter(rawContent);
  const section = `\n${AC_MARKER_START}\n${content}\n${AC_MARKER_END}\n`;

  // copilot: глобальный copilot-instructions.md
  const copilotPath = process.platform === 'darwin'
    ? path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'copilot-instructions.md')
    : process.platform === 'win32'
      ? path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'Code', 'User', 'copilot-instructions.md')
      : path.join(homeDir, '.config', 'Code', 'User', 'copilot-instructions.md');
  injectMarkerSection(copilotPath, section);

  // codex: ~/.codex/AGENTS.md
  const codexPath = path.join(homeDir, '.codex', 'AGENTS.md');
  injectMarkerSection(codexPath, section);
}

/**
 * Удаляет скилл agents-conventions из всех глобальных расположений AI-агентов.
 */
function removeAgentsConventionsGlobal(): void {
  const homeDir = os.homedir();

  // claude-code и cursor — удаляем директорию
  for (const agentDir of ['.claude', '.cursor']) {
    const skillDir = path.join(homeDir, agentDir, 'skills', 'agents-conventions');
    if (fs.existsSync(skillDir)) {
      fs.rmSync(skillDir, { recursive: true, force: true });
    }
  }

  // copilot — убираем секцию из copilot-instructions.md
  const copilotPath = process.platform === 'darwin'
    ? path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'copilot-instructions.md')
    : process.platform === 'win32'
      ? path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'Code', 'User', 'copilot-instructions.md')
      : path.join(homeDir, '.config', 'Code', 'User', 'copilot-instructions.md');
  removeMarkerSection(copilotPath);

  // codex — убираем секцию из ~/.codex/AGENTS.md
  const codexPath = path.join(homeDir, '.codex', 'AGENTS.md');
  removeMarkerSection(codexPath);
}

/** Вставляет/обновляет marker-секцию agents-conventions в файле */
function injectMarkerSection(filePath: string, section: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
  const cleaned = removeMarkerContent(existing);
  fs.writeFileSync(filePath, cleaned + section);
}

/** Удаляет marker-секцию agents-conventions из файла */
function removeMarkerSection(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  const cleaned = removeMarkerContent(content);
  fs.writeFileSync(filePath, cleaned);
}

/** Вырезает текст между маркерами agents-conventions (включая сами маркеры) */
function removeMarkerContent(content: string): string {
  const startIdx = content.indexOf(AC_MARKER_START);
  if (startIdx === -1) return content;

  const endIdx = content.indexOf(AC_MARKER_END);
  if (endIdx === -1) {
    console.warn('⚠️ Конечный маркер agents-conventions не найден. Файл не изменён.');
    return content;
  }

  return content.slice(0, startIdx) + content.slice(endIdx + AC_MARKER_END.length);
}

/**
 * Создаёт симлинк кроссплатформенно.
 * Стратегия fallback на Windows: symlink('dir') → junction (не требует admin-прав) → копирование.
 * @param target - относительный путь-цель симлинка
 * @param linkPath - путь создаваемого симлинка
 * @param baseDir - базовая директория для resolve абсолютного пути (нужен для junction)
 */
function createSymlinkCrossPlatform(target: string, linkPath: string, baseDir: string): void {
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });

  if (!isWindows) {
    fs.symlinkSync(target, linkPath);
    return;
  }

  // Windows: попытка symlink с типом 'dir'
  try {
    fs.symlinkSync(target, linkPath, 'dir');
    return;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'EPERM') throw err;
  }

  // Fallback: junction (не требует admin-прав, но нужен абсолютный путь)
  try {
    const absTarget = path.resolve(baseDir, target);
    fs.symlinkSync(absTarget, linkPath, 'junction');
    return;
  } catch {
    // junction тоже не удался — копируем
  }

  // Последний fallback: копирование директории
  const absTarget = path.resolve(baseDir, target);
  if (fs.existsSync(absTarget)) {
    fs.cpSync(absTarget, linkPath, { recursive: true });
  }
}

export async function enableConventions(projectDir: string = process.cwd()): Promise<EnableConventionsResult> {
  const { config, source, projectRoot } = resolveConfig();

  // При повторном вызове (переинициализация) используем claude-code как previousAgent
  const previousAgent = config.agent === 'agents-conventions' ? 'claude-code' : config.agent;

  // Быстрый выход: если структура здорова, только обновляем bootstrap-скиллы
  if (config.agent === 'agents-conventions') {
    const status = getConventionsStatus(projectDir);
    if (status.isHealthy) {
      installBootstrapSkills();
      const projectRulesPath = path.join(projectDir, '.agents', 'rules', 'project-rules.md');
      return { needsAutoAnalysis: !fs.existsSync(projectRulesPath) };
    }
  }

  // 1. Создание директорий
  const dirs = [
    path.join(projectDir, '.agents', 'skills'),
    path.join(projectDir, '.agents', 'agents'),
    path.join(projectDir, '.agents', 'commands'),
    path.join(projectDir, '.agents', 'rules'),
    path.join(projectDir, '.claude'),
    path.join(projectDir, '.github', 'instructions'),
    path.join(projectDir, '.cursor', 'rules'),
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 2. Миграция корневых файлов ИИ-агентов → .agents/rules/project-rules.md
  const projectRulesPath = path.join(projectDir, '.agents', 'rules', 'project-rules.md');
  let projectRulesCreated = false;

  if (!fs.existsSync(projectRulesPath)) {
    const foundConfigs: Array<{ marker: string; content: string; file: string }> = [];
    for (const cfg of ROOT_AI_CONFIGS) {
      const filePath = path.join(projectDir, cfg.file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        // Пропускаем если уже тонкий указатель
        if (!isRootThinPointer(content) && content.trim().length > 0) {
          foundConfigs.push({ marker: cfg.marker, content, file: cfg.file });
        }
      }
    }

    if (foundConfigs.length > 0) {
      // Собираем project-rules.md из найденных конфигов
      let projectRulesContent = '# Правила проекта\n\n<!-- Мигрировано из корневых файлов ИИ-агентов -->\n';
      for (const cfg of foundConfigs) {
        projectRulesContent += `\n${cfg.marker}\n\n${cfg.content}\n`;
      }
      fs.writeFileSync(projectRulesPath, projectRulesContent);
      projectRulesCreated = true;

      // Заменяем оригиналы тонкими указателями
      for (const cfg of foundConfigs) {
        const rootCfg = ROOT_AI_CONFIGS.find(c => c.file === cfg.file)!;
        const filePath = path.join(projectDir, rootCfg.file);
        fs.writeFileSync(filePath, rootCfg.pointer);
      }
    } else {
      // Корневых конфигов нет — пробуем программную генерацию по метаданным проекта
      const generated = generateProjectRules(projectDir);
      if (generated) {
        fs.writeFileSync(projectRulesPath, generated);
        projectRulesCreated = true;
      }
    }
  } else {
    projectRulesCreated = true; // уже существует
  }

  // 3. Создание симлинков (идемпотентно)
  for (const s of SYMLINK_TARGETS) {
    const linkPath = path.join(projectDir, s.dir, s.link);

    if (fs.existsSync(linkPath)) {
      const stat = fs.lstatSync(linkPath);
      if (stat.isSymbolicLink()) {
        // Уже симлинк — проверяем target (нормализуем для кроссплатформенности)
        const currentTarget = fs.readlinkSync(linkPath);
        if (path.normalize(currentTarget) === path.normalize(s.target)) continue; // уже корректный
        fs.unlinkSync(linkPath);
      } else if (stat.isDirectory()) {
        // Обычная директория — мигрируем содержимое в соответствующую .agents/ поддиректорию
        const entries = fs.readdirSync(linkPath, { withFileTypes: true });
        for (const entry of entries) {
          const src = path.join(linkPath, entry.name);
          const dest = path.join(projectDir, '.agents', s.link, entry.name);
          if (!fs.existsSync(dest)) {
            fs.cpSync(src, dest, { recursive: true });
          }
        }
        fs.rmSync(linkPath, { recursive: true });
      }
    }

    createSymlinkCrossPlatform(s.target, linkPath, path.dirname(linkPath));
  }

  // 4. Создание тонких указателей (если не существуют)
  for (const p of THIN_POINTERS) {
    const fullPath = path.join(projectDir, p.filePath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, p.content);
    }
  }

  // 4.5. Миграция agent/command файлов из .agents/rules/ в .agents/agents/ и .agents/commands/
  const registryDir = path.join(os.homedir(), '.skill-hub');
  const reg = createRegistry(registryDir);
  const existingRecords = reg.list('agents-conventions');
  const rulesDir = path.join(projectDir, '.agents', 'rules');
  if (fs.existsSync(rulesDir)) {
    for (const record of existingRecords) {
      if (record.type !== 'agent' && record.type !== 'command') continue;
      const oldPath = path.join(rulesDir, `${record.name}.md`);
      if (!fs.existsSync(oldPath)) continue;
      const newDir = record.type === 'agent' ? 'agents' : 'commands';
      const newPath = path.join(projectDir, '.agents', newDir, `${record.name}.md`);
      if (!fs.existsSync(newPath)) {
        fs.mkdirSync(path.dirname(newPath), { recursive: true });
        fs.renameSync(oldPath, newPath);
        reg.add({ ...record, path: newPath });
      }
    }
  }

  // 5. Миграция skill-hub расширений из installed.json
  const records = reg.list(previousAgent).filter(r => r.scope === 'project');
  const conventionsAdapter = getAdapter('agents-conventions');

  for (const record of records) {
    const ext: Extension = {
      type: record.type,
      name: record.name,
      description: '',
      tags: [],
      version: record.version,
      scope: 'project',
      platforms: { 'claude-code': null },
      path: '',
      dependencies: [],
      projects: [],
    };

    const newPath = conventionsAdapter.getInstallPath(ext, 'project');

    // Копируем файл если старый путь существует и новый нет
    if (record.path && fs.existsSync(record.path) && !fs.existsSync(newPath)) {
      fs.mkdirSync(path.dirname(newPath), { recursive: true });
      // Для скиллов копируем всю директорию
      if (record.type === 'skill') {
        const oldDir = path.dirname(record.path);
        const newDir = path.dirname(newPath);
        fs.cpSync(oldDir, newDir, { recursive: true });
      } else {
        fs.copyFileSync(record.path, newPath);
      }
    }

    // Удаляем старый файл если он не симлинк (симлинки = уже мигрированы)
    if (record.path && fs.existsSync(record.path)) {
      const stat = fs.lstatSync(record.path);
      if (!stat.isSymbolicLink()) {
        if (record.type === 'skill') {
          const oldDir = path.dirname(record.path);
          fs.rmSync(oldDir, { recursive: true, force: true });
        } else {
          fs.unlinkSync(record.path);
        }
      }
    }

    // Обновляем запись в реестре
    reg.remove(record.name, record.type, previousAgent);
    reg.add({
      type: record.type,
      name: record.name,
      version: record.version,
      agent: 'agents-conventions',
      scope: 'project',
      path: newPath,
    });
  }

  // 6. Обновление конфига
  config.agent = 'agents-conventions';
  saveResolvedConfig(config, source, projectRoot);

  // 7. Установка/обновление bootstrap-скиллов из бандла CLI
  installBootstrapSkills();

  // 8. Создание AGENTS.md (если отсутствует)
  const agentsMdPath = path.join(projectDir, 'AGENTS.md');
  if (!fs.existsSync(agentsMdPath)) {
    let agentsMdContent = AGENTS_MD_TEMPLATE;
    if (projectRulesCreated) {
      agentsMdContent += AGENTS_MD_PROJECT_RULES_SECTION;
    }
    fs.writeFileSync(agentsMdPath, agentsMdContent);
  } else if (projectRulesCreated) {
    // AGENTS.md существует, но может не содержать ссылку на project-rules
    const existing = fs.readFileSync(agentsMdPath, 'utf-8');
    if (!existing.includes('project-rules')) {
      fs.writeFileSync(agentsMdPath, existing + AGENTS_MD_PROJECT_RULES_SECTION);
    }
  }

  return { needsAutoAnalysis: !projectRulesCreated };
}

export async function disableConventions(
  targetAgent: AgentName,
  projectDir: string = process.cwd(),
  confirmDelete?: () => Promise<boolean>,
): Promise<void> {
  const { config, source, projectRoot } = resolveConfig();

  if (config.agent !== 'agents-conventions') {
    throw new Error('Режим agents-conventions не активен');
  }

  if (targetAgent === 'agents-conventions') {
    throw new Error('Укажите целевой агент: claude-code, cursor или copilot');
  }

  const registryDir = path.join(os.homedir(), '.skill-hub');
  const reg = createRegistry(registryDir);
  const records = reg.list('agents-conventions');
  const targetAdapter = getAdapter(targetAgent);

  // 1. Восстановление корневых файлов из .agents/rules/project-rules.md
  const projectRulesPath = path.join(projectDir, '.agents', 'rules', 'project-rules.md');
  if (fs.existsSync(projectRulesPath)) {
    const prContent = fs.readFileSync(projectRulesPath, 'utf-8');
    const markerSections = parseProjectRulesMarkers(prContent);

    if (markerSections) {
      // Файл содержит маркеры — восстанавливаем каждый источник
      for (const cfg of ROOT_AI_CONFIGS) {
        const sectionContent = markerSections.get(cfg.marker);
        if (!sectionContent) continue;
        const targetPath = path.join(projectDir, cfg.file);
        if (fs.existsSync(targetPath)) {
          const existing = fs.readFileSync(targetPath, 'utf-8');
          if (!isRootThinPointer(existing)) continue; // пользовательский контент — не трогаем
        }
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, sectionContent);
      }
    } else {
      // Автосгенерированный — записываем в корневой файл целевого агента
      const targetFile = targetAgent === 'claude-code' ? 'CLAUDE.md'
        : targetAgent === 'cursor' ? '.cursorrules'
        : path.join('.github', 'copilot-instructions.md');
      const targetPath = path.join(projectDir, targetFile);
      if (!fs.existsSync(targetPath) || isRootThinPointer(fs.readFileSync(targetPath, 'utf-8'))) {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, prContent);
      }
    }
  }

  // 2. Миграция правил из .agents/rules/ в формат целевого агента
  const rulesDir = path.join(projectDir, '.agents', 'rules');
  if (fs.existsSync(rulesDir)) {
    const ruleFiles = fs.readdirSync(rulesDir, { withFileTypes: true })
      .filter(e => e.isFile() && e.name.endsWith('.md') && e.name !== 'project-rules.md');

    for (const ruleFile of ruleFiles) {
      const ruleName = ruleFile.name.slice(0, -3); // убираем .md
      const ruleContent = fs.readFileSync(path.join(rulesDir, ruleFile.name), 'utf-8');

      if (targetAgent === 'claude-code') {
        const dest = path.join(projectDir, '.claude', `${ruleName}.md`);
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.writeFileSync(dest, ruleContent);
        }
      } else if (targetAgent === 'cursor') {
        const dest = path.join(projectDir, '.cursor', 'rules', `${ruleName}.mdc`);
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.writeFileSync(dest, `---\ndescription: ${ruleName}\nalwaysApply: false\n---\n${ruleContent}`);
        }
      } else if (targetAgent === 'copilot') {
        const dest = path.join(projectDir, '.github', 'instructions', `${ruleName}.instructions.md`);
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.writeFileSync(dest, `---\napplyTo: "**"\n---\n${ruleContent}`);
        }
      }
    }
  }

  // 3. Очистка корневых тонких указателей (если не были перезаписаны на шаге 1)
  for (const cfg of ROOT_AI_CONFIGS) {
    const filePath = path.join(projectDir, cfg.file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (isRootThinPointer(content)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  // 4. Миграция расширений обратно в папку целевого агента
  for (const record of records) {
    // Пропускаем bootstrap-скиллы
    if (record.name === 'agents-conventions' || record.name === 'init-agents' || record.name === 'exit-agents') continue;

    const ext: Extension = {
      type: record.type,
      name: record.name,
      description: '',
      tags: [],
      version: record.version,
      scope: record.scope as 'global' | 'project',
      platforms: { 'claude-code': null },
      path: '',
      dependencies: [],
      projects: [],
    };

    const newPath = targetAdapter.getInstallPath(ext, 'project');

    if (record.path && fs.existsSync(record.path) && !fs.existsSync(newPath)) {
      fs.mkdirSync(path.dirname(newPath), { recursive: true });
      if (record.type === 'skill') {
        const oldDir = path.dirname(record.path);
        const newDir = path.dirname(newPath);
        fs.cpSync(oldDir, newDir, { recursive: true });
      } else {
        fs.copyFileSync(record.path, newPath);
      }
    }

    reg.remove(record.name, record.type, 'agents-conventions');
    reg.add({
      type: record.type,
      name: record.name,
      version: record.version,
      agent: targetAgent,
      scope: 'project',
      path: newPath,
    });
  }

  // 5. Удаление симлинков
  for (const s of SYMLINK_TARGETS) {
    const linkPath = path.join(projectDir, s.dir, s.link);
    if (fs.existsSync(linkPath)) {
      const stat = fs.lstatSync(linkPath);
      if (stat.isSymbolicLink()) {
        fs.unlinkSync(linkPath);
      }
    }
  }

  // 6. Удаление тонких указателей, созданных CLI
  for (const p of THIN_POINTERS) {
    const fullPath = path.join(projectDir, p.filePath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      // Удаляем только если содержимое совпадает (наш указатель)
      if (content === p.content) {
        fs.unlinkSync(fullPath);
      }
    }
  }

  // 7. Удаление скилла agents-conventions из всех глобальных расположений
  // init-agents/exit-agents живут в ~/.skill-hub/bootstrap/ — не трогаем
  removeAgentsConventionsGlobal();
  // Также убираем из .agents/skills/ если ещё остался (legacy)
  const acProjectDir = path.join(projectDir, '.agents', 'skills', 'agents-conventions');
  if (fs.existsSync(acProjectDir)) {
    fs.rmSync(acProjectDir, { recursive: true, force: true });
  }
  reg.remove('agents-conventions', 'skill', 'agents-conventions');

  // 8. Обновление конфига
  config.agent = targetAgent;
  saveResolvedConfig(config, source, projectRoot);

  // 9. Предложить удаление .agents/ и AGENTS.md
  if (confirmDelete) {
    const shouldDelete = await confirmDelete();
    if (shouldDelete) {
      await deleteConventionsArtifacts(projectDir);
    }
  }
}

export async function deleteConventionsArtifacts(projectDir: string = process.cwd()): Promise<void> {
  const agentsDir = path.join(projectDir, '.agents');
  if (fs.existsSync(agentsDir)) {
    fs.rmSync(agentsDir, { recursive: true, force: true });
  }
  const agentsMd = path.join(projectDir, 'AGENTS.md');
  if (fs.existsSync(agentsMd)) {
    fs.unlinkSync(agentsMd);
  }
}

/**
 * Идемпотентное восстановление структуры agents-conventions:
 * директории, симлинки, тонкие указатели, bootstrap-скиллы, AGENTS.md.
 * Не выполняет миграцию расширений — только гарантирует наличие инфраструктуры.
 */
export function ensureConventionsStructure(projectDir: string = process.cwd()): void {
  // 1. Директории
  const dirs = [
    path.join(projectDir, '.agents', 'skills'),
    path.join(projectDir, '.agents', 'agents'),
    path.join(projectDir, '.agents', 'commands'),
    path.join(projectDir, '.agents', 'rules'),
    path.join(projectDir, '.claude'),
    path.join(projectDir, '.github', 'instructions'),
    path.join(projectDir, '.cursor', 'rules'),
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 2. Симлинки (идемпотентно)
  for (const s of SYMLINK_TARGETS) {
    const linkPath = path.join(projectDir, s.dir, s.link);

    if (fs.existsSync(linkPath)) {
      try {
        const stat = fs.lstatSync(linkPath);
        if (stat.isSymbolicLink()) {
          const currentTarget = fs.readlinkSync(linkPath);
          if (path.normalize(currentTarget) === path.normalize(s.target)) continue;
          fs.unlinkSync(linkPath);
        } else if (stat.isDirectory()) {
          // Обычная директория с контентом — мигрируем в .agents/ и удаляем
          const entries = fs.readdirSync(linkPath, { withFileTypes: true });
          for (const entry of entries) {
            const src = path.join(linkPath, entry.name);
            const dest = path.join(projectDir, '.agents', s.link, entry.name);
            if (!fs.existsSync(dest)) {
              fs.cpSync(src, dest, { recursive: true });
            }
          }
          fs.rmSync(linkPath, { recursive: true });
        }
      } catch { /* ignore stat failures */ }
    }

    createSymlinkCrossPlatform(s.target, linkPath, path.dirname(linkPath));
  }

  // 3. Тонкие указатели
  for (const p of THIN_POINTERS) {
    const fullPath = path.join(projectDir, p.filePath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, p.content);
    }
  }

  // 4. Bootstrap-скиллы
  installBootstrapSkills();

  // 5. AGENTS.md
  const agentsMdPath = path.join(projectDir, 'AGENTS.md');
  if (!fs.existsSync(agentsMdPath)) {
    fs.writeFileSync(agentsMdPath, AGENTS_MD_TEMPLATE);
  }
}
