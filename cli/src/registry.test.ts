import { createRegistry } from './registry';
import path from 'path';
import os from 'os';
import fs from 'fs';

const tmpDir = () => path.join(os.tmpdir(), 'skill-hub-reg-test-' + Date.now());

test('добавление и проверка установленного расширения', () => {
  const dir = tmpDir();
  fs.mkdirSync(dir, { recursive: true });
  const reg = createRegistry(dir);
  reg.add({ type: 'skill', name: 'test', version: '1.0.0', agent: 'claude-code', scope: 'global', path: '/tmp/test' });
  expect(reg.isInstalled('test', 'skill', 'claude-code')).toBe(true);
  expect(reg.isInstalled('test', 'skill', 'cursor')).toBe(false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('удаление расширения из реестра', () => {
  const dir = tmpDir();
  fs.mkdirSync(dir, { recursive: true });
  const reg = createRegistry(dir);
  reg.add({ type: 'skill', name: 'test', version: '1.0.0', agent: 'claude-code', scope: 'global', path: '/tmp/test' });
  reg.remove('test', 'skill', 'claude-code');
  expect(reg.isInstalled('test', 'skill', 'claude-code')).toBe(false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('список расширений по агенту', () => {
  const dir = tmpDir();
  fs.mkdirSync(dir, { recursive: true });
  const reg = createRegistry(dir);
  reg.add({ type: 'skill', name: 'a', version: '1.0.0', agent: 'claude-code', scope: 'global', path: '/tmp/a' });
  reg.add({ type: 'skill', name: 'b', version: '1.0.0', agent: 'cursor', scope: 'project', path: '/tmp/b' });
  expect(reg.list('claude-code')).toHaveLength(1);
  expect(reg.list('cursor')).toHaveLength(1);
  expect(reg.list()).toHaveLength(2);
  fs.rmSync(dir, { recursive: true, force: true });
});
