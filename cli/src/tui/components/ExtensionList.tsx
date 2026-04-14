import React from 'react';
import { Box, Text, useStdout } from 'ink';
import { Extension } from '../../catalog';
import { theme } from '../theme';

interface Props {
  extensions: Extension[];
  selectedIndex: number;
  installedNames?: Set<string>;
  installedScopes?: Map<string, 'global' | 'project' | 'parent'>;
  /** Текущий проект для отображения меток совместимости */
  currentProject?: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  skill: 'skill',
  agent: 'agent',
  command: 'cmd',
};

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export const ExtensionList: React.FC<Props> = ({ extensions, selectedIndex, installedNames, installedScopes, currentProject }) => {
  const { stdout } = useStdout();
  const termWidth = stdout?.columns ?? 80;
  // Fixed columns: selector(2) + type(7) + name(22) + ver(10) + scope(9) + tags(16) + project(12) = 78
  const descWidth = Math.max(10, termWidth - 78 - 2); // 2 for paddingX

  if (extensions.length === 0) {
    return <Box paddingX={2}><Text color={theme.muted}>Ничего не найдено</Text></Box>;
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Table header */}
      <Box flexDirection="row">
        <Box minWidth={2}><Text> </Text></Box>
        <Box minWidth={7}><Text dimColor>TYPE</Text></Box>
        <Box minWidth={22}><Text dimColor>NAME</Text></Box>
        <Box minWidth={10}><Text dimColor>VER</Text></Box>
        <Box minWidth={9}><Text dimColor>SCOPE</Text></Box>
        <Box minWidth={16}><Text dimColor>TAGS</Text></Box>
        <Box minWidth={12}><Text dimColor>PROJECT</Text></Box>
        <Text dimColor>DESCRIPTION</Text>
      </Box>
      {/* Separator */}
      <Box flexDirection="row">
        <Box minWidth={2}><Text> </Text></Box>
        <Box minWidth={7}><Text dimColor>{'─────'}</Text></Box>
        <Box minWidth={22}><Text dimColor>{'────────────────────'}</Text></Box>
        <Box minWidth={10}><Text dimColor>{'────────'}</Text></Box>
        <Box minWidth={9}><Text dimColor>{'───────'}</Text></Box>
        <Box minWidth={16}><Text dimColor>{'──────────────'}</Text></Box>
        <Box minWidth={12}><Text dimColor>{'──────────'}</Text></Box>
        <Text dimColor>{'────────────────────────────────────────'}</Text>
      </Box>
      {/* Rows */}
      {extensions.map((ext, i) => {
        const isSelected = i === selectedIndex;
        const isInstalled = installedNames?.has(ext.name) ?? false;
        const scope = installedScopes?.get(`${ext.type}:${ext.name}`);
        const typeLabel = TYPE_LABELS[ext.type] ?? ext.type;
        const verText = ext.version ? `v${ext.version}${isInstalled ? ' ✓' : ''}` : (isInstalled ? '✓' : '');
        const tagsText = ext.tags.length > 0 ? ext.tags.join(', ') : '—';
        const projectText = ext.projects && ext.projects.length > 0
          ? ext.projects[0] + (ext.projects.length > 1 ? '+' : '')
          : '—';
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
            <Box minWidth={22}>
              <Text color={isSelected ? theme.primary : theme.secondary} bold={isSelected}>
                {truncate(ext.name, 20)}
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
            <Box minWidth={16}>
              <Text color={theme.muted} dimColor>{truncate(tagsText, 15)}</Text>
            </Box>
            <Box minWidth={12}>
              <Text color={projectText === '—' ? theme.muted : theme.accent} dimColor={projectText === '—'}>
                {truncate(projectText, 11)}
              </Text>
            </Box>
            <Text color={theme.muted} dimColor>
              {truncate(ext.description, descWidth)}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};
