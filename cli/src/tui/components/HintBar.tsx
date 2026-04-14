import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme';

export interface Hint {
  key: string;
  description: string;
}

interface Props {
  hints: Hint[];
}

export const HintBar: React.FC<Props> = ({ hints }) => (
  <Box paddingX={1}>
    {hints.map((hint, i) => (
      <React.Fragment key={hint.key}>
        {i > 0 && <Text color={theme.muted}>  </Text>}
        <Text color={theme.accent}>[{hint.key}]</Text>
        <Text color={theme.muted}> {hint.description}</Text>
      </React.Fragment>
    ))}
  </Box>
);
