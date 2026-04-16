import { useState, useCallback, useRef } from 'react';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import { disableConventions } from '../../conventions';
import { AgentName } from '../../catalog';
import { AiAgentsConfig } from '../../config';
import { isWindows } from '../../platform';

export type ConventionsExitStep = 'idle' | 'selectAgent' | 'running' | 'disabling' | 'done' | 'error';

export interface UseConventionsExitResult {
  step: ConventionsExitStep;
  outputLines: string[];
  errorMessage: string | null;
  /** Начинает процесс выхода: показывает выбор AI-агента */
  start(): void;
  /** Запускает AI-агент с exit-agents скиллом, затем disableConventions */
  runWithAgent(agentName: 'claude-code' | 'cursor' | 'copilot' | 'codex', aiAgentsConfig: AiAgentsConfig, targetAgent: AgentName): void;
  /** Пропустить AI-агент и сразу выполнить disableConventions */
  skipAgent(targetAgent: AgentName): void;
  cancel(): void;
  reset(): void;
}

const AGENT_BINARIES: Record<string, string> = {
  'claude-code': 'claude',
  'cursor': 'agent',
  'copilot': 'copilot',
};

/** Абсолютный путь к bootstrap-скиллу exit-agents */
function getExitSkillPath(): string {
  return path.join(os.homedir(), '.skill-hub', 'bootstrap', 'exit-agents', 'SKILL.md');
}

function getExitPrompt(): string {
  return `Прочитай скилл ${getExitSkillPath()} и выполни все описанные в нём задачи для AI-агента.`;
}

function getExitArgs(): Record<string, string[]> {
  const prompt = getExitPrompt();
  return {
    'claude-code': ['--dangerously-skip-permissions', '-p', prompt, '--model', 'sonnet'],
    'cursor': ['-p', prompt, '--model', 'composer-2', '--force', '--output-format', 'stream-json'],
    'copilot': ['-p', prompt, '--model', 'claude-sonnet-4.6', '--allow-all', '--no-ask-user'],
  };
}

const MAX_OUTPUT_LINES = 20;

export function useConventionsExit(): UseConventionsExitResult {
  const [step, setStep] = useState<ConventionsExitStep>('idle');
  const [outputLines, setOutputLines] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lineBufferRef = useRef<string>('');
  const childRef = useRef<ReturnType<typeof spawn> | null>(null);

  const appendLines = useCallback((chunk: string) => {
    lineBufferRef.current += chunk;
    const parts = lineBufferRef.current.split('\n');
    lineBufferRef.current = parts.pop() ?? '';
    const newLines = parts.filter(l => l.trim().length > 0);
    if (newLines.length > 0) {
      setOutputLines(prev => {
        const combined = [...prev, ...newLines];
        return combined.slice(-MAX_OUTPUT_LINES);
      });
    }
  }, []);

  const runDisable = useCallback((targetAgent: AgentName) => {
    setStep('disabling');
    disableConventions(targetAgent).then(() => {
      setStep('done');
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
      setStep('error');
    });
  }, []);

  const start = useCallback(() => {
    setStep('selectAgent');
    setOutputLines([]);
    setErrorMessage(null);
    lineBufferRef.current = '';
  }, []);

  const runWithAgent = useCallback((agentName: 'claude-code' | 'cursor' | 'copilot' | 'codex', aiAgentsConfig: AiAgentsConfig, targetAgent: AgentName) => {
    setStep('running');
    setOutputLines([]);
    lineBufferRef.current = '';

    const binary = AGENT_BINARIES[agentName];
    const args = getExitArgs()[agentName];
    const env = { ...process.env };

    const agentCfg = aiAgentsConfig.agents[agentName as keyof typeof aiAgentsConfig.agents];
    if (agentCfg?.useProxy && aiAgentsConfig.proxy) {
      const proxy = aiAgentsConfig.proxy;
      env.http_proxy = proxy;
      env.https_proxy = proxy;
      env.all_proxy = proxy;
    }

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(binary, args, { stdio: 'pipe', env, shell: isWindows });
      childRef.current = child;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
      setStep('error');
      return;
    }

    child.stdout?.on('data', (data: Buffer) => {
      appendLines(data.toString());
    });

    child.stderr?.on('data', (data: Buffer) => {
      appendLines(data.toString());
    });

    child.on('error', (err: Error) => {
      setErrorMessage(err.message);
      setStep('error');
    });

    child.on('exit', (code: number | null) => {
      childRef.current = null;
      if (code === 0) {
        runDisable(targetAgent);
      } else if (code === null) {
        // killed by cancel()
      } else {
        setErrorMessage(`Процесс завершился с кодом ${code}`);
        setStep('error');
      }
    });
  }, [appendLines, runDisable]);

  const skipAgent = useCallback((targetAgent: AgentName) => {
    runDisable(targetAgent);
  }, [runDisable]);

  const cancel = useCallback(() => {
    if (childRef.current) {
      // На Windows kill() без аргумента вызывает TerminateProcess()
      childRef.current.kill();
      childRef.current = null;
    }
    setStep('idle');
    setOutputLines([]);
    setErrorMessage(null);
    lineBufferRef.current = '';
  }, []);

  const reset = useCallback(() => {
    setStep('idle');
    setOutputLines([]);
    setErrorMessage(null);
    lineBufferRef.current = '';
  }, []);

  return { step, outputLines, errorMessage, start, runWithAgent, skipAgent, cancel, reset };
}
