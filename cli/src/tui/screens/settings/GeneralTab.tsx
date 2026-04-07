import React from 'react';
import { Box, Text } from 'ink';
import { AgentName } from '../../../catalog';
import { InstallState } from '../../hooks/useBaseSetup';
import { theme } from '../../theme';

type Field = 'agent' | 'scope' | 'registryUrl' | 'updateCache';

interface Props {
  localAgent: AgentName;
  localScope: 'global' | 'project';
  localRegistryUrl: string;
  cachePath: string;
  cacheInstalled: boolean;
  cacheUpdateState: InstallState;
  activeField: string;
}

export const GeneralTab: React.FC<Props> = ({
  localAgent,
  localScope,
  localRegistryUrl,
  cachePath,
  cacheInstalled,
  cacheUpdateState,
  activeField,
}) => (
  <Box flexDirection="column">
    {/* Агент */}
    <Box marginBottom={1}>
      <Text color={activeField === 'agent' ? theme.selected : theme.secondary}>
        {activeField === 'agent' ? '▶ ' : '  '}{'Агент:        '}
      </Text>
      <Text color={theme.warning}>[{localAgent}]</Text>
      <Text dimColor> ←→</Text>
    </Box>

    {/* Scope */}
    <Box marginBottom={1}>
      <Text color={activeField === 'scope' ? theme.selected : theme.secondary}>
        {activeField === 'scope' ? '▶ ' : '  '}{'Scope:        '}
      </Text>
      <Text color={theme.warning}>[{localScope}]</Text>
      {localAgent === 'agents-conventions'
        ? <Text dimColor> (только project)</Text>
        : <Text dimColor> ←→</Text>}
    </Box>

    {/* Registry URL */}
    <Box marginBottom={1}>
      <Text color={activeField === 'registryUrl' ? theme.selected : theme.secondary}>
        {activeField === 'registryUrl' ? '▶ ' : '  '}{'Registry URL: '}
      </Text>
      <Text color={theme.warning}>
        {localRegistryUrl}
        {activeField === 'registryUrl' ? '▌' : ''}
      </Text>
    </Box>

    {/* Кэш */}
    <Box marginBottom={1}>
      <Text dimColor>{'  '}{'Кэш:          '}</Text>
      <Text dimColor>{cachePath} </Text>
      <Text color={cacheInstalled ? theme.success : theme.error}>
        {cacheInstalled ? '(установлен)' : '(не установлен)'}
      </Text>
    </Box>

    {/* Обновить кэш */}
    {cacheInstalled && (
      <Box marginBottom={1}>
        <Text color={activeField === 'updateCache' ? theme.selected : theme.secondary}>
          {activeField === 'updateCache' ? '▶ ' : '  '}{'Обновить кэш: '}
        </Text>
        {cacheUpdateState === 'loading' && <Text color={theme.warning}>обновляем...</Text>}
        {cacheUpdateState === 'idle' && <Text dimColor>[Enter]</Text>}
        {cacheUpdateState === 'success' && <Text color={theme.success}>✓ обновлён</Text>}
        {cacheUpdateState === 'error' && <Text color={theme.error}>ошибка</Text>}
      </Box>
    )}
  </Box>
);
