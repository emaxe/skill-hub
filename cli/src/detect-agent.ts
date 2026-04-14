// --- Автодетекция AI-агента ---
// Приоритет: env-переменные (CURSOR_TRACE/CURSOR_IDE) → файловая система (.cursor/) →
// env-переменные (GITHUB_COPILOT/COPILOT_AGENT) → claude-code по умолчанию

import fs from 'fs';
import path from 'path';
import { AgentName } from './catalog';

interface DetectOptions {
  cursorDir?: string;
}

/** Определяет текущий AI-агент по окружению и файловой структуре проекта */
export function detectAgent(opts: DetectOptions = {}): AgentName {
  if (process.env.CURSOR_TRACE || process.env.CURSOR_IDE) {
    return 'cursor';
  }
  const cursorDir = opts.cursorDir ?? path.join(process.cwd(), '.cursor');
  if (fs.existsSync(cursorDir)) {
    return 'cursor';
  }
  if (process.env.GITHUB_COPILOT || process.env.COPILOT_AGENT) {
    return 'copilot';
  }
  return 'claude-code';
}
