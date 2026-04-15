/**
 * Тесты Windows-веток agent-launcher.
 * Проверяем генерацию .bat скриптов и exec-режим на Windows.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

// Мокаем зависимости до импорта
jest.mock('./config', () => ({
  resolveConfig: () => ({
    config: {
      aiAgents: {
        proxy: 'http://proxy:8080',
        agents: {
          'claude-code': { enabled: true, useProxy: true },
          'cursor': { enabled: true, useProxy: false },
          'copilot': { enabled: true, useProxy: false },
        },
      },
    },
  }),
}));

const ORIGINAL_PLATFORM = process.platform;

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: ORIGINAL_PLATFORM });
});

describe('agent-launcher Windows', () => {
  test('launchScript генерирует .bat файл на Windows', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    // Переимпортируем модуль с isWindows = true
    let launchAgent: typeof import('./agent-launcher').launchAgent;
    jest.isolateModules(() => {
      const mod = require('./agent-launcher');
      launchAgent = mod.launchAgent;
    });

    // Мокаем spawnSync и process.exit чтобы перехватить вызовы
    const { spawnSync } = require('child_process');
    const spawnMock = jest.spyOn(require('child_process'), 'spawnSync')
      .mockReturnValue({ status: 0, stdout: '', stderr: '', signal: null, output: [] });
    const exitMock = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as any);

    try {
      launchAgent!('claude', [], 'script');
    } catch (e: any) {
      expect(e.message).toBe('process.exit called');
    }

    // Проверяем что был вызван cmd.exe с .bat файлом
    const call = spawnMock.mock.calls.find((c: any[]) => c[0] === 'cmd.exe') as any[];
    expect(call).toBeTruthy();
    const scriptPath = call[1][1] as string;
    expect(scriptPath).toMatch(/\.bat$/);

    // Проверяем содержимое .bat файла (если он ещё существует)
    if (fs.existsSync(scriptPath)) {
      const content = fs.readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('@echo off');
      expect(content).toContain('set "http_proxy=http://proxy:8080"');
      expect(content).toContain('del "%~f0"');
      // CRLF проверка
      expect(content).toContain('\r\n');
    }

    spawnMock.mockRestore();
    exitMock.mockRestore();
  });

  test('launchExec использует shell:true на Windows', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    let launchAgent: typeof import('./agent-launcher').launchAgent;
    jest.isolateModules(() => {
      const mod = require('./agent-launcher');
      launchAgent = mod.launchAgent;
    });

    const spawnMock = jest.spyOn(require('child_process'), 'spawnSync')
      .mockReturnValue({ status: 0, stdout: '', stderr: '', signal: null, output: [] });
    const exitMock = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as any);

    try {
      launchAgent!('claude', ['--flag'], 'exec');
    } catch (e: any) {
      expect(e.message).toBe('process.exit called');
    }

    // На Windows exec не использует 'sh', а запускает binary напрямую с shell:true
    const call = spawnMock.mock.calls[0] as any[];
    expect(call[0]).toBe('claude');
    expect(call[1]).toEqual(['--flag']);
    expect(call[2].shell).toBe(true);

    spawnMock.mockRestore();
    exitMock.mockRestore();
  });

  test('launchExec использует sh на Unix', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    let launchAgent: typeof import('./agent-launcher').launchAgent;
    jest.isolateModules(() => {
      const mod = require('./agent-launcher');
      launchAgent = mod.launchAgent;
    });

    const spawnMock = jest.spyOn(require('child_process'), 'spawnSync')
      .mockReturnValue({ status: 0, stdout: '', stderr: '', signal: null, output: [] });
    const exitMock = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as any);

    try {
      launchAgent!('claude', [], 'exec');
    } catch (e: any) {
      expect(e.message).toBe('process.exit called');
    }

    const call = spawnMock.mock.calls[0] as any[];
    expect(call[0]).toBe('sh');

    spawnMock.mockRestore();
    exitMock.mockRestore();
  });
});
