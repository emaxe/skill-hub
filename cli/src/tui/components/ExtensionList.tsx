import React from 'react';
import { Box, Text } from 'ink';
import { Extension } from '../../catalog';
import { theme } from '../theme';

interface Props {
  extensions: Extension[];
  selectedIndex: number;
  installedNames?: Set<string>;
}

const TYPE_LABELS: Record<string, string> = {
  skill: 'skill',
  agent: 'agent',
  command: 'cmd',
  rule: 'rule',
};

export const ExtensionList: React.FC<Props> = ({ extensions, selectedIndex, installedNames }) => {
  if (extensions.length === 0) {
    return <Box paddingX={2}><Text color={theme.muted}>Ничего не найдено</Text></Box>;
  }

  return (
    <Box flexDirection="column">
      {extensions.map((ext, i) => {
        const isSelected = i === selectedIndex;
        const isInstalled = installedNames?.has(ext.name) ?? false;
        return (
          <Box key={`${ext.type}:${ext.name}`} paddingX={1}>
            <Text color={isSelected ? theme.selected : theme.muted}>
              {isSelected ? '▶ ' : '  '}
            </Text>
            <Text color={theme.muted} dimColor={!isSelected}>
              [{TYPE_LABELS[ext.type] ?? ext.type}]
            </Text>
            <Text> </Text>
            <Text color={isSelected ? theme.primary : theme.secondary} bold={isSelected}>
              {ext.name}
            </Text>
            {ext.version && (
              <Text color={theme.muted} dimColor> v{ext.version}</Text>
            )}
            {isInstalled && <Text color={theme.success}> ✓</Text>}
            <Text color={theme.muted} dimColor>  {ext.description.slice(0, 60)}</Text>
          </Box>
        );
      })}
    </Box>
  );
};
