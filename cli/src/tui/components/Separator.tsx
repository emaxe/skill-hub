import React from 'react';
import { Box, Text, useStdout } from 'ink';
import { theme } from '../theme';

export const Separator: React.FC = () => {
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;
  return (
    <Box>
      <Text color={theme.border} dimColor>{'─'.repeat(width)}</Text>
    </Box>
  );
};
