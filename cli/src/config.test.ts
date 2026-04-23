import fs from 'fs';
import path from 'path';
import os from 'os';

import {
  findProjectRoot,
  getProjectConfigPath,
  getProjectLocalConfigPath,
  loadProjectConfig,
  saveProjectConfig,
  loadProjectExtensions,
  saveProjectExtensions,
  hasProjectConfig,
  initProjectConfig,
  migrateOldProjectConfig,
  ensureProjectLocalConfig,
  ensureGitignore,
  ensureProjectConfig,
  loadConfig,
  ProjectPublicConfig,
  ProjectLocalConfig,
  ProjectExtensionRecord,
  SkillHubConfig,
} from './config';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-hub-config-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeJSON(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readJSON(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// --- Миграция ---

describe('migrateOldProjectConfig', () => {
  test('мигрирует старый формат в два файла', () => {
    const oldConfig = {
      settings: {
        agent: 'cursor',
        defaultScope: 'global',
        registryUrl: 'https://example.com/catalog.git',
        project: 'my-proj',
        aiAgents: {
          proxy: 'http://proxy:8080',
          agents: {
            'claude-code': { enabled: true, useProxy: false },
            'cursor': { enabled: false, useProxy: true },
            'copilot': { enabled: false, useProxy: false },
            'codex': { enabled: false, useProxy: false },
            'agents-conventions': { enabled: false, useProxy: false },
          },
        },
        history: { registryUrl: ['https://old.com'], proxy: [] },
      },
      extensions: [
        { type: 'skill', name: 'git-helper', version: '1.0.0', scope: 'project' },
      ],
    };
    writeJSON(path.join(tmpDir, '.skill-hub.json'), oldConfig);

    const result = migrateOldProjectConfig(tmpDir);
    expect(result).toBe(true);

    const publicData = readJSON(path.join(tmpDir, '.skill-hub.json')) as ProjectPublicConfig;
    expect(publicData.registryUrl).toBe('https://example.com/catalog.git');
    expect(publicData.project).toBe('my-proj');
    expect(publicData.extensions).toHaveLength(1);
    expect(publicData.extensions![0].name).toBe('git-helper');
    expect((publicData as any).settings).toBeUndefined();

    const localData = readJSON(path.join(tmpDir, '.skill-hub.local.json')) as ProjectLocalConfig;
    expect(localData.agent).toBe('cursor');
    expect(localData.defaultScope).toBe('global');
    expect(localData.aiAgents?.proxy).toBe('http://proxy:8080');
    expect(localData.history?.registryUrl).toEqual(['https://old.com']);
  });

  test('не мигрирует новый формат', () => {
    const newConfig: ProjectPublicConfig = {
      registryUrl: 'https://example.com/catalog.git',
      project: 'test',
      extensions: [],
    };
    writeJSON(path.join(tmpDir, '.skill-hub.json'), newConfig);

    const result = migrateOldProjectConfig(tmpDir);
    expect(result).toBe(false);
  });

  test('возвращает false если файл не существует', () => {
    expect(migrateOldProjectConfig(tmpDir)).toBe(false);
  });

  test('старый формат без extensions — сохраняет пустой массив', () => {
    writeJSON(path.join(tmpDir, '.skill-hub.json'), {
      settings: { agent: 'claude-code' },
    });

    migrateOldProjectConfig(tmpDir);

    const publicData = readJSON(path.join(tmpDir, '.skill-hub.json')) as ProjectPublicConfig;
    expect(publicData.extensions).toEqual([]);
  });
});

// --- ensureProjectLocalConfig ---

describe('ensureProjectLocalConfig', () => {
  test('создаёт локальный конфиг из глобального если только публичный существует', () => {
    writeJSON(path.join(tmpDir, '.skill-hub.json'), {
      registryUrl: 'https://example.com/catalog.git',
      extensions: [],
    });

    ensureProjectLocalConfig(tmpDir);

    const localPath = path.join(tmpDir, '.skill-hub.local.json');
    expect(fs.existsSync(localPath)).toBe(true);

    const localData = readJSON(localPath) as ProjectLocalConfig;
    expect(localData.agent).toBeDefined();
    expect(localData.defaultScope).toBeDefined();
  });

  test('не перезаписывает существующий локальный конфиг', () => {
    writeJSON(path.join(tmpDir, '.skill-hub.json'), { extensions: [] });
    writeJSON(path.join(tmpDir, '.skill-hub.local.json'), { agent: 'cursor' });

    ensureProjectLocalConfig(tmpDir);

    const localData = readJSON(path.join(tmpDir, '.skill-hub.local.json')) as ProjectLocalConfig;
    expect(localData.agent).toBe('cursor');
  });

  test('ничего не делает если публичного конфига нет', () => {
    ensureProjectLocalConfig(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, '.skill-hub.local.json'))).toBe(false);
  });
});

// --- ensureGitignore ---

