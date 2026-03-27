function computeScope(opts: { project?: boolean; local?: boolean; global?: boolean }): 'global' | 'project' {
  return (opts.project || opts.local) ? 'project' : 'global';
}

test('scope: по умолчанию global', () => {
  expect(computeScope({})).toBe('global');
});

test('scope: --project → project', () => {
  expect(computeScope({ project: true })).toBe('project');
});

test('scope: --local → project', () => {
  expect(computeScope({ local: true })).toBe('project');
});

test('scope: --global → global', () => {
  expect(computeScope({ global: true })).toBe('global');
});
