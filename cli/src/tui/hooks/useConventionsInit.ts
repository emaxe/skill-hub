import { useState, useCallback, useRef } from 'react';
import { spawn } from 'child_process';
import fs from 'fs';
import { enableConventions } from '../../conventions';
import { AiAgentsConfig } from '../../config';

export type ConventionsInitStep = 'idle' | 'enabling' | 'running' | 'done' | 'error';

export interface UseConventionsInitResult {
  step: ConventionsInitStep;
  outputLines: string[];
  errorMessage: string | null;
  run(agentName: 'claude-code' | 'cursor' | 'copilot', aiAgentsConfig: AiAgentsConfig): void;
  cancel(): void;
  reset(): void;
}

const AGENT_BINARIES: Record<string, string> = {
  'claude-code': 'claude',
  'cursor': 'agent',
  'copilot': 'copilot',
};

const AGENT_ARGS: Record<string, string[]> = {
  'claude-code': ['--dangerously-skip-permissions', '-p', 'run init-agents skill', '--allowedTools', 'shell(*), write'],
  'cursor': ['-p', '--force', 'run init-agents skill'],
  'copilot': ['-p', 'run init-agents skill', '--no-ask-user', "--allow-tool=shell(*), write"],
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

  const run = useCallback((agentName: 'claude-code' | 'cursor' | 'copilot', aiAgentsConfig: AiAgentsConfig) => {
    setStep('enabling');
    setOutputLines([]);
    setErrorMessage(null);
    lineBufferRef.current = '';

    enableConventions().then(() => {
      fs.appendFileSync('/tmp/skill-hub-init.log', `[${new Date().toISOString()}] enableConventions done, spawning ${agentName}\n`);
      setStep('running');

      const binary = AGENT_BINARIES[agentName];
      const args = AGENT_ARGS[agentName];
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
        child = spawn(binary, args, { stdio: 'pipe', env });
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
          // killed by cancel() — не показываем ошибку, модаль сама сбросит step
        } else {
          setErrorMessage(`Процесс завершился с кодом ${code}`);
          setStep('error');
        }
      });
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      fs.appendFileSync('/tmp/skill-hub-init.log', `[${new Date().toISOString()}] ERROR: ${message}\n${err instanceof Error ? err.stack : ''}\n`);
      setErrorMessage(message);
      setStep('error');
    });
  }, [appendLines]);

  const cancel = useCallback(() => {
    if (childRef.current) {
      childRef.current.kill('SIGTERM');
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

  return { step, outputLines, errorMessage, run, cancel, reset };
}
