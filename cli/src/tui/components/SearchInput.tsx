import React from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme';

interface Props {
  value: string;
  onChange: (value: string) => void;
  focused: boolean;
  placeholder?: string;
}

export const SearchInput: React.FC<Props> = ({ value, onChange, focused, placeholder = 'Поиск...' }) => {
  useInput((input, key) => {
    if (!focused) return;
    if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
    } else if (!key.ctrl && !key.meta && input && input.length === 1 && !key.escape && !key.return) {
      onChange(value + input);
    }
  });

  return (
    <Box borderStyle="single" borderColor={focused ? theme.primary : theme.border} paddingX={1}>
      <Text color={theme.muted}>/ </Text>
      <Text color={theme.secondary}>{value || (!focused ? placeholder : '')}</Text>
      {focused && <Text color={theme.primary}>▌</Text>}
    </Box>
  );
};
