import { AgentName } from '../catalog';
import { AgentAdapter } from './types';
import { ClaudeCodeAdapter } from './claude-code';
import { CursorAdapter } from './cursor';
import { CopilotAdapter } from './copilot';

export function getAdapter(agent: AgentName): AgentAdapter {
  if (agent === 'cursor') return new CursorAdapter();
  if (agent === 'copilot') return new CopilotAdapter();
  return new ClaudeCodeAdapter();
}
