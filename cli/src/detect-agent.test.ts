import { detectAgent } from './detect-agent';
import path from 'path';
import os from 'os';
import fs from 'fs';

afterEach(() => {
  delete process.env.CURSOR_TRACE;
  delete process.env.CURSOR_IDE;
  delete process.env.GITHUB_COPILOT;
  delete process.env.COPILOT_AGENT;
});

test('detectAgent: cursor по env var', () => {
  process.env.CURSOR_TRACE = '1';
  expect(detectAgent()).toBe('cursor');
});

test('detectAgent: cursor по директории', () => {
  const tmpDir = path.join(os.tmpdir(), 'cursor-detect-test-' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    expect(detectAgent({ cursorDir: tmpDir })).toBe('cursor');
  } finally {
    fs.rmdirSync(tmpDir);
  }
});

test('detectAgent: copilot по env var', () => {
  process.env.GITHUB_COPILOT = '1';
  expect(detectAgent()).toBe('copilot');
});

test('detectAgent: по умолчанию claude-code', () => {
  expect(detectAgent({ cursorDir: '/non/existent/path' })).toBe('claude-code');
});
