import { useState, useCallback, useRef } from 'react';
import { spawn } from 'child_process';
import { disableConventions } from '../../conventions';
import { AiAgentsConfig } from '../../config';
import { AgentName } from '../../catalog';

export type ConventionsExitStep = 'idle' | 'running' | 'disabling' | 'done' | 'error';

export interface UseConventionsExitResult {
  step: ConventionsExitStep;
  outputLines: string[];
  errorMessage: string | null;
  run(agentName: 'claude-code' | 'cursor' | 'copilot', targetAgent: AgentName, aiAgentsConfig: AiAgentsConfig): void;
  cancel(): void;
  reset(): void;
}

const AGENT_BINARIES: Record<string, string> = {
  'claude-code': 'claude',
  'cursor': 'agent',
  'copilot': 'copilot',
};

const AGENT_ARGS: Record<string, (targetAgent: AgentName) => string[]> = {
  'claude-code': (target) => ['--dangerously-skip-permissions', '-p', `Обязательно: прочитай и полностью выполни скилл exit-agents из файла .claude/skills/exit-agents/SKILL.md (следуй алгоритму по шагам, идемпотентно). Target agent: ${target}. Не выдавай только план — внеси все нужные изменения в файловую систему. После выполнения кратко перечисли, что создано/изменено.`, '--model', 'sonnet'],
  'cursor': (target) => ['-p', `Обязательно: прочитай и полностью выполни скилл exit-agents из файла .claude/skills/exit-agents/SKILL.md (следуй алгоритму по шагам, идемпотентно). Target agent: ${target}. Не выдавай только план — внеси все нужные изменения в файловую систему. После выполнения кратко перечисли, что создано/изменено.`, '--model', 'composer-2', '--force', '--output-format', 'stream-json'],
  'copilot': (target) => ['-p', `Обязательно: прочитай и полностью выполни скилл exit-agents из файла .claude/skills/exit-agents/SKILL.md (следуй алгоритму по шагам, идемпотентно). Target agent: ${target}. Не выдавай только план — внеси все нужные изменения в файловую систему. После выполнения кратко перечисли, что создано/изменено.`, '--model', 'claude-sonnet-4.6', '--allow-all', '--no-ask-user'],
};

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

  const run = useCallback((agentName: 'claude-code' | 'cursor' | 'copilot', targetAgent: AgentName, aiAgentsConfig: AiAgentsConfig) => {
    setStep('running');
    setOutputLines([]);
    setErrorMessage(null);
    lineBufferRef.current = '';

    const binary = AGENT_BINARIES[agentName];
    const args = AGENT_ARGS[agentName](targetAgent);
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
      if (code === null) {
        // killed by cancel()
        return;
      }
      if (code !== 0) {
        setErrorMessage(`Процесс завершился с кодом ${code}`);
        setStep('error');
        return;
      }

      // AI-агент отработал — запускаем программную очистку
      setStep('disabling');
      disableConventions(targetAgent).then(() => {
        setStep('done');
      }).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        setErrorMessage(message);
        setStep('error');
      });
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
