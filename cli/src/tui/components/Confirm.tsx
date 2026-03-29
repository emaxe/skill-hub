import React from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme';

interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const Confirm: React.FC<Props> = ({ message, onConfirm, onCancel }) => {
  useInput((input, key) => {
    if (input === 'y' || input === 'Y') onConfirm();
    if (input === 'n' || input === 'N' || key.escape) onCancel();
  });

  return (
    <Box borderStyle="round" borderColor={theme.warning} flexDirection="column" padding={1}>
      <Text color={theme.warning}>{message}</Text>
      <Text color={theme.muted}>Нажми <Text color={theme.success}>y</Text> для подтверждения, <Text color={theme.error}>n</Text> или Esc для отмены</Text>
    </Box>
  );
};
