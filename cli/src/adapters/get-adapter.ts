import { AgentName } from '../catalog';
import { AgentAdapter } from './types';
import { ClaudeCodeAdapter } from './claude-code';
import { CursorAdapter } from './cursor';
import { CopilotAdapter } from './copilot';
import { CodexAdapter } from './codex';
import { AgentsConventionsAdapter } from './agents-conventions';

/** Фабрика адаптеров: возвращает нужный адаптер по имени агента */
export function getAdapter(agent: AgentName): AgentAdapter {
  if (agent === 'cursor') return new CursorAdapter();
  if (agent === 'copilot') return new CopilotAdapter();
  if (agent === 'codex') return new CodexAdapter();
  if (agent === 'agents-conventions') return new AgentsConventionsAdapter();
  return new ClaudeCodeAdapter();
}
