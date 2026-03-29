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

/** .mdc файлы из rules/ при сканировании получают тип 'rule'.
 *  Registry-записи имеют приоритет и сохраняют свой тип (agent/command). */

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
    return path.join(root, 'rules', `${ext.name}.mdc`);
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

      const rulesDir = path.join(root, 'rules');
      if (!fs.existsSync(rulesDir)) continue;
      for (const entry of fs.readdirSync(rulesDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.mdc')) continue;
        const filePath = path.join(rulesDir, entry.name);
        const name = entry.name.slice(0, -4);
        results.push({ type: 'rule', name, scope, path: filePath });
      }
    }

    return results;
  }
}
