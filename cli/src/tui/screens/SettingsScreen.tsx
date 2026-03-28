import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { AgentName } from '../../catalog';
import { SkillHubConfig } from '../../config';
import { useStatus } from '../contexts/StatusContext';
import { getCachePath, isCloned } from '../../git';
import { HintBar } from '../components/HintBar';
import { theme } from '../theme';

const AGENTS: AgentName[] = ['claude-code', 'cursor', 'copilot'];
const SCOPES: Array<'global' | 'project'> = ['global', 'project'];

type Field = 'agent' | 'scope';

export interface SettingsScreenProps {
  config: SkillHubConfig;
  updateConfig: (updates: Partial<SkillHubConfig>) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ config, updateConfig }) => {
  const { setStatus } = useStatus();

  const [localAgent, setLocalAgent] = useState<AgentName>(config.agent);
  const [localScope, setLocalScope] = useState<'global' | 'project'>(config.defaultScope);
  const [activeField, setActiveField] = useState<Field>('agent');

  const cachePath = getCachePath();
  const cacheInstalled = isCloned(cachePath);

  useInput((input, key) => {
    if (key.upArrow || key.downArrow) {
      setActiveField(f => f === 'agent' ? 'scope' : 'agent');
      return;
    }

    if (key.leftArrow || key.rightArrow) {
      if (activeField === 'agent') {
        const idx = AGENTS.indexOf(localAgent);
        const newIdx = key.leftArrow
          ? (idx - 1 + AGENTS.length) % AGENTS.length
          : (idx + 1) % AGENTS.length;
        setLocalAgent(AGENTS[newIdx]);
      } else if (activeField === 'scope') {
        const idx = SCOPES.indexOf(localScope);
        const newIdx = key.leftArrow
          ? (idx - 1 + SCOPES.length) % SCOPES.length
          : (idx + 1) % SCOPES.length;
        setLocalScope(SCOPES[newIdx]);
      }
      return;
    }

    if (key.return) {
      updateConfig({ agent: localAgent, defaultScope: localScope });
      setStatus('Настройки сохранены', 'success');
    }
  });

  return (
    <Box flexDirection="column" padding={2}>
      {/* Поле Агент */}
      <Box marginBottom={1}>
        <Text color={activeField === 'agent' ? theme.selected : theme.secondary}>
          {activeField === 'agent' ? '▶ ' : '  '}{'Агент:   '}
        </Text>
        <Text color={theme.warning}>[{localAgent}]</Text>
        <Text dimColor> ←→</Text>
      </Box>

      {/* Поле Scope */}
      <Box marginBottom={1}>
        <Text color={activeField === 'scope' ? theme.selected : theme.secondary}>
          {activeField === 'scope' ? '▶ ' : '  '}{'Scope:   '}
        </Text>
        <Text color={theme.warning}>[{localScope}]</Text>
        <Text dimColor> ←→</Text>
      </Box>

      {/* Информация о кэше */}
      <Box marginBottom={2}>
        <Text dimColor>{'  '}{'Кэш:     '}</Text>
        <Text dimColor>{cachePath} </Text>
        <Text color={cacheInstalled ? theme.success : theme.error}>
          {cacheInstalled ? '(установлен)' : '(не установлен)'}
        </Text>
      </Box>

      <HintBar hints={[
        { key: '↑↓', description: 'выбор поля' },
        { key: '←→', description: 'изменить значение' },
        { key: 'Enter', description: 'сохранить' },
      ]} />
    </Box>
  );
};
