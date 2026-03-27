import { filterByAgent, parseExtension, searchExtensions } from './catalog';

const mockExt = {
  type: 'skill' as const,
  name: 'test-skill',
  description: 'Test skill for unit tests',
  platforms: { 'claude-code': 'SKILL.md', cursor: 'CURSOR.md', copilot: null } as Record<string, string | null>,
  path: 'skills/test-skill',
  tags: ['testing'],
  version: '1.0.0',
  scope: 'global' as const,
  dependencies: [],
};

test('filterByAgent: claude-code видит расширение', () => {
  expect(filterByAgent([mockExt], 'claude-code')).toHaveLength(1);
});

test('filterByAgent: copilot не видит расширение без COPILOT.md', () => {
  expect(filterByAgent([mockExt], 'copilot')).toHaveLength(0);
});

test('filterByAgent: cursor видит расширение с CURSOR.md', () => {
  expect(filterByAgent([mockExt], 'cursor')).toHaveLength(1);
});

test('parseExtension: платформы как массив строк конвертируются (backward compat)', () => {
  const legacy = { ...mockExt, platforms: ['claude-code'] };
  const parsed = parseExtension(legacy);
  expect(parsed.platforms['claude-code']).toBe('SKILL.md');
});

test('searchExtensions: поиск по запросу', () => {
  const results = searchExtensions({ version: 3, generated_at: '', counts: {}, extensions: [mockExt] }, 'test', 'claude-code');
  expect(results).toHaveLength(1);
});
