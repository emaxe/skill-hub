/**
 * Адаптер Claude Code — ~/.claude/ (global), .claude/ (project).
 * Структура: skills/{name}/SKILL.md, agents/{name}.md, commands/{name}.md
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Extension, ExtensionType } from '../catalog';
import { AgentAdapter, ScanResult } from './types';
import { pathsEqual } from '../platform';
import { copyExtensionDir, getExtensionDirRel } from '../multi-file';
import {
  getClaudeSettingsPath,
  readClaudeSettings,
  writeClaudeSettings,
  generateHookAggregator,
  getClaudeSkillsDir,
} from './settings-json';

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
      // Агенты/команды: копировать один файл (с переименованием)
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
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

  // Трёхфазный скан: 1) global (~/.claude/), 2) project (.claude/), 3) parent walk (от projectDir вверх до homeDir)
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

    // Обход родительских директорий от projectDir вверх до homeDir (не включая)
    const homeNorm = path.resolve(this.homeDir);
    const projectNorm = path.resolve(this.projectDir);
    // Дедупликация: пропускаем расширения, уже найденные в global/project
    const seen = new Set(results.map(r => `${r.type}:${r.name}`));
    let dir = path.dirname(projectNorm);

    // pathsEqual — case-insensitive на Windows (C:\Users\John ≠ c:\users\john)
    while (!pathsEqual(dir, homeNorm) && dir !== path.dirname(dir)) {
      const base = path.join(dir, '.claude');

      const skillsDir = path.join(base, 'skills');
      if (fs.existsSync(skillsDir)) {
        for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            const key = `skill:${entry.name}`;
            if (!seen.has(key)) {
              const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
              if (fs.existsSync(skillFile)) {
                results.push({ type: 'skill', name: entry.name, scope: 'parent', path: skillFile });
                seen.add(key);
              }
            }
          }
        }
      }

      const agentsDir = path.join(base, 'agents');
      if (fs.existsSync(agentsDir)) {
        for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
          if (entry.isFile() && entry.name.endsWith('.md')) {
            const name = entry.name.slice(0, -3);
            const key = `agent:${name}`;
            if (!seen.has(key)) {
              results.push({ type: 'agent', name, scope: 'parent', path: path.join(agentsDir, entry.name) });
              seen.add(key);
            }
          }
        }
      }

      const commandsDir = path.join(base, 'commands');
      if (fs.existsSync(commandsDir)) {
        for (const entry of fs.readdirSync(commandsDir, { withFileTypes: true })) {
          if (entry.isFile() && entry.name.endsWith('.md')) {
            const name = entry.name.slice(0, -3);
            const key = `command:${name}`;
            if (!seen.has(key)) {
              results.push({ type: 'command', name, scope: 'parent', path: path.join(commandsDir, entry.name) });
              seen.add(key);
            }
          }
        }
      }

      dir = path.dirname(dir);
    }

    return results;
  }

  supportsRuntimeHooks = true;

  async installHooks(ext: Extension, scope: 'global' | 'project', cachePath: string): Promise<void> {
    const agentHooks = ext.hooks?.agentHooks?.['claude-code'];
    if (!agentHooks || Object.keys(agentHooks).length === 0) return;

    const srcDir = path.join(cachePath, getExtensionDirRel(ext.path));
    const skillsDir = getClaudeSkillsDir(scope, this.projectDir, this.homeDir);
    const skillHooksDir = path.join(skillsDir, ext.name, 'hooks');
    const aggregatorDir = path.join(os.homedir(), '.skill-hub', 'hooks');

    for (const [hookName, hookFile] of Object.entries(agentHooks)) {
      const srcHookPath = path.join(srcDir, hookFile);
      if (!fs.existsSync(srcHookPath)) {
        throw new Error(`Hook file not found: ${srcHookPath}`);
      }
      const destHookName = hookName + path.extname(hookFile);
      const destHookPath = path.join(skillHooksDir, destHookName);
      fs.mkdirSync(skillHooksDir, { recursive: true });
      fs.copyFileSync(srcHookPath, destHookPath);

      // Агрегирующий скрипт
      const aggregatorPath = path.join(aggregatorDir, `claude-code-${scope}-${hookName}.js`);
      fs.mkdirSync(aggregatorDir, { recursive: true });
      fs.writeFileSync(aggregatorPath, generateHookAggregator(hookName, skillsDir));

      // Обновить settings.json
      const settings = readClaudeSettings(scope, this.projectDir, this.homeDir);
      settings[hookName] = `node ${aggregatorPath}`;
      writeClaudeSettings(scope, settings, this.projectDir, this.homeDir);
    }
  }

  async removeHooks(ext: Extension, scope: 'global' | 'project'): Promise<void> {
    const skillsDir = getClaudeSkillsDir(scope, this.projectDir, this.homeDir);
    const skillHooksDir = path.join(skillsDir, ext.name, 'hooks');
    if (!fs.existsSync(skillHooksDir)) return;

    // Запоминаем какие hookName были у этого скилла
    const hookNames = new Set<string>();
    for (const entry of fs.readdirSync(skillHooksDir, { withFileTypes: true })) {
      if (entry.isFile()) {
        hookNames.add(path.basename(entry.name, path.extname(entry.name)));
      }
    }

    fs.rmSync(skillHooksDir, { recursive: true });

    const aggregatorDir = path.join(os.homedir(), '.skill-hub', 'hooks');
    const settings = readClaudeSettings(scope, this.projectDir, this.homeDir);
    let settingsChanged = false;

    for (const hookName of hookNames) {
      // Проверяем, остались ли другие скиллы с этим hook
      let hasOther = false;
      if (fs.existsSync(skillsDir)) {
        for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
          if (!entry.isDirectory() || entry.name === ext.name) continue;
          const otherHookDir = path.join(skillsDir, entry.name, 'hooks');
          if (!fs.existsSync(otherHookDir)) continue;
          for (const f of fs.readdirSync(otherHookDir)) {
            if (path.basename(f, path.extname(f)) === hookName) {
              hasOther = true;
              break;
            }
          }
          if (hasOther) break;
        }
      }

      if (!hasOther) {
        delete settings[hookName];
        settingsChanged = true;
        const aggregatorPath = path.join(aggregatorDir, `claude-code-${scope}-${hookName}.js`);
        if (fs.existsSync(aggregatorPath)) {
          fs.unlinkSync(aggregatorPath);
        }
      }
    }

    if (settingsChanged) {
      writeClaudeSettings(scope, settings, this.projectDir, this.homeDir);
    }
  }
}
