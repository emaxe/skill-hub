import path from 'path';
import os from 'os';

// Сохраняем оригинальное значение для восстановления
const ORIGINAL_PLATFORM = process.platform;

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: ORIGINAL_PLATFORM });
  delete process.env.APPDATA;
  delete process.env.XDG_CONFIG_HOME;
});

function loadPlatformModule(): typeof import('./platform') {
  let mod: typeof import('./platform');
  jest.isolateModules(() => {
    mod = require('./platform');
  });
  return mod!;
}

describe('platform flags', () => {
  test('isWindows = true on win32', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const { isWindows, isMac, isLinux } = loadPlatformModule();
    expect(isWindows).toBe(true);
    expect(isMac).toBe(false);
    expect(isLinux).toBe(false);
  });

  test('isMac = true on darwin', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    const { isWindows, isMac, isLinux } = loadPlatformModule();
    expect(isWindows).toBe(false);
    expect(isMac).toBe(true);
    expect(isLinux).toBe(false);
  });

  test('isLinux = true on linux', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const { isWindows, isMac, isLinux } = loadPlatformModule();
    expect(isWindows).toBe(false);
    expect(isMac).toBe(false);
    expect(isLinux).toBe(true);
  });
});

describe('getAppData', () => {
  test('returns APPDATA on win32', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.env.APPDATA = 'C:\\Users\\Test\\AppData\\Roaming';
    const { getAppData } = loadPlatformModule();
    expect(getAppData()).toBe('C:\\Users\\Test\\AppData\\Roaming');
  });

  test('returns fallback on win32 without APPDATA', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    delete process.env.APPDATA;
    const { getAppData } = loadPlatformModule();
    expect(getAppData()).toBe(path.join(os.homedir(), 'AppData', 'Roaming'));
  });

  test('returns XDG_CONFIG_HOME on linux', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    process.env.XDG_CONFIG_HOME = '/custom/config';
    const { getAppData } = loadPlatformModule();
    expect(getAppData()).toBe('/custom/config');
  });

  test('returns ~/.config on linux without XDG', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    delete process.env.XDG_CONFIG_HOME;
    const { getAppData } = loadPlatformModule();
    expect(getAppData()).toBe(path.join(os.homedir(), '.config'));
  });
});

describe('pathsEqual', () => {
  test('equal paths on unix', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    const { pathsEqual } = loadPlatformModule();
    expect(pathsEqual('/Users/test/dir', '/Users/test/dir')).toBe(true);
  });

  test('different case NOT equal on unix', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    const { pathsEqual } = loadPlatformModule();
    expect(pathsEqual('/Users/Test', '/Users/test')).toBe(false);
  });

  test('different case IS equal on win32', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const { pathsEqual } = loadPlatformModule();
    expect(pathsEqual('C:\\Users\\Test', 'c:\\users\\test')).toBe(true);
  });

  test('normalizes paths before comparison', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    const { pathsEqual } = loadPlatformModule();
    expect(pathsEqual('/Users/test/../test/dir', '/Users/test/dir')).toBe(true);
  });
});
