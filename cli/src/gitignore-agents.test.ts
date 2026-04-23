import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  AGENT_GITIGNORE_ENTRIES,
  getExistingAgentEntries,
  getMissingGitignoreEntries,
  addAgentDirsToGitignore,
} from './gitignore-agents';

describe('gitignore-agents', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitignore-agents-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('AGENT_GITIGNORE_ENTRIES', () => {
    it('содержит все ожидаемые записи', () => {
      expect(AGENT_GITIGNORE_ENTRIES).toContain('.claude/');
      expect(AGENT_GITIGNORE_ENTRIES).toContain('.cursor/');
      expect(AGENT_GITIGNORE_ENTRIES).toContain('.github/');
      expect(AGENT_GITIGNORE_ENTRIES).toContain('.codex/');
      expect(AGENT_GITIGNORE_ENTRIES).toContain('.agents/');
      expect(AGENT_GITIGNORE_ENTRIES).toContain('.cursorrules');
    });
  });

  describe('getExistingAgentEntries', () => {
    it('возвращает пустой массив если нет агентских элементов', () => {
      expect(getExistingAgentEntries(tmpDir)).toEqual([]);
    });

    it('находит существующие директории', () => {
      fs.mkdirSync(path.join(tmpDir, '.claude'));
      fs.mkdirSync(path.join(tmpDir, '.cursor'));
      const result = getExistingAgentEntries(tmpDir);
      expect(result).toContain('.claude/');
      expect(result).toContain('.cursor/');
      expect(result).not.toContain('.codex/');
    });

    it('находит файл .cursorrules', () => {
      fs.writeFileSync(path.join(tmpDir, '.cursorrules'), 'rules');
      const result = getExistingAgentEntries(tmpDir);
      expect(result).toContain('.cursorrules');
    });

    it('не считает файл директорией', () => {
      fs.writeFileSync(path.join(tmpDir, '.claude'), 'not a dir');
      const result = getExistingAgentEntries(tmpDir);
      expect(result).not.toContain('.claude/');
    });
  });

  describe('getMissingGitignoreEntries', () => {
    it('возвращает пустой массив если нет агентских элементов', () => {
      expect(getMissingGitignoreEntries(tmpDir)).toEqual([]);
    });

    it('возвращает все существующие если .gitignore нет', () => {
      fs.mkdirSync(path.join(tmpDir, '.claude'));
      fs.mkdirSync(path.join(tmpDir, '.agents'));
      const result = getMissingGitignoreEntries(tmpDir);
      expect(result).toContain('.claude/');
      expect(result).toContain('.agents/');
    });

    it('не возвращает записи, уже присутствующие в .gitignore', () => {
      fs.mkdirSync(path.join(tmpDir, '.claude'));
      fs.mkdirSync(path.join(tmpDir, '.cursor'));
      fs.writeFileSync(path.join(tmpDir, '.gitignore'), '.claude/\n');
      const result = getMissingGitignoreEntries(tmpDir);
      expect(result).not.toContain('.claude/');
      expect(result).toContain('.cursor/');
    });

    it('запись без слеша покрывает вариант со слешем', () => {
      fs.mkdirSync(path.join(tmpDir, '.claude'));
      fs.writeFileSync(path.join(tmpDir, '.gitignore'), '.claude\n');
      const result = getMissingGitignoreEntries(tmpDir);
      expect(result).not.toContain('.claude/');
    });

    it('игнорирует комментарии и пустые строки в .gitignore', () => {
      fs.mkdirSync(path.join(tmpDir, '.claude'));
      fs.writeFileSync(path.join(tmpDir, '.gitignore'), '# .claude/\n\n');
      const result = getMissingGitignoreEntries(tmpDir);
      expect(result).toContain('.claude/');
    });
  });

  describe('addAgentDirsToGitignore', () => {
    it('не делает ничего при пустом списке', () => {
      addAgentDirsToGitignore(tmpDir, []);
      expect(fs.existsSync(path.join(tmpDir, '.gitignore'))).toBe(false);
    });

    it('создаёт .gitignore если его нет', () => {
      addAgentDirsToGitignore(tmpDir, ['.claude/', '.cursor/']);
      const content = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf-8');
      expect(content).toContain('# AI agent directories (skill-hub)');
      expect(content).toContain('.claude/');
      expect(content).toContain('.cursor/');
    });

    it('добавляет секцию в существующий .gitignore', () => {
      fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules/\n');
      addAgentDirsToGitignore(tmpDir, ['.claude/']);
      const content = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf-8');
      expect(content).toContain('node_modules/');
      expect(content).toContain('# AI agent directories (skill-hub)');
      expect(content).toContain('.claude/');
    });

    it('добавляет записи в существующую секцию skill-hub', () => {
      const initial = '# AI agent directories (skill-hub)\n.claude/\n';
      fs.writeFileSync(path.join(tmpDir, '.gitignore'), initial);
      addAgentDirsToGitignore(tmpDir, ['.cursor/', '.claude/']);
      const content = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf-8');
      expect(content).toContain('.cursor/');
      // .claude/ уже была, не должна дублироваться
      const matches = content.match(/\.claude\//g);
      expect(matches).toHaveLength(1);
    });

    it('не дублирует записи', () => {
      fs.writeFileSync(path.join(tmpDir, '.gitignore'), '.claude/\n');
      addAgentDirsToGitignore(tmpDir, ['.claude/']);
      const content = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf-8');
      const matches = content.match(/\.claude\//g);
      expect(matches).toHaveLength(1);
    });

    it('обрабатывает .gitignore без завершающего newline', () => {
      fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules/');
      addAgentDirsToGitignore(tmpDir, ['.claude/']);
      const content = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf-8');
      expect(content).toContain('node_modules/');
      expect(content).toContain('.claude/');
      // Убедимся, что записи на разных строках
      expect(content).not.toContain('node_modules/.claude/');
    });
  });
});
