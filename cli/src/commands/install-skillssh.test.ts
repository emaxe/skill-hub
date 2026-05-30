import fs from 'fs';
import os from 'os';
import path from 'path';

const spinner = {
  text: '',
  start() {
    return this;
  },
  succeed: jest.fn(),
  fail: jest.fn(),
};

jest.mock('os', () => {
  const actual = jest.requireActual('os');
  return {
    ...actual,
    homedir: jest.fn(() => actual.homedir()),
  };
});
jest.mock('ora', () => jest.fn(() => spinner));
jest.mock('../skillssh', () => {
  const actual = jest.requireActual('../skillssh');
  return {
    ...actual,
    searchSkillssh: jest.fn(),
    downloadSkillssh: jest.fn(),
  };
});
jest.mock('../extension-manager', () => ({
  installExtension: jest.fn(),
}));
jest.mock('../adapters/get-adapter', () => ({
  getAdapter: jest.fn(),
}));

describe('install command: skills.sh', () => {
  const { makeInstallCommand } = require('./install') as typeof import('./install');
  const { searchSkillssh, downloadSkillssh } = require('../skillssh') as typeof import('../skillssh');
  const { installExtension: managerInstall } = require('../extension-manager') as typeof import('../extension-manager');
  const { getAdapter } = require('../adapters/get-adapter') as typeof import('../adapters/get-adapter');

  let tmpHome: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    spinner.text = '';
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'skillhub-install-test-'));
    originalHome = process.env.HOME;
    process.env.HOME = tmpHome;
    (os.homedir as jest.Mock).mockReturnValue(tmpHome);
    (getAdapter as jest.MockedFunction<typeof getAdapter>).mockReturnValue({ agentName: 'codex' } as any);
    (managerInstall as jest.MockedFunction<typeof managerInstall>).mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  async function runInstall(args: string[]): Promise<void> {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`process.exit:${code ?? 0}`);
    });

    try {
      await makeInstallCommand().parseAsync(args, { from: 'user' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith('process.exit:')) {
        const failMessage = spinner.fail.mock.calls.at(-1)?.[0];
        throw new Error(failMessage || message);
      }
      throw err;
    } finally {
      exitSpy.mockRestore();
    }
  }

  test('installs by slug using normalized skills.sh search results', async () => {
    (searchSkillssh as jest.MockedFunction<typeof searchSkillssh>).mockResolvedValue([
      { id: 'test-skill', name: 'Test Skill', description: 'Desc', source: 'owner/repo', installs: 1 },
    ]);
    (downloadSkillssh as jest.MockedFunction<typeof downloadSkillssh>).mockResolvedValue({
      hash: 'abc123',
      files: [{ path: 'SKILL.md', contents: '# Test Skill' }],
    });

    await runInstall(['skillssh:test-skill', '--agent', 'codex', '--project']);

    expect(searchSkillssh).toHaveBeenCalledWith('test-skill', 20);
    expect(downloadSkillssh).toHaveBeenCalledWith('owner/repo', 'test-skill');
    expect(managerInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test-skill',
        version: 'abc123',
        source: { type: 'skillssh', uri: 'skillssh:owner/repo@test-skill' },
      }),
      'codex',
      'project',
      path.join(tmpHome, '.skill-hub'),
      expect.any(String),
    );
  });

  test('filters owner/repo search results to the exact source before installing', async () => {
    (searchSkillssh as jest.MockedFunction<typeof searchSkillssh>).mockResolvedValue([
      { id: 'other-skill', name: 'Other', description: 'Other', source: 'other/repo', installs: 1 },
      { id: 'repo-skill', name: 'Repo Skill', description: 'Exact', source: 'owner/repo', installs: 1 },
    ]);
    (downloadSkillssh as jest.MockedFunction<typeof downloadSkillssh>).mockResolvedValue({
      hash: 'hash456',
      files: [{ path: 'SKILL.md', contents: '# Repo Skill' }],
    });

    await runInstall(['skillssh:owner/repo', '--agent', 'codex', '--project']);

    expect(downloadSkillssh).toHaveBeenCalledWith('owner/repo', 'repo-skill');
    expect(managerInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'repo-skill',
        source: { type: 'skillssh', uri: 'skillssh:owner/repo@repo-skill' },
      }),
      'codex',
      'project',
      path.join(tmpHome, '.skill-hub'),
      expect.any(String),
    );
  });
});