describe('ensureGitignore', () => {
  test('создаёт .gitignore с записью если файл не существует', () => {
    ensureGitignore(tmpDir);

    const content = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf-8');
    expect(content.trim()).toBe('.skill-hub.local.json');
  });

  test('добавляет запись в существующий .gitignore', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules\n.env\n');

    ensureGitignore(tmpDir);

    const content = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf-8');
    expect(content).toContain('node_modules');
    expect(content).toContain('.skill-hub.local.json');
  });

  test('не дублирует запись', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), '.skill-hub.local.json\n');

    ensureGitignore(tmpDir);

    const content = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf-8');
    const count = content.split('.skill-hub.local.json').length - 1;
    expect(count).toBe(1);
  });

  test('добавляет перенос строки если файл не заканчивается на \\n', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules');

    ensureGitignore(tmpDir);

    const content = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf-8');
    expect(content).toBe('node_modules\n.skill-hub.local.json\n');
  });
});

// --- ensureProjectConfig ---

describe('ensureProjectConfig', () => {
  test('мигрирует старый формат + создаёт gitignore', () => {
    writeJSON(path.join(tmpDir, '.skill-hub.json'), {
      settings: { agent: 'cursor' },
      extensions: [{ type: 'skill', name: 'test', scope: 'project' }],
    });

    ensureProjectConfig(tmpDir);

    // Публичный — без settings
    const publicData = readJSON(path.join(tmpDir, '.skill-hub.json')) as any;
    expect(publicData.settings).toBeUndefined();
    expect(publicData.extensions).toHaveLength(1);

    // Локальный создан
    expect(fs.existsSync(path.join(tmpDir, '.skill-hub.local.json'))).toBe(true);

    // Gitignore создан
    const gitignore = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('.skill-hub.local.json');
  });

  test('идемпотентна — повторный вызов не ломает данные', () => {
    writeJSON(path.join(tmpDir, '.skill-hub.json'), {
      registryUrl: 'https://test.com',
      extensions: [{ type: 'skill', name: 'a', scope: 'project' }],
    });
    writeJSON(path.join(tmpDir, '.skill-hub.local.json'), { agent: 'copilot' });

    ensureProjectConfig(tmpDir);
    ensureProjectConfig(tmpDir);

    const publicData = readJSON(path.join(tmpDir, '.skill-hub.json')) as ProjectPublicConfig;
    expect(publicData.registryUrl).toBe('https://test.com');
    expect(publicData.extensions).toHaveLength(1);

    const localData = readJSON(path.join(tmpDir, '.skill-hub.local.json')) as ProjectLocalConfig;
    expect(localData.agent).toBe('copilot');
  });
});

// --- hasProjectConfig ---

describe('hasProjectConfig', () => {
  test('true если оба файла существуют', () => {
    writeJSON(path.join(tmpDir, '.skill-hub.json'), { extensions: [] });
    writeJSON(path.join(tmpDir, '.skill-hub.local.json'), { agent: 'claude-code' });

    expect(hasProjectConfig(tmpDir)).toBe(true);
  });

  test('false если только публичный существует', () => {
    writeJSON(path.join(tmpDir, '.skill-hub.json'), { extensions: [] });

    expect(hasProjectConfig(tmpDir)).toBe(false);
  });

  test('false если только локальный существует', () => {
    writeJSON(path.join(tmpDir, '.skill-hub.local.json'), { agent: 'claude-code' });

    expect(hasProjectConfig(tmpDir)).toBe(false);
  });

  test('false если ни одного файла нет', () => {
    expect(hasProjectConfig(tmpDir)).toBe(false);
  });
});

// --- loadProjectConfig ---

describe('loadProjectConfig', () => {
  test('читает данные из двух файлов и мержит', () => {
    writeJSON(path.join(tmpDir, '.skill-hub.json'), {
      registryUrl: 'https://custom.com/catalog.git',
      project: 'test-proj',
      extensions: [],
    });
    writeJSON(path.join(tmpDir, '.skill-hub.local.json'), {
      agent: 'cursor',
      defaultScope: 'global',
    });

    const config = loadProjectConfig(tmpDir);
    expect(config).not.toBeNull();
    expect(config!.registryUrl).toBe('https://custom.com/catalog.git');
    expect(config!.project).toBe('test-proj');
    expect(config!.agent).toBe('cursor');
    expect(config!.defaultScope).toBe('global');
  });

  test('автоматически мигрирует старый формат при загрузке', () => {
    writeJSON(path.join(tmpDir, '.skill-hub.json'), {
      settings: { agent: 'copilot', registryUrl: 'https://old.com' },
      extensions: [{ type: 'skill', name: 'x', scope: 'project' }],
    });

    const config = loadProjectConfig(tmpDir);
    expect(config).not.toBeNull();
    expect(config!.agent).toBe('copilot');
    expect(config!.registryUrl).toBe('https://old.com');

    // Файлы теперь в новом формате
    const publicData = readJSON(path.join(tmpDir, '.skill-hub.json')) as any;
    expect(publicData.settings).toBeUndefined();
  });

  test('null если публичный конфиг отсутствует', () => {
    expect(loadProjectConfig(tmpDir)).toBeNull();
  });
});

// --- saveProjectConfig ---

