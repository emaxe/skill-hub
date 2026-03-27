import fs from 'fs';
import path from 'path';
import os from 'os';
import { Extension, ExtensionType } from '../catalog';
import { AgentAdapter, ScanResult } from './types';

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

  scanInstalled(): ScanResult[] {
    const results: ScanResult[] = [];

    for (const scope of ['global', 'project'] as const) {
      const base = scope === 'global'
        ? path.join(this.homeDir, '.claude')
        : path.join(this.projectDir, '.claude');

      const skillsDir = path.join(base, 'skills');
      if (fs.existsSync(skillsDir)) {
        for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
            if (fs.existsSync(skillFile)) {
              results.push({ type: 'skill', name: entry.name, scope, path: skillFile });
            }
          }
        }
      }

      const agentsDir = path.join(base, 'agents');
      if (fs.existsSync(agentsDir)) {
        for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
          if (entry.isFile() && entry.name.endsWith('.md')) {
            results.push({ type: 'agent', name: entry.name.slice(0, -3), scope, path: path.join(agentsDir, entry.name) });
          }
        }
      }

      const commandsDir = path.join(base, 'commands');
      if (fs.existsSync(commandsDir)) {
        for (const entry of fs.readdirSync(commandsDir, { withFileTypes: true })) {
          if (entry.isFile() && entry.name.endsWith('.md')) {
            results.push({ type: 'command', name: entry.name.slice(0, -3), scope, path: path.join(commandsDir, entry.name) });
          }
        }
      }
    }

    return results;
  }
}
