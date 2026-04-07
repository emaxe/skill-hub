import React from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme';

interface Props {
  onGoToSettings: () => void;
  onDismiss: () => void;
}

export const ConventionsWarningDialog: React.FC<Props> = ({ onGoToSettings, onDismiss }) => {
  useInput((_input, key) => {
    if (key.return) onGoToSettings();
    if (key.escape) onDismiss();
  });

  return (
    <Box borderStyle="round" borderColor={theme.warning} flexDirection="column" padding={1}>
      <Text color={theme.warning}>Режим agents-conventions не инициализирован</Text>
      <Text> </Text>
      <Text color={theme.secondary}>Директория .agents/ не найдена. Необходима инициализация.</Text>
      <Text> </Text>
      <Text color={theme.muted}>
        Нажми <Text color={theme.success}>Enter</Text> чтобы перейти в настройки,{' '}
        <Text color={theme.error}>Esc</Text> чтобы закрыть
      </Text>
    </Box>
  );
};
