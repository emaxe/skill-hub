import React from 'react';
import { Box, Text } from 'ink';
import { ExtensionType } from '../../catalog';
import { theme } from '../theme';

const TYPE_OPTIONS: { value: ExtensionType | 'all'; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'skill', label: 'Skills' },
  { value: 'agent', label: 'Agents' },
  { value: 'command', label: 'Commands' },
];

const COMPACT_TYPE_LABELS: Record<ExtensionType | 'all', string> = {
  all: '*',
  skill: 'S',
  agent: 'A',
  command: 'C',
};

interface Props {
  activeType: ExtensionType | 'all';
  onTypeChange: (type: ExtensionType | 'all') => void;
  compact?: boolean;
}

export const FilterBar: React.FC<Props> = ({ activeType, compact }) => (
  <Box paddingX={1}>
    <Text color={theme.muted}>Тип </Text>
    <Text color={theme.warning}>[t]</Text>
    <Text color={theme.muted}>: </Text>
    {TYPE_OPTIONS.map(opt => (
      <React.Fragment key={opt.value}>
        <Text color={theme.muted}>{compact ? ' ' : '  '}</Text>
        <Text
          color={activeType === opt.value ? theme.selected : theme.muted}
          bold={activeType === opt.value}
        >
          {compact ? COMPACT_TYPE_LABELS[opt.value] : opt.label}
        </Text>
      </React.Fragment>
    ))}
  </Box>
);
