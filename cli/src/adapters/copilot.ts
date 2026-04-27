/**
 * Адаптер Copilot — встраивает расширения в copilot-instructions.md через HTML-маркеры.
 * Каждая секция обёрнута: `<!-- skill-hub: {name} -->` / `<!-- /skill-hub: {name} -->`
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Extension, ExtensionType } from '../catalog';
import { AgentAdapter, ScanResult } from './types';
import { stripFrontmatter } from '../frontmatter';
import { copyAdditionalFiles, hasAdditionalFiles, getExtensionDirRel } from '../multi-file';

// Маркеры начала/конца секции расширения внутри copilot-instructions.md
const MARKER_START = (name: string) => `<!-- skill-hub: ${name} -->`;
const MARKER_END = (name: string) => `<!-- /skill-hub: ${name} -->`;

export class CopilotAdapter implements AgentAdapter {
  agentName = 'copilot' as const;

  constructor(
    private projectDir: string = process.cwd(),
    private homeDir: string = os.homedir()
  ) {}

  supportsType(_type: ExtensionType): boolean {
    return true;
  }

  getSourceFile(ext: Extension): string {
    return ext.platforms['copilot'] || 'SKILL.md';
  }

  getInstallPath(_ext: Extension, scope: 'global' | 'project'): string {
    if (scope === 'project') {
      return path.join(this.projectDir, '.github', 'copilot-instructions.md');
    }
    const vscodePath = process.platform === 'darwin'
      ? path.join(this.homeDir, 'Library', 'Application Support', 'Code', 'User')
      : process.platform === 'win32'
        ? path.join(process.env.APPDATA || path.join(this.homeDir, 'AppData', 'Roaming'), 'Code', 'User')
        : path.join(this.homeDir, '.config', 'Code', 'User');
    return path.join(vscodePath, 'copilot-instructions.md');
  }

  async install(ext: Extension, scope: 'global' | 'project', cachePath: string): Promise<void> {
    const sourceFile = this.getSourceFile(ext);
    const srcDir = path.join(cachePath, getExtensionDirRel(ext.path));
    const srcPath = path.join(srcDir, sourceFile);

    if (!fs.existsSync(srcPath)) {
      throw new Error(`Copilot version not available for ${ext.name}: missing ${sourceFile}`);
    }

    const content = stripFrontmatter(fs.readFileSync(srcPath, 'utf-8'));
    const destPath = this.getInstallPath(ext, scope);

    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    // Копирование дополнительных файлов
    const hasExtra = hasAdditionalFiles(ext.path, cachePath);
    if (hasExtra) {
      const additionalDir = this.getAdditionalFilesPath(ext, scope);
      copyAdditionalFiles(srcDir, additionalDir, sourceFile);
    }

    // Marker-injection с указанием пути к дополнительным файлам
    const existing = fs.existsSync(destPath) ? fs.readFileSync(destPath, 'utf-8') : '';
    const cleaned = this.removeSection(existing, ext.name);
    const filesComment = hasExtra
      ? `\n<!-- additional files: ${this.getAdditionalFilesRelPath(ext, scope)} -->`
      : '';
    const section = `\n${MARKER_START(ext.name)}${filesComment}\n${content}\n${MARKER_END(ext.name)}\n`;
    fs.writeFileSync(destPath, cleaned + section);
  }

  /** Путь к директории дополнительных файлов расширения */
  getAdditionalFilesPath(ext: Extension, scope: 'global' | 'project'): string {
    if (scope === 'project') {
      return path.join(this.projectDir, '.github', 'skills', ext.name);
    }
    return path.join(path.dirname(this.getInstallPath(ext, scope)), 'skills', ext.name);
  }

  /** Относительный путь к доп. файлам (для комментария в marker-injection) */
  private getAdditionalFilesRelPath(ext: Extension, scope: 'global' | 'project'): string {
    if (scope === 'project') {
      return `.github/skills/${ext.name}/`;
    }
    return `skills/${ext.name}/`;
  }

  async remove(ext: Extension, scope: 'global' | 'project'): Promise<void> {
    // Удалить marker-секцию из copilot-instructions.md
    const destPath = this.getInstallPath(ext, scope);
    if (fs.existsSync(destPath)) {
      const content = fs.readFileSync(destPath, 'utf-8');
      fs.writeFileSync(destPath, this.removeSection(content, ext.name));
    }

    // Удалить директорию дополнительных файлов
    const additionalDir = this.getAdditionalFilesPath(ext, scope);
    if (fs.existsSync(additionalDir)) {
      fs.rmSync(additionalDir, { recursive: true });
    }
  }

  isInstalled(ext: Extension, scope: 'global' | 'project'): boolean {
    const destPath = this.getInstallPath(ext, scope);
    if (!fs.existsSync(destPath)) return false;
    return fs.readFileSync(destPath, 'utf-8').includes(MARKER_START(ext.name));
  }

  scanInstalled(): ScanResult[] {
    const results: ScanResult[] = [];
    const MARKER_RE = /<!-- skill-hub: ([\w-]+) -->/g;

    for (const scope of ['global', 'project'] as const) {
      const filePath = this.getInstallPath({} as Extension, scope);
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf-8');
      MARKER_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = MARKER_RE.exec(content)) !== null) {
        results.push({ type: 'skill', name: match[1], scope, path: filePath });
      }
    }

    const copilotNames = new Set(results.map(r => `${r.name}:${r.scope}`));

    for (const scope of ['global', 'project'] as const) {
      const base = scope === 'global'
        ? path.join(this.homeDir, '.claude')
        : path.join(this.projectDir, '.claude');
      const skillsDir = path.join(base, 'skills');
      if (!fs.existsSync(skillsDir)) continue;
      for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
        if (!fs.existsSync(skillFile)) continue;
        if (copilotNames.has(`${entry.name}:${scope}`)) continue;
        results.push({ type: 'skill', name: entry.name, scope, path: skillFile });
      }
    }

    return results;
  }

  /** Удаляет секцию по indexOf маркеров: вырезает текст от start-маркера до конца end-маркера */
  private removeSection(content: string, name: string): string {
    const start = MARKER_START(name);
    const end = MARKER_END(name);
    const startIdx = content.indexOf(start);
    const endIdx = content.indexOf(end);
    if (startIdx === -1) return content;
    return content.slice(0, startIdx) + content.slice(endIdx + end.length);
  }
}
