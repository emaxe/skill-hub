import fs from 'fs';
import path from 'path';
import os from 'os';
import { Extension, ExtensionType } from '../catalog';
import { AgentAdapter } from './types';

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
    const base = scope === 'global'
      ? path.join(this.homeDir, '.cursor', 'rules')
      : path.join(this.projectDir, '.cursor', 'rules');
    return path.join(base, `${ext.name}.mdc`);
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
    if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
  }

  isInstalled(ext: Extension, scope: 'global' | 'project'): boolean {
    return fs.existsSync(this.getInstallPath(ext, scope));
  }
}
