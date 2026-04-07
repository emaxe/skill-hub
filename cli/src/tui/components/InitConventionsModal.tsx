import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { AiAgentsConfig } from '../../config';
import { theme } from '../theme';
import { useConventionsInit } from '../hooks/useConventionsInit';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

type AiAgentName = 'claude-code' | 'cursor' | 'copilot';

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
  const init = useConventionsInit();

  useEffect(() => {
    if (init.step !== 'enabling' && init.step !== 'running') return;
    const timer = setInterval(() => {
      setSpinnerIdx(i => (i + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, [init.step]);

  useInput((input, key) => {
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
        onDone(chosenAgent);
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

    // step === 'idle' (select)
    if (key.upArrow) {
      setSelectedIdx(i => (i - 1 + Math.max(enabledAgents.length, 1)) % Math.max(enabledAgents.length, 1));
    } else if (key.downArrow) {
      setSelectedIdx(i => (i + 1) % Math.max(enabledAgents.length, 1));
    } else if (key.return && enabledAgents.length > 0) {
      const agent = enabledAgents[selectedIdx];
      setChosenAgent(agent);
      init.run(agent, aiAgentsConfig);
    } else if (key.escape) {
      onCancel();
    }
  });

  const isSelect = init.step === 'idle';
  const isRunning = init.step === 'enabling' || init.step === 'running';

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.border} padding={1} marginTop={1} marginBottom={1}>
      <Box marginBottom={1}>
        <Text color={theme.primary} bold>Инициализация agents-conventions</Text>
      </Box>

      {isSelect && (
        <>
          {enabledAgents.length === 0 ? (
            <>
              <Box marginBottom={1}>
                <Text color={theme.warning}>Нет настроенных агентов.</Text>
              </Box>
              <Box marginBottom={1}>
                <Text dimColor>Включите claude-code, cursor или copilot в разделе ИИ-агенты.</Text>
              </Box>
              <Text dimColor>[Esc] отмена</Text>
            </>
          ) : (
            <>
              <Box marginBottom={1}>
                <Text dimColor>Выберите агент для запуска init-agents:</Text>
              </Box>
              {enabledAgents.map((agent, idx) => (
                <Box key={agent}>
                  <Text color={idx === selectedIdx ? theme.selected : theme.secondary}>
                    {idx === selectedIdx ? '▶ ' : '  '}{agent}
                  </Text>
                </Box>
              ))}
              <Box marginTop={1}>
                <Text dimColor>[↑↓] выбор  [Enter] запустить  [Esc] отмена</Text>
              </Box>
            </>
          )}
        </>
      )}

      {init.step === 'enabling' && (
        <Box>
          <Text color={theme.warning}>{SPINNER_FRAMES[spinnerIdx]} </Text>
          <Text color={theme.warning}>Создаю структуру .agents/...</Text>
        </Box>
      )}

      {init.step === 'running' && (
        <>
          <Box marginBottom={1}>
            <Text color={theme.warning}>{SPINNER_FRAMES[spinnerIdx]} </Text>
            <Text color={theme.warning}>Запуск {chosenAgent}...</Text>
          </Box>
          {init.outputLines.map((line, idx) => (
            <Box key={idx}>
              <Text dimColor>{'  '}{line}</Text>
            </Box>
          ))}
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
          {init.outputLines.slice(-5).map((line, idx) => (
            <Box key={idx}>
              <Text dimColor>{'  '}{line}</Text>
            </Box>
          ))}
          <Box marginTop={1}>
            <Text dimColor>[Esc] закрыть</Text>
          </Box>
        </>
      )}

      {init.step === 'error' && (
        <>
          <Box marginBottom={1}>
            <Text color={theme.error}>✗ Ошибка: {init.errorMessage}</Text>
          </Box>
          {init.outputLines.slice(-5).map((line, idx) => (
            <Box key={idx}>
              <Text dimColor>{'  '}{line}</Text>
            </Box>
          ))}
          <Box marginTop={1}>
            <Text dimColor>[R] повторить  [Esc] отмена</Text>
          </Box>
        </>
      )}
    </Box>
  );
};
