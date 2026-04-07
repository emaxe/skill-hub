import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadConfig, saveConfig } from './config';
import { createRegistry } from './registry';
import { getAdapter } from './adapters/get-adapter';
import { AgentName, Extension } from './catalog';

const SYMLINK_TARGETS: Array<{ dir: string; link: string; target: string }> = [
  { dir: '.claude', link: 'skills', target: path.join('..', '.agents', 'skills') },
  { dir: '.github', link: 'skills', target: path.join('..', '.agents', 'skills') },
  { dir: '.cursor', link: 'skills', target: path.join('..', '.agents', 'skills') },
];

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
  return loadConfig().agent === 'agents-conventions';
}

export function getConventionsStatus(projectDir: string = process.cwd()): ConventionsStatus {
  const config = loadConfig();
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
  const rulesDir = path.join(agentsDir, 'rules');
  if (fs.existsSync(rulesDir)) {
    extensionCount += fs.readdirSync(rulesDir, { withFileTypes: true })
      .filter(e => e.isFile() && e.name.endsWith('.md')).length;
  }

  const hasAgentsMd = fs.existsSync(path.join(projectDir, 'AGENTS.md'));
  const isHealthy = hasAgentsDir
    && hasAgentsMd
    && symlinks.every(s => s.valid);

  return { active, hasAgentsDir, hasAgentsMd, symlinks, pointers, extensionCount, isHealthy };
}

export async function enableConventions(projectDir: string = process.cwd()): Promise<void> {
  const config = loadConfig();

  // При повторном вызове (переинициализация) используем claude-code как previousAgent
  const previousAgent = config.agent === 'agents-conventions' ? 'claude-code' : config.agent;

  // 1. Создание директорий
  const dirs = [
    path.join(projectDir, '.agents', 'skills'),
    path.join(projectDir, '.agents', 'rules'),
    path.join(projectDir, '.claude'),
    path.join(projectDir, '.github', 'instructions'),
    path.join(projectDir, '.cursor', 'rules'),
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 2. Создание симлинков (идемпотентно)
  for (const s of SYMLINK_TARGETS) {
    const linkPath = path.join(projectDir, s.dir, s.link);

    if (fs.existsSync(linkPath)) {
      const stat = fs.lstatSync(linkPath);
      if (stat.isSymbolicLink()) {
        // Уже симлинк — проверяем target
        const currentTarget = fs.readlinkSync(linkPath);
        if (currentTarget === s.target) continue; // уже корректный
        fs.unlinkSync(linkPath);
      } else if (stat.isDirectory()) {
        // Обычная директория — мигрируем содержимое
        const entries = fs.readdirSync(linkPath, { withFileTypes: true });
        for (const entry of entries) {
          const src = path.join(linkPath, entry.name);
          const dest = path.join(projectDir, '.agents', 'skills', entry.name);
          if (!fs.existsSync(dest)) {
            fs.cpSync(src, dest, { recursive: true });
          }
        }
        fs.rmSync(linkPath, { recursive: true });
      }
    }

    fs.symlinkSync(s.target, linkPath);
  }

  // 3. Создание тонких указателей (если не существуют)
  for (const p of THIN_POINTERS) {
    const fullPath = path.join(projectDir, p.filePath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, p.content);
    }
  }

  // 4. Миграция skill-hub расширений из installed.json
  const registryDir = path.join(os.homedir(), '.skill-hub');
  const reg = createRegistry(registryDir);
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

  // 5. Обновление конфига
  config.agent = 'agents-conventions';
  saveConfig(config);

  // 6. Установка скиллов agents-conventions и init-agents из бандла CLI
  const bundleDir = path.join(__dirname, '..', 'base-skills', 'agents-conventions');
  const bootstrapSkills = ['agents-conventions', 'init-agents', 'exit-agents'];

  for (const skillName of bootstrapSkills) {
    if (reg.isInstalled(skillName, 'skill', 'agents-conventions')) continue;

    const srcDir = path.join(bundleDir, skillName);
    if (!fs.existsSync(srcDir)) continue;

    const ext: Extension = {
      type: 'skill',
      name: skillName,
      description: '',
      tags: [],
      version: '0.0.0',
      scope: 'project',
      platforms: { 'claude-code': null },
      path: '',
      dependencies: [],
    };

    const destPath = conventionsAdapter.getInstallPath(ext, 'project');
    const destDir = path.dirname(destPath);
    fs.mkdirSync(destDir, { recursive: true });
    fs.cpSync(srcDir, destDir, { recursive: true });

    reg.add({
      type: 'skill',
      name: skillName,
      version: '0.0.0',
      agent: 'agents-conventions',
      scope: 'project',
      path: destPath,
    });
  }
}

export async function disableConventions(
  targetAgent: AgentName,
  projectDir: string = process.cwd(),
  confirmDelete?: () => Promise<boolean>,
): Promise<void> {
  const config = loadConfig();

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

  // 1. Миграция расширений обратно в папку целевого агента
  for (const record of records) {
    // Пропускаем bootstrap-скиллы
    if (record.name === 'agents-conventions' || record.name === 'init-agents') continue;

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

  // 2. Удаление симлинков
  for (const s of SYMLINK_TARGETS) {
    const linkPath = path.join(projectDir, s.dir, s.link);
    if (fs.existsSync(linkPath)) {
      const stat = fs.lstatSync(linkPath);
      if (stat.isSymbolicLink()) {
        fs.unlinkSync(linkPath);
      }
    }
  }

  // 3. Удаление тонких указателей, созданных CLI
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

  // 4. Удаление bootstrap-скиллов
  const bootstrapSkills = ['agents-conventions', 'init-agents', 'exit-agents'];
  for (const skillName of bootstrapSkills) {
    const skillDir = path.join(projectDir, '.agents', 'skills', skillName);
    if (fs.existsSync(skillDir)) {
      fs.rmSync(skillDir, { recursive: true, force: true });
    }
    reg.remove(skillName, 'skill', 'agents-conventions');
  }

  // 5. Обновление конфига
  config.agent = targetAgent;
  saveConfig(config);

  // 6. Предложить удаление .agents/ и AGENTS.md
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
