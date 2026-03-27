import fs from 'fs';
import path from 'path';
import os from 'os';
import { Extension, ExtensionType } from '../catalog';
import { AgentAdapter } from './types';

export class ClaudeCodeAdapter implements AgentAdapter {
  agentName = 'claude-code' as const;

  constructor(
    private projectDir: string = process.cwd(),
    private homeDir: string = os.homedir()
  ) {}

  supportsType(_type: ExtensionType): boolean {
    return true;
  }

  getSourceFile(ext: Extension): string {
    return ext.platforms['claude-code'] ||
      (ext.type === 'agent' ? 'AGENT.md' : ext.type === 'command' ? 'COMMAND.md' : 'SKILL.md');
  }

  getInstallPath(ext: Extension, scope: 'global' | 'project'): string {
    const base = scope === 'global'
      ? path.join(this.homeDir, '.claude')
      : path.join(this.projectDir, '.claude');

    if (ext.type === 'skill') {
      return path.join(base, 'skills', ext.name, 'SKILL.md');
    } else if (ext.type === 'agent') {
      return path.join(base, 'agents', `${ext.name}.md`);
    } else {
      return path.join(this.projectDir, '.claude', 'commands', `${ext.name}.md`);
    }
  }

  async install(ext: Extension, scope: 'global' | 'project', cachePath: string): Promise<void> {
    const sourceFile = this.getSourceFile(ext);
    const srcPath = path.join(cachePath, ext.path, sourceFile);
    const destPath = this.getInstallPath(ext, scope);

    if (!fs.existsSync(srcPath)) {
      throw new Error(`Source file not found: ${srcPath}`);
    }

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
  }

  async remove(ext: Extension, scope: 'global' | 'project'): Promise<void> {
    const destPath = this.getInstallPath(ext, scope);
    if (ext.type === 'skill') {
      const dir = path.dirname(destPath);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
    } else {
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
    }
  }

  isInstalled(ext: Extension, scope: 'global' | 'project'): boolean {
    return fs.existsSync(this.getInstallPath(ext, scope));
  }
}
