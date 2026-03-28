import React from 'react';
import { Box, Text, useInput } from 'ink';
import { Extension, AgentName } from '../../catalog';
import { useRegistry } from '../hooks/useRegistry';
import { useStatus } from '../contexts/StatusContext';
import { HintBar } from '../components/HintBar';
import { theme } from '../theme';

export interface MoveScreenProps {
  extension: Extension;
  currentScope: 'global' | 'project';
  agent: AgentName;
  onBack: () => void;
}

export const MoveScreen: React.FC<MoveScreenProps> = ({ extension, currentScope, agent, onBack }) => {
  const { move } = useRegistry();
  const { setStatus } = useStatus();

  const targetScope = currentScope === 'global' ? 'project' : 'global';

  useInput((_, key) => {
    if (key.escape) {
      onBack();
      return;
    }
    if (key.return) {
      move(extension, agent, currentScope)
        .then(() => {
          setStatus(`Перенесено: ${extension.name} → ${targetScope}`, 'success');
          onBack();
        })
        .catch((err: unknown) => {
          setStatus(String(err), 'error');
          onBack();
        });
    }
  });

  return (
    <Box flexDirection="column" padding={2}>
      <Text bold color={theme.primary}>Перенос: {extension.name}</Text>

      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color={theme.muted}>{'Текущий scope:  '}</Text>
          <Text color={theme.warning}>{currentScope}</Text>
        </Box>
        <Box>
          <Text color={theme.muted}>{'Новый scope:    '}</Text>
          <Text color={theme.success}>{targetScope}</Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color={theme.secondary}>
          {'Перенести '}
          <Text color={theme.primary}>{extension.name}</Text>
          {' из '}
          <Text color={theme.warning}>{currentScope}</Text>
          {' в '}
          <Text color={theme.success}>{targetScope}</Text>
          {'?'}
        </Text>
      </Box>

      <Box marginTop={1}>
        <HintBar hints={[
          { key: 'Enter', description: 'подтвердить' },
          { key: 'Esc', description: 'отмена' },
        ]} />
      </Box>
    </Box>
  );
};
