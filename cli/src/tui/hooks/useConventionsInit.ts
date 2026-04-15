import { useState, useCallback, useRef } from 'react';
import { spawn } from 'child_process';
import { enableConventions } from '../../conventions';
import { AiAgentsConfig } from '../../config';
import { isWindows } from '../../platform';

export type ConventionsInitStep = 'idle' | 'enabling' | 'selectAgent' | 'running' | 'done' | 'error';

export interface UseConventionsInitResult {
  step: ConventionsInitStep;
  outputLines: string[];
  errorMessage: string | null;
  /** Запускает enableConventions (механические шаги) */
  run(): void;
  /** Запускает AI-агент для выполнения init-agents скилла */
  runAutoAnalysis(agentName: 'claude-code' | 'cursor' | 'copilot', aiAgentsConfig: AiAgentsConfig): void;
  /** Пропустить AI-агент и завершить */
  skipAutoAnalysis(): void;
  cancel(): void;
  reset(): void;
}

const AGENT_BINARIES: Record<string, string> = {
  'claude-code': 'claude',
  'cursor': 'agent',
  'copilot': 'copilot',
};

// Промпт ссылается на установленный скилл init-agents
const INIT_PROMPT = 'Прочитай скилл .agents/skills/init-agents/SKILL.md и выполни все описанные в нём задачи для AI-агента.';

const AUTO_ANALYSIS_ARGS: Record<string, string[]> = {
  'claude-code': ['--dangerously-skip-permissions', '-p', INIT_PROMPT, '--model', 'sonnet'],
  'cursor': ['-p', INIT_PROMPT, '--model', 'composer-2', '--force', '--output-format', 'stream-json'],
  'copilot': ['-p', INIT_PROMPT, '--model', 'claude-sonnet-4.6', '--allow-all', '--no-ask-user'],
};

const MAX_OUTPUT_LINES = 20;

export function useConventionsInit(): UseConventionsInitResult {
  const [step, setStep] = useState<ConventionsInitStep>('idle');
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

  const run = useCallback(() => {
    setStep('enabling');
    setOutputLines([]);
    setErrorMessage(null);
    lineBufferRef.current = '';

    enableConventions().then(() => {
      setStep('selectAgent');
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
      setStep('error');
    });
  }, []);

  const runAutoAnalysis = useCallback((agentName: 'claude-code' | 'cursor' | 'copilot', aiAgentsConfig: AiAgentsConfig) => {
    setStep('running');
    setOutputLines([]);
    lineBufferRef.current = '';

    const binary = AGENT_BINARIES[agentName];
    const args = AUTO_ANALYSIS_ARGS[agentName];
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
        setStep('done');
      } else if (code === null) {
        // killed by cancel()
      } else {
        setErrorMessage(`Процесс завершился с кодом ${code}`);
        setStep('error');
      }
    });
  }, [appendLines]);

  const skipAutoAnalysis = useCallback(() => {
    setStep('done');
  }, []);

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

  return { step, outputLines, errorMessage, run, runAutoAnalysis, skipAutoAnalysis, cancel, reset };
}
