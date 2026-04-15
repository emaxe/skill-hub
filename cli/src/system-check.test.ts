import { SpawnSyncReturns } from 'child_process';

jest.mock('child_process');

const ORIGINAL_PLATFORM = process.platform;

function setPlatform(p: string) {
  Object.defineProperty(process, 'platform', { value: p, configurable: true });
}

function setNodeVersion(v: string) {
  Object.defineProperty(process, 'version', { value: v, configurable: true });
}

/** Загружает system-check и настраивает мок spawnSync внутри одного реестра модулей */
function loadModule(spawnResult: Partial<SpawnSyncReturns<Buffer>> | null = null) {
  let mod: typeof import('./system-check');
  jest.isolateModules(() => {
    const cp = require('child_process') as { spawnSync: jest.Mock };
    if (spawnResult !== null) {
      cp.spawnSync.mockReturnValue(spawnResult);
    }
    mod = require('./system-check');
  });
  return mod!;
}

const gitOk: Partial<SpawnSyncReturns<Buffer>> = { status: 0, error: undefined };
const gitMissing: Partial<SpawnSyncReturns<Buffer>> = { status: 127, error: new Error('ENOENT') };

beforeEach(() => {
  delete process.env.SKILL_HUB_SKIP_CHECKS;
  jest.resetModules();
});

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: ORIGINAL_PLATFORM, configurable: true });
});

describe('SKILL_HUB_SKIP_CHECKS=1', () => {
  it('возвращает пустой массив и не вызывает spawnSync', () => {
    process.env.SKILL_HUB_SKIP_CHECKS = '1';
    let spawnCalled = false;
    let mod: typeof import('./system-check');
    jest.isolateModules(() => {
      const cp = require('child_process') as { spawnSync: jest.Mock };
      cp.spawnSync.mockImplementation(() => { spawnCalled = true; return gitOk; });
      mod = require('./system-check');
    });
    expect(mod!.checkSystemDependencies()).toHaveLength(0);
    expect(spawnCalled).toBe(false);
  });
});

describe('git', () => {
  beforeEach(() => setNodeVersion('v20.0.0'));

  it('не возвращает ошибку если git установлен', () => {
    const { checkSystemDependencies } = loadModule(gitOk);
    expect(checkSystemDependencies().find(e => e.name === 'git')).toBeUndefined();
  });

  it('возвращает ошибку если git вернул ненулевой статус', () => {
    const { checkSystemDependencies } = loadModule({ status: 127, error: undefined });
    const err = checkSystemDependencies().find(e => e.name === 'git');
    expect(err).toBeDefined();
    expect(err?.ok).toBe(false);
    expect(err?.installInstructions).toBeTruthy();
  });

  it('возвращает ошибку если spawnSync выбросил error', () => {
    const { checkSystemDependencies } = loadModule(gitMissing);
    expect(checkSystemDependencies().find(e => e.name === 'git')).toBeDefined();
  });

  it('инструкции содержат brew install git на macOS', () => {
    setPlatform('darwin');
    const { checkSystemDependencies } = loadModule(gitMissing);
    const err = checkSystemDependencies().find(e => e.name === 'git');
    expect(err?.installInstructions).toContain('brew install git');
  });

  it('инструкции содержат winget на Windows', () => {
    setPlatform('win32');
    const { checkSystemDependencies } = loadModule(gitMissing);
    const err = checkSystemDependencies().find(e => e.name === 'git');
    expect(err?.installInstructions).toContain('winget install Git.Git');
  });

  it('инструкции содержат apt install git на Linux', () => {
    setPlatform('linux');
    const { checkSystemDependencies } = loadModule(gitMissing);
    const err = checkSystemDependencies().find(e => e.name === 'git');
    expect(err?.installInstructions).toContain('sudo apt install git');
  });
});

describe('Node.js версия', () => {
  it('не возвращает ошибку при Node.js 18', () => {
    setNodeVersion('v18.0.0');
    const { checkSystemDependencies } = loadModule(gitOk);
    expect(checkSystemDependencies().find(e => e.name.includes('Node'))).toBeUndefined();
  });

  it('не возвращает ошибку при Node.js 20', () => {
    setNodeVersion('v20.11.0');
    const { checkSystemDependencies } = loadModule(gitOk);
    expect(checkSystemDependencies().find(e => e.name.includes('Node'))).toBeUndefined();
  });

  it('возвращает ошибку при Node.js 16', () => {
    setNodeVersion('v16.20.0');
    const { checkSystemDependencies } = loadModule(gitOk);
    const err = checkSystemDependencies().find(e => e.name.includes('Node'));
    expect(err).toBeDefined();
    expect(err?.ok).toBe(false);
    expect(err?.installInstructions).toBeTruthy();
  });
});

describe('printDependencyErrors', () => {
  it('возвращает false если нет ошибок', () => {
    const { printDependencyErrors } = loadModule(gitOk);
    expect(printDependencyErrors([])).toBe(false);
  });

  it('возвращает true и пишет в stderr если есть ошибки', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { printDependencyErrors } = loadModule(gitOk);
    const result = printDependencyErrors([{ name: 'git', ok: false, installInstructions: 'brew install git' }]);
    expect(result).toBe(true);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