describe('saveProjectConfig', () => {
  test('разделяет config на два файла', () => {
    // Создаём начальный публичный с extensions
    writeJSON(path.join(tmpDir, '.skill-hub.json'), {
      extensions: [{ type: 'skill', name: 'existing', scope: 'project' }],
    });

    const config: SkillHubConfig = {
      agent: 'cursor',
      defaultScope: 'global',
      registryUrl: 'https://new.com/catalog.git',
      project: 'saved-proj',
      aiAgents: {
        proxy: 'http://proxy:1234',
        agents: {
          'claude-code': { enabled: true, useProxy: false },
          'cursor': { enabled: false, useProxy: false },
          'copilot': { enabled: false, useProxy: false },
          'codex': { enabled: false, useProxy: false },
          'agents-conventions': { enabled: false, useProxy: false },
        },
      },
    };

    saveProjectConfig(config, tmpDir);

    // Публичный: registryUrl + project + extensions (сохранены)
    const publicData = readJSON(path.join(tmpDir, '.skill-hub.json')) as ProjectPublicConfig;
    expect(publicData.registryUrl).toBe('https://new.com/catalog.git');
    expect(publicData.project).toBe('saved-proj');
    expect(publicData.extensions).toHaveLength(1);
    expect(publicData.extensions![0].name).toBe('existing');

    // Локальный: agent + defaultScope + aiAgents + history
    const localData = readJSON(path.join(tmpDir, '.skill-hub.local.json')) as ProjectLocalConfig;
    expect(localData.agent).toBe('cursor');
    expect(localData.defaultScope).toBe('global');
    expect(localData.aiAgents?.proxy).toBe('http://proxy:1234');

    // gitignore создан
    expect(fs.existsSync(path.join(tmpDir, '.gitignore'))).toBe(true);
  });
});

// --- loadProjectExtensions ---

describe('loadProjectExtensions', () => {
  test('читает extensions из публичного файла (новый формат)', () => {
    const exts: ProjectExtensionRecord[] = [
      { type: 'skill', name: 'a', version: '1.0.0', scope: 'project' },
      { type: 'command', name: 'b', scope: 'global' },
    ];
    writeJSON(path.join(tmpDir, '.skill-hub.json'), { extensions: exts });

    const result = loadProjectExtensions(tmpDir);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('a');
    expect(result[1].name).toBe('b');
  });

  test('пустой массив если файл не существует', () => {
    expect(loadProjectExtensions(tmpDir)).toEqual([]);
  });

  test('пустой массив если extensions отсутствует в файле', () => {
    writeJSON(path.join(tmpDir, '.skill-hub.json'), { registryUrl: 'x' });
    expect(loadProjectExtensions(tmpDir)).toEqual([]);
  });
});

// --- saveProjectExtensions ---

describe('saveProjectExtensions', () => {
  test('сохраняет extensions в публичный файл, не затрагивая другие поля', () => {
    writeJSON(path.join(tmpDir, '.skill-hub.json'), {
      registryUrl: 'https://keep.com',
      project: 'keep-proj',
      extensions: [],
    });

    const exts: ProjectExtensionRecord[] = [
      { type: 'skill', name: 'new-ext', version: '2.0.0', scope: 'project' },
    ];
    saveProjectExtensions(exts, tmpDir);

    const data = readJSON(path.join(tmpDir, '.skill-hub.json')) as ProjectPublicConfig;
    expect(data.registryUrl).toBe('https://keep.com');
    expect(data.project).toBe('keep-proj');
    expect(data.extensions).toHaveLength(1);
    expect(data.extensions![0].name).toBe('new-ext');
  });
});

// --- initProjectConfig ---

describe('initProjectConfig', () => {
  test('создаёт оба файла + gitignore', () => {
    // Создаём .git чтобы findProjectRoot нашёл корень
    jest.spyOn(require('./config'), 'findProjectRoot').mockReturnValue(tmpDir);

    // Прямой вызов с projectRoot не проходит через findProjectRoot,
    // но initProjectConfig использует findProjectRoot. Тестируем через мок.
    // Альтернативно — создаём маркер для findProjectRoot.
    fs.mkdirSync(path.join(tmpDir, '.git'));

    // Сохраняем/восстанавливаем cwd
    const origCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      const result = initProjectConfig();
      expect(result).toBe(true);

      expect(fs.existsSync(path.join(tmpDir, '.skill-hub.json'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, '.skill-hub.local.json'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, '.gitignore'))).toBe(true);

      const publicData = readJSON(path.join(tmpDir, '.skill-hub.json')) as ProjectPublicConfig;
      expect(publicData.extensions).toEqual([]);
      expect(publicData.registryUrl).toBeDefined();

      const localData = readJSON(path.join(tmpDir, '.skill-hub.local.json')) as ProjectLocalConfig;
      expect(localData.agent).toBeDefined();

      // Повторный вызов — false (файлы уже есть)
      const result2 = initProjectConfig();
      expect(result2).toBe(false);
    } finally {
      process.chdir(origCwd);
    }
  });
});
