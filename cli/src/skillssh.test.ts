import { searchSkillssh, downloadSkillssh, skillsshToExtension } from './skillssh';

describe('skillssh', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  test('searchSkillssh returns parsed skills', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        skills: [{ id: 'test-skill', name: 'Test', description: 'Desc', source: 'owner/repo', installs: 100 }],
      }),
    });
    const results = await searchSkillssh('test');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('test-skill');
  });

  test('downloadSkillssh returns files and hash', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        files: [{ path: 'SKILL.md', contents: '# Test' }],
        hash: 'abc123',
      }),
    });
    const result = await downloadSkillssh('owner/repo', 'test-skill');
    expect(result.hash).toBe('abc123');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('SKILL.md');
  });

  test('skillsshToExtension maps correctly', () => {
    const ext = skillsshToExtension(
      { id: 'test-skill', name: 'Test', description: 'Desc', source: 'owner/repo', installs: 100 },
      'abc123',
    );
    expect(ext.name).toBe('test-skill');
    expect(ext.version).toBe('abc123');
    expect(ext.source).toEqual({ type: 'skillssh', uri: 'skillssh:owner/repo@test-skill' });
    expect(ext.type).toBe('skill');
    expect(ext.scope).toBe('both');
    expect(ext.platforms['claude-code']).toBe('SKILL.md');
  });

  test('searchSkillssh throws on API error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });
    await expect(searchSkillssh('test')).rejects.toThrow('skills.sh search failed: 500');
  });

  test('downloadSkillssh throws on invalid source format', async () => {
    await expect(downloadSkillssh('invalid', 'slug')).rejects.toThrow('Invalid source format');
  });
});
