import { getCachePath, isCloned } from './git';
import os from 'os';
import path from 'path';

test('getCachePath: возвращает ~/.skill-hub', () => {
  expect(getCachePath()).toBe(path.join(os.homedir(), '.skill-hub'));
});

test('isCloned: false если директория не существует', () => {
  expect(isCloned('/non-existent-path-xyz-12345')).toBe(false);
});

test('isCloned: false если нет catalog.json', () => {
  const os_ = require('os');
  const path_ = require('path');
  const fs_ = require('fs');
  const tmp = path_.join(os_.tmpdir(), 'skill-hub-git-test-' + Date.now());
  fs_.mkdirSync(tmp);
  try {
    expect(isCloned(tmp)).toBe(false);
  } finally {
    fs_.rmdirSync(tmp, { recursive: true });
  }
});
