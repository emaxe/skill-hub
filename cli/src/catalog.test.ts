import { filterByAgent, filterByProject, parseExtension, searchExtensions, Extension } from './catalog';

const mockExt = {
  type: 'skill' as const,
  name: 'test-skill',
  description: 'Test skill for unit tests',
  platforms: { 'claude-code': 'SKILL.md', cursor: 'SKILL.md', copilot: null } as Record<string, string | null>,
  path: 'skills/test-skill',
  tags: ['testing'],
  version: '1.0.0',
  scope: 'global' as const,
  dependencies: [], projects: [],
};

const projectExtA: Extension = { ...mockExt, name: 'proj-a', projects: ['my-app'] };
const projectExtB: Extension = { ...mockExt, name: 'proj-b', projects: ['other-app'] };
const projectExtMulti: Extension = { ...mockExt, name: 'proj-multi', projects: ['my-app', 'other-app'] };
const universalExt: Extension = { ...mockExt, name: 'universal', projects: [] };

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

// --- filterByProject ---

test('filterByProject: project=null — все расширения проходят', () => {
  const all = [projectExtA, projectExtB, universalExt];
  expect(filterByProject(all, null)).toHaveLength(3);
});

test('filterByProject: универсальное расширение проходит всегда', () => {
  expect(filterByProject([universalExt], 'my-app')).toHaveLength(1);
});

test('filterByProject: расширение с совпадающим проектом проходит', () => {
  expect(filterByProject([projectExtA], 'my-app')).toHaveLength(1);
});

test('filterByProject: расширение с другим проектом отфильтровывается', () => {
  expect(filterByProject([projectExtB], 'my-app')).toHaveLength(0);
});

test('filterByProject: расширение с несколькими проектами — совпадает один', () => {
  expect(filterByProject([projectExtMulti], 'my-app')).toHaveLength(1);
  expect(filterByProject([projectExtMulti], 'other-app')).toHaveLength(1);
});

test('filterByProject: смешанный набор фильтруется корректно', () => {
  const all = [projectExtA, projectExtB, projectExtMulti, universalExt];
  const filtered = filterByProject(all, 'my-app');
  expect(filtered).toHaveLength(3);
  expect(filtered.map(e => e.name)).toEqual(['proj-a', 'proj-multi', 'universal']);
});

test('searchExtensions: с фильтром по проекту', () => {
  const catalog = { version: 3, generated_at: '', counts: {}, extensions: [projectExtA, projectExtB, universalExt] };
  const results = searchExtensions(catalog, '', 'claude-code', undefined, 'my-app');
  expect(results).toHaveLength(2); // proj-a + universal
  expect(results.map(e => e.name)).toContain('proj-a');
  expect(results.map(e => e.name)).toContain('universal');
});

test('parseExtension: projects парсится корректно', () => {
  const raw = { ...mockExt, projects: ['app-1', 'app-2'] };
  const parsed = parseExtension(raw);
  expect(parsed.projects).toEqual(['app-1', 'app-2']);
});

test('parseExtension: отсутствие projects → пустой массив', () => {
  const raw = { ...mockExt };
  delete (raw as any).projects;
  const parsed = parseExtension(raw);
  expect(parsed.projects).toEqual([]);
});

test('parseExtension: files парсится корректно', () => {
  const raw = { ...mockExt, files: ['script.sh', 'templates/tpl.txt'] };
  const parsed = parseExtension(raw);
  expect(parsed.files).toEqual(['script.sh', 'templates/tpl.txt']);
});

test('parseExtension: отсутствие files → undefined', () => {
  const raw = { ...mockExt };
  delete (raw as any).files;
  const parsed = parseExtension(raw);
  expect(parsed.files).toBeUndefined();
});

test('parseExtension: files не массив → undefined', () => {
  const raw = { ...mockExt, files: 'not-an-array' };
  const parsed = parseExtension(raw);
  expect(parsed.files).toBeUndefined();
});
