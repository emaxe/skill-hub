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

test('повреждённый installed.json — возврат пустого списка и backup файла', () => {
  const dir = tmpDir();
  fs.mkdirSync(dir, { recursive: true });
  const regPath = path.join(dir, 'installed.json');
  fs.writeFileSync(regPath, '{corrupted json!!!');

  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const reg = createRegistry(dir);
  const items = reg.list();

  expect(items).toHaveLength(0);
  expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Реестр повреждён'));

  // Проверяем, что backup-файл создан
  const files = fs.readdirSync(dir);
  const backups = files.filter(f => f.startsWith('installed.json.backup.'));
  expect(backups.length).toBe(1);

  warnSpy.mockRestore();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('повреждённый реестр — последующая запись создаёт новый валидный файл', () => {
  const dir = tmpDir();
  fs.mkdirSync(dir, { recursive: true });
  const regPath = path.join(dir, 'installed.json');
  fs.writeFileSync(regPath, 'not-json');

  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const reg = createRegistry(dir);
  reg.add({ type: 'skill', name: 'new-ext', version: '1.0.0', agent: 'claude-code', scope: 'global', path: '/tmp/new' });

  // Новый installed.json должен быть валидным
  const data = JSON.parse(fs.readFileSync(regPath, 'utf-8'));
  expect(data.installations).toHaveLength(1);
  expect(data.installations[0].name).toBe('new-ext');

  warnSpy.mockRestore();
  fs.rmSync(dir, { recursive: true, force: true });
});
