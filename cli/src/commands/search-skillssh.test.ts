jest.mock('../skillssh', () => ({
  searchSkillsshWithMeta: jest.fn(),
}));

describe('search command: skills.sh', () => {
  const { makeSearchCommand } = require('./search') as typeof import('./search');
  const { searchSkillsshWithMeta } = require('../skillssh') as typeof import('../skillssh');
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    logSpy.mockRestore();
  });

  test('fetches enough results for offset pagination and prints the requested page', async () => {
    (searchSkillsshWithMeta as jest.MockedFunction<typeof searchSkillsshWithMeta>).mockResolvedValue({
      count: 10,
      skills: [
        { id: 'react-skill', name: 'React Skill', description: 'React patterns', source: 'owner/repo', installs: 123 },
        { id: 'next-skill', name: 'Next Skill', description: 'Next patterns', source: 'owner/repo', installs: 45 },
      ],
    });

    await makeSearchCommand().parseAsync(['react', '--source', 'skillssh', '--limit', '1', '--offset', '1'], { from: 'user' });

    expect(searchSkillsshWithMeta).toHaveBeenCalledWith('react', 2);

    const output = logSpy.mock.calls.flat().join('\n');
    expect(output).toContain('next-skill');
    expect(output).toContain('Показано 1 из 10');
  });
});
