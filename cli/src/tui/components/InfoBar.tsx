import React from 'react';
import { Box, Text } from 'ink';
import { AgentName } from '../../catalog';
import { theme } from '../theme';

interface Props {
  totalCount: number;
  globalCount: number;
  projectCount: number;
  agent: AgentName;
  defaultScope: 'global' | 'project';
}

export const InfoBar: React.FC<Props> = ({ totalCount, globalCount, projectCount, agent, defaultScope }) => (
  <Box paddingX={1}>
    <Text color={theme.secondary}>Установлено: </Text>
    <Text color={theme.primary} bold>{totalCount}</Text>
    <Text color={theme.muted}>  (global: </Text>
    <Text color={theme.success}>{globalCount}</Text>
    <Text color={theme.muted}>  project: </Text>
    <Text color={theme.warning}>{projectCount}</Text>
    <Text color={theme.muted}>)   │   agent: </Text>
    <Text color={theme.accent}>{agent}</Text>
    <Text color={theme.muted}>   │   scope: </Text>
    <Text color={theme.accent}>{defaultScope}</Text>
  </Box>
);
