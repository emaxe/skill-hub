import { installExtension, removeExtension, moveExtension, updateExtension } from './extension-manager';
import { execLifecycleHook } from './hooks-engine';
import { getAdapter } from './adapters/get-adapter';
import { createRegistry } from './registry';
import { getCachePath } from './git';
import { hasProjectConfig, addProjectExtension, removeProjectExtension } from './config';
import { Extension } from './catalog';

jest.mock('./hooks-engine');
jest.mock('./adapters/get-adapter');
jest.mock('./registry');
jest.mock('./git');
jest.mock('./config');

const mockExt: Extension = {
  type: 'skill',
  name: 'test',
  description: '',
  tags: [],
  version: '1.0.0',
  scope: 'global',
  platforms: { 'claude-code': 'SKILL.md' },
  path: 'skills/test',
  dependencies: [],
  projects: [],
};

const mockAdapter = {
  install: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
  getInstallPath: jest.fn().mockReturnValue('/dest/SKILL.md'),
  supportsRuntimeHooks: true,
  installHooks: jest.fn().mockResolvedValue(undefined),
  removeHooks: jest.fn().mockResolvedValue(undefined),
};

const mockReg = {
  add: jest.fn(),
  remove: jest.fn(),
  list: jest.fn().mockReturnValue([]),
  isInstalled: jest.fn().mockReturnValue(false),
};

beforeEach(() => {
  jest.clearAllMocks();
  (getAdapter as jest.MockedFunction<typeof getAdapter>).mockReturnValue(mockAdapter as any);
  (createRegistry as jest.MockedFunction<typeof createRegistry>).mockReturnValue(mockReg as any);
  (getCachePath as jest.MockedFunction<typeof getCachePath>).mockReturnValue('/cache');
  (hasProjectConfig as jest.MockedFunction<typeof hasProjectConfig>).mockReturnValue(false);
  (execLifecycleHook as jest.MockedFunction<typeof execLifecycleHook>).mockImplementation(() => {});
});

test('installExtension: полный flow с lifecycle hooks', async () => {
  await installExtension(mockExt, 'claude-code', 'global', '/reg');
  expect(execLifecycleHook).toHaveBeenCalledWith(
    expect.objectContaining({ phase: 'pre-install' })
  );
  expect(mockAdapter.install).toHaveBeenCalledWith(mockExt, 'global', '/cache');
  expect(mockAdapter.installHooks).toHaveBeenCalledWith(mockExt, 'global', '/cache');
  expect(execLifecycleHook).toHaveBeenCalledWith(
    expect.objectContaining({ phase: 'post-install' })
  );
  expect(mockReg.add).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'test', hooks: undefined })
  );
});

test('installExtension: при projectConfig добавляет в проектный конфиг', async () => {
  (hasProjectConfig as jest.MockedFunction<typeof hasProjectConfig>).mockReturnValue(true);
  await installExtension(mockExt, 'claude-code', 'project', '/reg');
  expect(addProjectExtension).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'test', scope: 'project' })
  );
});

test('installExtension propagates source to registry and config', async () => {
  const ext: Extension = {
    type: 'skill',
    name: 'test-skill',
    description: 'Test',
    tags: [],
    version: '1.0.0',
    scope: 'project',
    platforms: { 'claude-code': 'SKILL.md' },
    path: 'skills/test-skill/SKILL.md',
    dependencies: [],
    projects: [],
    source: { type: 'skillssh', uri: 'skillssh:owner/repo@test-skill' },
  };

  (hasProjectConfig as jest.MockedFunction<typeof hasProjectConfig>).mockReturnValue(true);
  await installExtension(ext, 'claude-code', 'project', '/reg');

  expect(mockReg.add).toHaveBeenCalledWith(
    expect.objectContaining({ source: 'skillssh:owner/repo@test-skill' }),
  );
  expect(addProjectExtension).toHaveBeenCalledWith(
    expect.objectContaining({ source: 'skillssh:owner/repo@test-skill' }),
  );
});

test('removeExtension: полный flow с deleteFromDisk=true', async () => {
  await removeExtension(mockExt, 'claude-code', 'global', '/reg', true);
  expect(execLifecycleHook).toHaveBeenCalledWith(
    expect.objectContaining({ phase: 'pre-remove' })
  );
  expect(mockAdapter.removeHooks).toHaveBeenCalledWith(mockExt, 'global');
  expect(mockAdapter.remove).toHaveBeenCalledWith(mockExt, 'global');
  expect(execLifecycleHook).toHaveBeenCalledWith(
    expect.objectContaining({ phase: 'post-remove' })
  );
  expect(mockReg.remove).toHaveBeenCalledWith('test', 'skill', 'claude-code');
});

test('removeExtension: без deleteFromDisk пропускает адаптер и hooks', async () => {
  await removeExtension(mockExt, 'claude-code', 'global', '/reg', false);
  expect(mockAdapter.remove).not.toHaveBeenCalled();
  expect(execLifecycleHook).not.toHaveBeenCalled();
  expect(mockReg.remove).toHaveBeenCalledWith('test', 'skill', 'claude-code');
});

test('moveExtension: install в target scope + remove из source', async () => {
  await moveExtension(mockExt, 'claude-code', 'global', '/reg');
  expect(mockAdapter.install).toHaveBeenCalledWith(mockExt, 'project', '/cache');
  expect(mockAdapter.remove).toHaveBeenCalledWith(mockExt, 'global');
});

test('updateExtension: вызывает installExtension (переустановка)', async () => {
  await updateExtension(mockExt, 'claude-code', 'global', '/reg');
  expect(mockAdapter.install).toHaveBeenCalledWith(mockExt, 'global', '/cache');
  expect(mockAdapter.installHooks).toHaveBeenCalledWith(mockExt, 'global', '/cache');
});
