import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { AgentName } from '../../catalog';
import { AiAgentsConfig } from '../../config';
import { theme } from '../theme';
import { useConventionsExit } from '../hooks/useConventionsExit';
import { deleteConventionsArtifacts } from '../../conventions';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

type AiAgentName = 'claude-code' | 'cursor' | 'copilot';

interface ExitConventionsModalProps {
  enabledAgents: AiAgentName[];
  targetAgent: AgentName;
  aiAgentsConfig: AiAgentsConfig;
  onDone: () => void;
  onCancel: () => void;
  onSkip: () => void;
}

export const ExitConventionsModal: React.FC<ExitConventionsModalProps> = ({
  enabledAgents,
  targetAgent,
  aiAgentsConfig,
  onDone,
  onCancel,
  onSkip,
}) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [spinnerIdx, setSpinnerIdx] = useState(0);
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const [deleteArtifacts, setDeleteArtifacts] = useState(false);
  const [deletingArtifacts, setDeletingArtifacts] = useState(false);
  const exit = useConventionsExit();

  useEffect(() => {
    if (exit.step !== 'running' && exit.step !== 'disabling') return;
    const timer = setInterval(() => {
      setSpinnerIdx(i => (i + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, [exit.step]);

  useInput((input, key) => {
    if (exit.step === 'running') {
      if (key.escape) {
        exit.cancel();
        onCancel();
      }
      return;
    }

    if (exit.step === 'disabling') return;

    if (exit.step === 'done') {
      if (deletingArtifacts) return;
      if (key.leftArrow || key.rightArrow) {
        setDeleteArtifacts(v => !v);
      } else if (key.return) {
        if (deleteArtifacts) {
          setDeletingArtifacts(true);
          deleteConventionsArtifacts().then(() => {
            onDone();
          }).catch(() => {
            // Игнорируем ошибку удаления — переходим дальше
            onDone();
          });
        } else {
          onDone();
        }
      } else if (key.escape) {
        onDone();
      }
      return;
    }

    if (exit.step === 'error') {
      if (input === 'r' || input === 'R') {
        exit.reset();
      } else if (input === 's' || input === 'S') {
        onSkip();
      } else if (key.escape) {
        onCancel();
      }
      return;
    }

    // step === 'idle'
    if (confirmingSkip) {
      if (input === 'y' || input === 'Y' || key.return) {
        onSkip();
      } else if (input === 'n' || input === 'N' || key.escape) {
        setConfirmingSkip(false);
      }
      return;
    }

    if (key.upArrow) {
      setSelectedIdx(i => (i - 1 + Math.max(enabledAgents.length, 1)) % Math.max(enabledAgents.length, 1));
    } else if (key.downArrow) {
      setSelectedIdx(i => (i + 1) % Math.max(enabledAgents.length, 1));
    } else if (key.return && enabledAgents.length > 0) {
      const agent = enabledAgents[selectedIdx];
      exit.run(agent, targetAgent, aiAgentsConfig);
    } else if (input === 's' || input === 'S') {
      setConfirmingSkip(true);
    } else if (key.escape) {
      onCancel();
    }
  });

  const isRunning = exit.step === 'running';

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.border} padding={1} marginTop={1} marginBottom={1}>
      <Box marginBottom={1}>
        <Text color={theme.primary} bold>Выход из agents-conventions → {targetAgent}</Text>
      </Box>

      {exit.step === 'idle' && !confirmingSkip && (
        <>
          {enabledAgents.length === 0 ? (
            <>
              <Box marginBottom={1}>
                <Text color={theme.warning}>Нет настроенных агентов.</Text>
              </Box>
              <Box marginBottom={1}>
                <Text dimColor>Включите claude-code, cursor или copilot в разделе ИИ-агенты.</Text>
              </Box>
              <Box marginBottom={1}>
                <Text dimColor>Без AI-агента миграция скиллов/правил не выполнится автоматически.</Text>
              </Box>
              <Text dimColor>[S] пропустить (без миграции)  [Esc] отмена</Text>
            </>
          ) : (
            <>
              <Box marginBottom={1}>
                <Text dimColor>Выберите агент для миграции скиллов и правил из .agents/:</Text>
              </Box>
              {enabledAgents.map((agent, idx) => (
                <Box key={agent}>
                  <Text color={idx === selectedIdx ? theme.selected : theme.secondary}>
                    {idx === selectedIdx ? '▶ ' : '  '}{agent}
                  </Text>
                </Box>
              ))}
              <Box marginTop={1}>
                <Text dimColor>[↑↓] выбор  [Enter] запустить  [S] пропустить  [Esc] отмена</Text>
              </Box>
            </>
          )}
        </>
      )}

      {exit.step === 'idle' && confirmingSkip && (
        <>
          <Box marginBottom={1}>
            <Text color={theme.warning}>Пропустить AI-миграцию?</Text>
          </Box>
          <Box marginBottom={1}>
            <Text dimColor>Пользовательские скиллы и правила из .agents/ НЕ будут</Text>
          </Box>
          <Box marginBottom={1}>
            <Text dimColor>скопированы в директорию агента {targetAgent}.</Text>
          </Box>
          <Text dimColor>[Y] да, пропустить  [N/Esc] назад</Text>
        </>
      )}

      {isRunning && (
        <>
          <Box marginBottom={1}>
            <Text color={theme.warning}>{SPINNER_FRAMES[spinnerIdx]} </Text>
            <Text color={theme.warning}>Миграция через AI-агент...</Text>
          </Box>
          {exit.outputLines.map((line, idx) => (
            <Box key={idx}>
              <Text dimColor>{'  '}{line}</Text>
            </Box>
          ))}
          {exit.outputLines.length === 0 && (
            <Text dimColor>  ожидание вывода...</Text>
          )}
          <Box marginTop={1}>
            <Text dimColor>[Esc] прервать</Text>
          </Box>
        </>
      )}

      {exit.step === 'disabling' && (
        <Box>
          <Text color={theme.warning}>{SPINNER_FRAMES[spinnerIdx]} </Text>
          <Text color={theme.warning}>Удаляю структуру conventions...</Text>
        </Box>
      )}

      {exit.step === 'done' && !deletingArtifacts && (
        <>
          <Box marginBottom={1}>
            <Text color={theme.success}>✓ Выход из agents-conventions завершён!</Text>
          </Box>
          {exit.outputLines.slice(-3).map((line, idx) => (
            <Box key={idx}>
              <Text dimColor>{'  '}{line}</Text>
            </Box>
          ))}
          <Box marginTop={1} marginBottom={1}>
            <Text>Удалить .agents/ и AGENTS.md? </Text>
            <Text color={deleteArtifacts ? theme.error : theme.secondary}>
              [{deleteArtifacts ? 'Да' : 'Нет'}]
            </Text>
            <Text dimColor> ←→</Text>
          </Box>
          <Text dimColor>[Enter] подтвердить  [Esc] закрыть</Text>
        </>
      )}

      {exit.step === 'done' && deletingArtifacts && (
        <Box>
          <Text color={theme.warning}>{SPINNER_FRAMES[spinnerIdx]} </Text>
          <Text color={theme.warning}>Удаляю .agents/ и AGENTS.md...</Text>
        </Box>
      )}

      {exit.step === 'error' && (
        <>
          <Box marginBottom={1}>
            <Text color={theme.error}>✗ Ошибка: {exit.errorMessage}</Text>
          </Box>
          {exit.outputLines.slice(-5).map((line, idx) => (
            <Box key={idx}>
              <Text dimColor>{'  '}{line}</Text>
            </Box>
          ))}
          <Box marginTop={1}>
            <Text dimColor>[R] повторить  [S] пропустить (без миграции)  [Esc] отмена</Text>
          </Box>
        </>
      )}
    </Box>
  );
};
