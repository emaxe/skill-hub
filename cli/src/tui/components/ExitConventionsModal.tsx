import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { AgentName } from '../../catalog';
import { AiAgentsConfig } from '../../config';
import { theme } from '../theme';
import { useConventionsExit } from '../hooks/useConventionsExit';
import { deleteConventionsArtifacts } from '../../conventions';
import { normalizeInput, isUpArrow, isDownArrow, isLeftArrow, isRightArrow } from '../keymap';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

type AiAgentName = 'claude-code' | 'cursor' | 'copilot' | 'codex';

interface ExitConventionsModalProps {
  targetAgent: AgentName;
  enabledAgents: AiAgentName[];
  aiAgentsConfig: AiAgentsConfig;
  onDone: () => void;
  onCancel: () => void;
}

export const ExitConventionsModal: React.FC<ExitConventionsModalProps> = ({
  targetAgent,
  enabledAgents,
  aiAgentsConfig,
  onDone,
  onCancel,
}) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [spinnerIdx, setSpinnerIdx] = useState(0);
  const [deleteArtifacts, setDeleteArtifacts] = useState(false);
  const [deletingArtifacts, setDeletingArtifacts] = useState(false);
  const { stdout } = useStdout();
  const maxOutputHeight = Math.max(5, (stdout?.rows ?? 24) - 12);
  const exit = useConventionsExit();

  // Автозапуск — показываем выбор AI-агента
  useEffect(() => {
    exit.start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (exit.step !== 'running' && exit.step !== 'disabling') return;
    const timer = setInterval(() => {
      setSpinnerIdx(i => (i + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, [exit.step]);

  useInput((rawInput, key) => {
    const input = normalizeInput(rawInput);

    if (exit.step === 'running' || exit.step === 'disabling') {
      if (key.escape && exit.step === 'running') {
        exit.cancel();
        onCancel();
      }
      return;
    }

    if (exit.step === 'done') {
      if (deletingArtifacts) return;
      if (isLeftArrow(input, key) || isRightArrow(input, key)) {
        setDeleteArtifacts(v => !v);
      } else if (key.return) {
        if (deleteArtifacts) {
          setDeletingArtifacts(true);
          deleteConventionsArtifacts().then(() => {
            onDone();
          }).catch(() => {
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
        setTimeout(() => exit.start(), 0);
      } else if (key.escape) {
        onCancel();
      }
      return;
    }

    // step === 'selectAgent' — выбор AI-агента для exit-agents
    if (exit.step === 'selectAgent') {
      if (isUpArrow(input, key)) {
        setSelectedIdx(i => (i - 1 + Math.max(enabledAgents.length, 1)) % Math.max(enabledAgents.length, 1));
      } else if (isDownArrow(input, key)) {
        setSelectedIdx(i => (i + 1) % Math.max(enabledAgents.length, 1));
      } else if (key.return && enabledAgents.length > 0) {
        const agent = enabledAgents[selectedIdx];
        exit.runWithAgent(agent, aiAgentsConfig, targetAgent);
      } else if (input === 's' || input === 'S') {
        exit.skipAgent(targetAgent);
      } else if (key.escape) {
        exit.skipAgent(targetAgent);
      }
      return;
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.border} padding={1} marginTop={1} marginBottom={1}>
      <Box marginBottom={1}>
        <Text color={theme.primary} bold>Выход из agents-conventions → {targetAgent}</Text>
      </Box>

      {exit.step === 'selectAgent' && (
        <>
          {enabledAgents.length === 0 ? (
            <>
              <Box marginBottom={1}>
                <Text dimColor>Нет включённых ИИ-агентов для запуска exit-agents скилла.</Text>
              </Box>
              <Text dimColor>[S/Esc] пропустить → выполнить программную миграцию</Text>
            </>
          ) : (
            <>
              <Box marginBottom={1}>
                <Text dimColor>Запустить AI-агент для выполнения exit-agents скилла перед миграцией?</Text>
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

      {exit.step === 'running' && (
        <>
          <Box marginBottom={1}>
            <Text color={theme.warning}>{SPINNER_FRAMES[spinnerIdx]} </Text>
            <Text color={theme.warning}>Выполнение exit-agents скилла...</Text>
          </Box>
          <Box flexDirection="column" height={maxOutputHeight}>
            {exit.outputLines.slice(-maxOutputHeight).map((line, idx) => (
              <Box key={idx}>
                <Text dimColor wrap="truncate-end">{'  '}{line}</Text>
              </Box>
            ))}
          </Box>
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
          <Text color={theme.warning}>Миграция и очистка...</Text>
        </Box>
      )}

      {exit.step === 'done' && !deletingArtifacts && (
        <>
          <Box marginBottom={1}>
            <Text color={theme.success}>✓ Выход из agents-conventions завершён!</Text>
          </Box>
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
          <Box flexDirection="column" height={Math.min(5, maxOutputHeight)}>
            {exit.outputLines.slice(-5).map((line, idx) => (
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
