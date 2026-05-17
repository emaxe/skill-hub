import { execLifecycleHook, LifecycleHookContext } from './hooks-engine';
import { spawnSync } from 'child_process';
import fs from 'fs';
import { Extension } from './catalog';

jest.mock('child_process', () => ({
  spawnSync: jest.fn(),
}));
const mockedSpawnSync = spawnSync as jest.MockedFunction<typeof spawnSync>;

const existsSyncSpy = jest.spyOn(fs, 'existsSync');

const mockExt = (hooks?: Extension['hooks']): Extension => ({
  type: 'skill',
  name: 'hook-skill',
  description: '',
  tags: [],
  version: '1.0.0',
  scope: 'global',
  platforms: { 'claude-code': 'SKILL.md' },
  path: 'skills/hook-skill',
  dependencies: [],
  projects: [],
  hooks,
});

beforeEach(() => {
  mockedSpawnSync.mockReset();
  existsSyncSpy.mockReset();
});

afterAll(() => {
  existsSyncSpy.mockRestore();
});

function ctx(phase: LifecycleHookContext['phase']): LifecycleHookContext {
  return {
    ext: mockExt({
      preInstall: 'setup.sh',
      postInstall: 'notify.sh',
      preRemove: 'cleanup.sh',
      postRemove: 'verify.sh',
    }),
    scope: 'global',
    cachePath: '/cache',
    installPath: '/dest/SKILL.md',
    phase,
  };
}

test('execLifecycleHook: нет hook → не вызывает spawnSync', () => {
  execLifecycleHook({
    ext: mockExt(),
    scope: 'global',
    cachePath: '/cache',
    installPath: '/dest/SKILL.md',
    phase: 'pre-install',
  });
  expect(mockedSpawnSync).not.toHaveBeenCalled();
});

test('execLifecycleHook: ищет скрипт в destDir, затем fallback в srcDir', () => {
  existsSyncSpy.mockImplementation((p: fs.PathLike) => p === '/dest/setup.sh');
  mockedSpawnSync.mockReturnValue({ status: 0, stderr: Buffer.from('') } as any);

  execLifecycleHook(ctx('pre-install'));

  expect(existsSyncSpy).toHaveBeenCalledWith('/dest/setup.sh');
  expect(mockedSpawnSync).toHaveBeenCalledWith(
    'sh',
    ['/dest/setup.sh'],
    expect.objectContaining({ cwd: '/dest', stdio: 'pipe' })
  );
});

test('execLifecycleHook: fallback в srcDir если destDir нет', () => {
  existsSyncSpy.mockImplementation((p: fs.PathLike) => p === '/cache/skills/hook-skill/setup.sh');
  mockedSpawnSync.mockReturnValue({ status: 0, stderr: Buffer.from('') } as any);

  execLifecycleHook(ctx('pre-install'));

  expect(mockedSpawnSync).toHaveBeenCalledWith(
    'sh',
    ['/cache/skills/hook-skill/setup.sh'],
    expect.objectContaining({ cwd: '/cache/skills/hook-skill', stdio: 'pipe' })
  );
});

test('execLifecycleHook: pre-install fail → бросает ошибку', () => {
  existsSyncSpy.mockReturnValue(true);
  mockedSpawnSync.mockReturnValue({ status: 1, stderr: Buffer.from('fail') } as any);

  expect(() => execLifecycleHook(ctx('pre-install'))).toThrow('Hook pre-install failed');
});

test('execLifecycleHook: post-install fail → warning, не бросает', () => {
  existsSyncSpy.mockReturnValue(true);
  mockedSpawnSync.mockReturnValue({ status: 1, stderr: Buffer.from('warn') } as any);
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

  execLifecycleHook(ctx('post-install'));

  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Hook post-install failed'));
  warnSpy.mockRestore();
});

test('execLifecycleHook: отсутствует скрипт для pre-remove → бросает ошибку', () => {
  existsSyncSpy.mockReturnValue(false);
  expect(() => execLifecycleHook(ctx('pre-remove'))).toThrow('Hook script not found');
});

test('execLifecycleHook: отсутствует скрипт для post-remove → warning', () => {
  existsSyncSpy.mockReturnValue(false);
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

  execLifecycleHook(ctx('post-remove'));

  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Hook script not found'));
  warnSpy.mockRestore();
});

test('execLifecycleHook: передаёт переменные окружения', () => {
  existsSyncSpy.mockReturnValue(true);
  mockedSpawnSync.mockReturnValue({ status: 0, stderr: Buffer.from('') } as any);

  execLifecycleHook(ctx('pre-install'));

  const call = mockedSpawnSync.mock.calls[0];
  const opts = call[2] as any;
  expect(opts.env.SKILL_HUB_HOOK_PHASE).toBe('pre-install');
  expect(opts.env.SKILL_HUB_EXTENSION_NAME).toBe('hook-skill');
  expect(opts.env.SKILL_HUB_INSTALL_DIR).toBe('/dest');
});
