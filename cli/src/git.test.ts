import { getCachePath, isCloned, fullCatalogReset } from './git';
import os from 'os';
import path from 'path';
import fs from 'fs';

jest.mock('./config', () => {
  const original = jest.requireActual('./config');
  return {
    ...original,
    loadProjectExtensions: jest.fn(),
    saveProjectExtensions: jest.fn(),
    findProjectRoot: jest.fn(() => '/mock/project'),
    resolveConfig: original.resolveConfig,
  };
});

import { loadProjectExtensions, saveProjectExtensions } from './config';
const mockLoad = loadProjectExtensions as jest.MockedFunction<typeof loadProjectExtensions>;
const mockSave = saveProjectExtensions as jest.MockedFunction<typeof saveProjectExtensions>;

test('getCachePath: возвращает ~/.skill-hub', () => {
  expect(getCachePath()).toBe(path.join(os.homedir(), '.skill-hub'));
});

test('isCloned: false если директория не существует', () => {
  expect(isCloned('/non-existent-path-xyz-12345')).toBe(false);
});

test('isCloned: false если нет catalog.json', () => {
  const os_ = require('os');
  const path_ = require('path');
  const fs_ = require('fs');
  const tmp = path_.join(os_.tmpdir(), 'skill-hub-git-test-' + Date.now());
  fs_.mkdirSync(tmp);
  try {
    expect(isCloned(tmp)).toBe(false);
  } finally {
    fs_.rmdirSync(tmp, { recursive: true });
  }
});

describe('fullCatalogReset', () => {
  let tmpDir: string;

  beforeEach(() => {
    mockLoad.mockReset();
    mockSave.mockReset();
    tmpDir = path.join(os.tmpdir(), 'skill-hub-reset-test-' + Date.now());
    fs.mkdirSync(tmpDir);
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('при наличии расширений — очищает extensions и удаляет кеш', () => {
    mockLoad.mockReturnValue([
      { type: 'skill', name: 'test-skill', version: '1.0.0', scope: 'project' },
    ]);

    fullCatalogReset(tmpDir);

    expect(mockSave).toHaveBeenCalledWith([]);
    expect(fs.existsSync(tmpDir)).toBe(false);
  });

  test('при отсутствии расширений — не вызывает saveProjectExtensions, но сбрасывает кеш', () => {
    mockLoad.mockReturnValue([]);

    fullCatalogReset(tmpDir);

    expect(mockSave).not.toHaveBeenCalled();
    expect(fs.existsSync(tmpDir)).toBe(false);
  });

  test('при ошибке очистки конфига — выводит warning, кеш всё равно сбрасывается', () => {
    mockLoad.mockImplementation(() => { throw new Error('test error'); });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      fullCatalogReset(tmpDir);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('test error'));
      expect(fs.existsSync(tmpDir)).toBe(false);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
