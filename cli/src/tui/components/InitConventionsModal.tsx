import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { AiAgentsConfig } from '../../config';
import { theme } from '../theme';
import { useConventionsInit } from '../hooks/useConventionsInit';
import { normalizeInput, isUpArrow, isDownArrow } from '../keymap';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

type AiAgentName = 'claude-code' | 'cursor' | 'copilot' | 'codex';

interface InitConventionsModalProps {
  enabledAgents: AiAgentName[];
  aiAgentsConfig: AiAgentsConfig;
  onDone: (chosenAgent: string) => void;
  onCancel: () => void;
}

export const InitConventionsModal: React.FC<InitConventionsModalProps> = ({
  enabledAgents,
  aiAgentsConfig,
  onDone,
  onCancel,
}) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [chosenAgent, setChosenAgent] = useState<string>('');
  const [spinnerIdx, setSpinnerIdx] = useState(0);
  const { stdout } = useStdout();
  const maxOutputHeight = Math.max(5, (stdout?.rows ?? 24) - 12);
  const init = useConventionsInit();

  // Автозапуск enableConventions при монтировании
  useEffect(() => {
    init.run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (init.step !== 'enabling' && init.step !== 'running') return;
    const timer = setInterval(() => {
      setSpinnerIdx(i => (i + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, [init.step]);

  useInput((rawInput, key) => {
    const input = normalizeInput(rawInput);
    if (init.step === 'enabling') return;

    if (init.step === 'running') {
      if (key.escape) {
        init.cancel();
        onCancel();
      }
      return;
    }

    if (init.step === 'done') {
      if (key.return || key.escape) {
        onDone(chosenAgent || 'agents-conventions');
      }
      return;
    }

    if (init.step === 'error') {
      if (input === 'r' || input === 'R') {
        init.reset();
      } else if (key.escape) {
        onCancel();
      }
      return;
    }

    // step === 'selectAgent' — выбор агента для автоанализа
    if (init.step === 'selectAgent') {
      if (isUpArrow(input, key)) {
        setSelectedIdx(i => (i - 1 + Math.max(enabledAgents.length, 1)) % Math.max(enabledAgents.length, 1));
      } else if (isDownArrow(input, key)) {
        setSelectedIdx(i => (i + 1) % Math.max(enabledAgents.length, 1));
      } else if (key.return && enabledAgents.length > 0) {
        const agent = enabledAgents[selectedIdx];
        setChosenAgent(agent);
        init.runAutoAnalysis(agent, aiAgentsConfig);
      } else if (input === 's' || input === 'S') {
        init.skipAutoAnalysis();
      } else if (key.escape) {
        init.skipAutoAnalysis();
      }
      return;
    }
  });

  const isRunning = init.step === 'enabling' || init.step === 'running';

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.border} padding={1} marginTop={1} marginBottom={1}>
      <Box marginBottom={1}>
        <Text color={theme.primary} bold>Инициализация agents-conventions</Text>
      </Box>

      {init.step === 'enabling' && (
        <Box>
          <Text color={theme.warning}>{SPINNER_FRAMES[spinnerIdx]} </Text>
          <Text color={theme.warning}>Создаю структуру .agents/...</Text>
        </Box>
      )}

      {init.step === 'selectAgent' && (
        <>
          <Box marginBottom={1}>
            <Text color={theme.success}>✓ Структура создана</Text>
          </Box>
          {enabledAgents.length === 0 ? (
            <>
              <Box marginBottom={1}>
                <Text dimColor>Нет включённых ИИ-агентов для запуска init-agents скилла.</Text>
              </Box>
              <Box marginBottom={1}>
                <Text dimColor>Включите claude-code, cursor, copilot или codex в разделе ИИ-агенты.</Text>
              </Box>
              <Text dimColor>[S/Esc] пропустить</Text>
            </>
          ) : (
            <>
              <Box marginBottom={1}>
                <Text dimColor>Запустить AI-агент для выполнения init-agents скилла?</Text>
              </Box>
              {enabledAgents.map((agent, idx) => (
                <Box key={agent}>
                  <Text color={idx === selectedIdx ? theme.selected : theme.secondary}>
                    {idx === selectedIdx ? '▶ ' : '  '}{agent}
                  </Text>
                </Box>
              ))}
              <Box marginTop={1}>
                <Text dimColor>[↑↓] выбор  [Enter] запустить  [S] пропустить  [Esc] пропустить</Text>
              </Box>
            </>
          )}
        </>
      )}

      {init.step === 'running' && (
        <>
          <Box marginBottom={1}>
            <Text color={theme.warning}>{SPINNER_FRAMES[spinnerIdx]} </Text>
            <Text color={theme.warning}>Выполнение init-agents скилла через {chosenAgent}...</Text>
          </Box>
          <Box flexDirection="column" height={maxOutputHeight}>
            {init.outputLines.slice(-maxOutputHeight).map((line, idx) => (
              <Box key={idx}>
                <Text dimColor wrap="truncate-end">{'  '}{line}</Text>
              </Box>
            ))}
          </Box>
          {init.outputLines.length === 0 && (
            <Text dimColor>  ожидание вывода...</Text>
          )}
          <Box marginTop={1}>
            <Text dimColor>[Esc] прервать</Text>
          </Box>
        </>
      )}

      {init.step === 'done' && (
        <>
          <Box marginBottom={1}>
            <Text color={theme.success}>✓ Инициализация завершена!</Text>
          </Box>
          {init.outputLines.length > 0 && (
            <Box flexDirection="column" height={Math.min(5, maxOutputHeight)}>
              {init.outputLines.slice(-5).map((line, idx) => (
                <Box key={idx}>
                  <Text dimColor wrap="truncate-end">{'  '}{line}</Text>
                </Box>
              ))}
            </Box>
          )}
          <Box marginTop={1}>
            <Text dimColor>[Enter/Esc] закрыть</Text>
          </Box>
        </>
      )}

      {init.step === 'error' && (
        <>
          <Box marginBottom={1}>
            <Text color={theme.error}>✗ Ошибка: {init.errorMessage}</Text>
          </Box>
          <Box flexDirection="column" height={Math.min(5, maxOutputHeight)}>
            {init.outputLines.slice(-5).map((line, idx) => (
              <Box key={idx}>
                <Text dimColor wrap="truncate-end">{'  '}{line}</Text>
              </Box>
            ))}
          </Box>
          <Box marginTop={1}>
            <Text dimColor>[R] повторить  [Esc] отмена</Text>
          </Box>
        </>
      )}
    </Box>
  );
};
