import fs from 'fs';
import path from 'path';
import os from 'os';
import { Extension, ExtensionType } from '../catalog';
import { AgentAdapter, ScanResult } from './types';

function cursorRoot(scope: 'global' | 'project', projectDir: string, homeDir: string): string {
  return scope === 'global'
    ? path.join(homeDir, '.cursor')
    : path.join(projectDir, '.cursor');
}

export class CursorAdapter implements AgentAdapter {
  agentName = 'cursor' as const;

  constructor(
    private projectDir: string = process.cwd(),
    private homeDir: string = os.homedir()
  ) {}

  supportsType(_type: ExtensionType): boolean {
    return true;
  }

  getSourceFile(ext: Extension): string {
    return ext.platforms['cursor'] || 'CURSOR.md';
  }

  getInstallPath(ext: Extension, scope: 'global' | 'project'): string {
    const root = cursorRoot(scope, this.projectDir, this.homeDir);
    if (ext.type === 'skill') {
      return path.join(root, 'skills', ext.name, 'SKILL.md');
    }
    if (ext.type === 'agent') {
      return path.join(root, 'agents', `${ext.name}.mdc`);
    }
    if (ext.type === 'command') {
      return path.join(root, 'commands', `${ext.name}.mdc`);
    }
    throw new Error(`Неизвестный тип расширения: ${ext.type}`);
  }

  async install(ext: Extension, scope: 'global' | 'project', cachePath: string): Promise<void> {
    const sourceFile = this.getSourceFile(ext);
    const srcPath = path.join(cachePath, ext.path, sourceFile);
    const destPath = this.getInstallPath(ext, scope);

    if (!fs.existsSync(srcPath)) {
      throw new Error(`Cursor version not available for ${ext.name}: missing ${sourceFile}`);
    }

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
  }

  async remove(ext: Extension, scope: 'global' | 'project'): Promise<void> {
    const destPath = this.getInstallPath(ext, scope);
    if (ext.type === 'skill') {
      const dir = path.dirname(destPath);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
    } else if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath);
    }
  }

  isInstalled(ext: Extension, scope: 'global' | 'project'): boolean {
    return fs.existsSync(this.getInstallPath(ext, scope));
  }

  scanInstalled(): ScanResult[] {
    const results: ScanResult[] = [];

    const roots: Array<{ scope: 'global' | 'project'; root: string }> = [
      { scope: 'global', root: cursorRoot('global', this.projectDir, this.homeDir) },
      { scope: 'project', root: cursorRoot('project', this.projectDir, this.homeDir) },
    ];

    for (const { scope, root } of roots) {
      // Скиллы: .cursor/skills/{name}/SKILL.md
      const skillsDir = path.join(root, 'skills');
      if (fs.existsSync(skillsDir)) {
        for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
          if (fs.existsSync(skillFile)) {
            results.push({ type: 'skill', name: entry.name, scope, path: skillFile });
          }
        }
      }

      // Агенты: .cursor/agents/{name}.mdc
      const agentsDir = path.join(root, 'agents');
      if (fs.existsSync(agentsDir)) {
        for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
          if (entry.isFile() && entry.name.endsWith('.mdc')) {
            results.push({ type: 'agent', name: entry.name.slice(0, -4), scope, path: path.join(agentsDir, entry.name) });
          }
        }
      }

      // Команды: .cursor/commands/{name}.mdc
      const commandsDir = path.join(root, 'commands');
      if (fs.existsSync(commandsDir)) {
        for (const entry of fs.readdirSync(commandsDir, { withFileTypes: true })) {
          if (entry.isFile() && entry.name.endsWith('.mdc')) {
            results.push({ type: 'command', name: entry.name.slice(0, -4), scope, path: path.join(commandsDir, entry.name) });
          }
        }
      }
    }

    return results;
  }
}
