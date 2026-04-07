import React from 'react';
import { Box, Text } from 'ink';
import { Extension } from '../../catalog';
import { theme } from '../theme';

interface Props {
  extensions: Extension[];
  selectedIndex: number;
  installedNames?: Set<string>;
  installedScopes?: Map<string, 'global' | 'project' | 'parent'>;
}

const TYPE_LABELS: Record<string, string> = {
  skill: 'skill',
  agent: 'agent',
  command: 'cmd',
  rule: 'rule',
};

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export const ExtensionList: React.FC<Props> = ({ extensions, selectedIndex, installedNames, installedScopes }) => {
  if (extensions.length === 0) {
    return <Box paddingX={2}><Text color={theme.muted}>Ничего не найдено</Text></Box>;
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Table header */}
      <Box flexDirection="row">
        <Box minWidth={2}><Text> </Text></Box>
        <Box minWidth={7}><Text dimColor>TYPE</Text></Box>
        <Box minWidth={24}><Text dimColor>NAME</Text></Box>
        <Box minWidth={10}><Text dimColor>VER</Text></Box>
        <Box minWidth={9}><Text dimColor>SCOPE</Text></Box>
        <Text dimColor>DESCRIPTION</Text>
      </Box>
      {/* Separator */}
      <Box flexDirection="row">
        <Box minWidth={2}><Text> </Text></Box>
        <Box minWidth={7}><Text dimColor>{'─────'}</Text></Box>
        <Box minWidth={24}><Text dimColor>{'──────────────────────'}</Text></Box>
        <Box minWidth={10}><Text dimColor>{'────────'}</Text></Box>
        <Box minWidth={9}><Text dimColor>{'───────'}</Text></Box>
        <Text dimColor>{'────────────────────────────────────────'}</Text>
      </Box>
      {/* Rows */}
      {extensions.map((ext, i) => {
        const isSelected = i === selectedIndex;
        const isInstalled = installedNames?.has(ext.name) ?? false;
        const scope = installedScopes?.get(`${ext.type}:${ext.name}`);
        const typeLabel = TYPE_LABELS[ext.type] ?? ext.type;
        const verText = ext.version ? `v${ext.version}${isInstalled ? ' ✓' : ''}` : (isInstalled ? '✓' : '');
        return (
          <Box key={`${ext.type}:${ext.name}`} flexDirection="row">
            <Box minWidth={2}>
              <Text color={isSelected ? theme.selected : theme.muted}>
                {isSelected ? '▶' : ' '}
              </Text>
            </Box>
            <Box minWidth={7}>
              <Text color={theme.accent} dimColor={!isSelected}>{typeLabel}</Text>
            </Box>
            <Box minWidth={24}>
              <Text color={isSelected ? theme.primary : theme.secondary} bold={isSelected}>
                {truncate(ext.name, 22)}
              </Text>
            </Box>
            <Box minWidth={10}>
              <Text color={isInstalled ? theme.success : theme.muted} dimColor={!isInstalled}>
                {truncate(verText, 9)}
              </Text>
            </Box>
            <Box minWidth={9}>
              {scope ? (
                <Text color={scope === 'global' ? theme.success : scope === 'parent' ? theme.accent : theme.warning}>{scope}</Text>
              ) : (
                <Text dimColor>{'—'}</Text>
              )}
            </Box>
            <Text color={theme.muted} dimColor>
              {truncate(ext.description, 42)}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};
