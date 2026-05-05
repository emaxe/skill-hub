/**
 * Адаптер agents-conventions — project-only scope, .agents/ директория.
 * Использует source-файлы от claude-code адаптера (SKILL.md, AGENT.md, COMMAND.md).
 * Global scope не поддерживается — выбрасывает ошибку.
 */
import fs from 'fs';
import path from 'path';
import { Extension, ExtensionType } from '../catalog';
import { AgentAdapter, ScanResult } from './types';
import { copyExtensionDir, getExtensionDirRel } from '../multi-file';

export class AgentsConventionsAdapter implements AgentAdapter {
  agentName = 'agents-conventions' as const;

  constructor(
    private projectDir: string = process.cwd(),
  ) {}

  supportsType(_type: ExtensionType): boolean {
    return true;
  }

  getSourceFile(ext: Extension): string {
    // Используем source-файлы от claude-code
    return ext.platforms['claude-code'] ||
      (ext.type === 'agent' ? 'AGENT.md' : ext.type === 'command' ? 'COMMAND.md' : 'SKILL.md');
  }

  getInstallPath(ext: Extension, scope: 'global' | 'project'): string {
    if (scope === 'global') {
      throw new Error('agents-conventions поддерживает только project scope');
    }

    const base = path.join(this.projectDir, '.agents');

    if (ext.type === 'skill') {
      return path.join(base, 'skills', ext.name, 'SKILL.md');
    }
    if (ext.type === 'agent') {
      return path.join(base, 'agents', `${ext.name}.md`);
    }
    if (ext.type === 'command') {
      return path.join(base, 'commands', `${ext.name}.md`);
    }
    throw new Error(`Неизвестный тип расширения: ${ext.type}`);
  }

  async install(ext: Extension, scope: 'global' | 'project', cachePath: string): Promise<void> {
    if (scope === 'global') {
      throw new Error('agents-conventions поддерживает только project scope');
    }

    const sourceFile = this.getSourceFile(ext);
    const srcDir = path.join(cachePath, getExtensionDirRel(ext.path));
    const srcPath = path.join(srcDir, sourceFile);
    const destPath = this.getInstallPath(ext, scope);

    if (!fs.existsSync(srcPath)) {
      throw new Error(`Source file not found: ${srcPath}`);
    }

    if (ext.type === 'skill') {
      // Скиллы: копировать всю директорию (основной файл + дополнительные)
      copyExtensionDir(srcDir, path.dirname(destPath));
    } else {
      // Агенты/команды: копировать один файл
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
  }

  async remove(ext: Extension, scope: 'global' | 'project'): Promise<void> {
    if (scope === 'global') {
      throw new Error('agents-conventions поддерживает только project scope');
    }

    const destPath = this.getInstallPath(ext, scope);
    if (ext.type === 'skill') {
      const dir = path.dirname(destPath);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
    } else {
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
    }
  }

  isInstalled(ext: Extension, scope: 'global' | 'project'): boolean {
    if (scope === 'global') return false;
    return fs.existsSync(this.getInstallPath(ext, scope));
  }

  scanInstalled(): ScanResult[] {
    const results: ScanResult[] = [];
    const base = path.join(this.projectDir, '.agents');

    // Скиллы: .agents/skills/{name}/SKILL.md
    const skillsDir = path.join(base, 'skills');
    if (fs.existsSync(skillsDir)) {
      for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
        if (entry.isDirectory() || (entry.isSymbolicLink && entry.isSymbolicLink())) {
          const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
          if (fs.existsSync(skillFile)) {
            results.push({ type: 'skill', name: entry.name, scope: 'project', path: skillFile });
          }
        }
      }
    }

    // Агенты: .agents/agents/{name}.md
    const agentsDir = path.join(base, 'agents');
    if (fs.existsSync(agentsDir)) {
      for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
        if ((entry.isFile() || (entry.isSymbolicLink && entry.isSymbolicLink())) && entry.name.endsWith('.md')) {
          results.push({ type: 'agent', name: entry.name.slice(0, -3), scope: 'project', path: path.join(agentsDir, entry.name) });
        }
      }
    }

    // Команды: .agents/commands/{name}.md
    const commandsDir = path.join(base, 'commands');
    if (fs.existsSync(commandsDir)) {
      for (const entry of fs.readdirSync(commandsDir, { withFileTypes: true })) {
        if ((entry.isFile() || (entry.isSymbolicLink && entry.isSymbolicLink())) && entry.name.endsWith('.md')) {
          results.push({ type: 'command', name: entry.name.slice(0, -3), scope: 'project', path: path.join(commandsDir, entry.name) });
        }
      }
    }

    return results;
  }
}
