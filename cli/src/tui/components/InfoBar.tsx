import React from 'react';
import { Box, Text } from 'ink';
import { AgentName } from '../../catalog';
import { theme } from '../theme';

interface Props {
  totalCount: number;
  globalCount: number;
  projectCount: number;
  parentCount?: number;
  agent: AgentName;
  defaultScope: 'global' | 'project';
  compact?: boolean;
}

export const InfoBar: React.FC<Props> = ({ totalCount, globalCount, projectCount, parentCount, agent, defaultScope, compact }) => {
  if (compact) {
    return (
      <Box paddingX={1} paddingY={0}>
        <Text color={theme.secondary} bold>Уст: </Text>
        <Text color={theme.primary} bold>{totalCount}</Text>
        <Text color={theme.muted}> (g:</Text>
        <Text color={theme.success} bold>{globalCount}</Text>
        <Text color={theme.muted}> p:</Text>
        <Text color={theme.warning} bold>{projectCount}</Text>
        {parentCount != null && parentCount > 0 ? (
          <>
            <Text color={theme.muted}> par:</Text>
            <Text color={theme.accent} bold>{parentCount}</Text>
          </>
        ) : null}
        <Text color={theme.muted}>)  agent:</Text>
        <Text color={theme.primary}>{agent}</Text>
        <Text color={theme.muted}>  scope:</Text>
        <Text color={theme.primary}>{defaultScope}</Text>
      </Box>
    );
  }

  return (
    <Box paddingX={1} paddingY={0}>
      <Text color={theme.secondary} bold>Установлено: </Text>
      <Text color={theme.primary} bold>{totalCount}</Text>
      <Text color={theme.muted}>  (global: </Text>
      <Text color={theme.success} bold>{globalCount}</Text>
      <Text color={theme.muted}>  project: </Text>
      <Text color={theme.warning} bold>{projectCount}</Text>
      {parentCount != null && parentCount > 0 ? (
        <>
          <Text color={theme.muted}>  parent: </Text>
          <Text color={theme.accent} bold>{parentCount}</Text>
        </>
      ) : null}
      <Text color={theme.muted}>)   │   agent: </Text>
      <Text color={theme.primary}>{agent}</Text>
      <Text color={theme.muted}>   │   scope: </Text>
      <Text color={theme.primary}>{defaultScope}</Text>
    </Box>
  );
};
