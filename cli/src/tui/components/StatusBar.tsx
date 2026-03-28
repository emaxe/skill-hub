import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme';

export type StatusType = 'idle' | 'loading' | 'success' | 'error';

interface Props {
  message?: string;
  status?: StatusType;
}

export const StatusBar: React.FC<Props> = ({ message, status = 'idle' }) => {
  if (!message) return <Box />;

  const color = status === 'error' ? theme.error
    : status === 'success' ? theme.success
    : status === 'loading' ? theme.warning
    : theme.muted;

  const prefix = status === 'loading' ? '⟳ '
    : status === 'success' ? '✓ '
    : status === 'error' ? '✗ '
    : '';

  return (
    <Box paddingX={1}>
      <Text color={color}>{prefix}{message}</Text>
    </Box>
  );
};
