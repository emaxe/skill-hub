import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { AgentName } from '../../catalog';
import { SkillHubConfig } from '../../config';
import { useStatus } from '../contexts/StatusContext';
import { getCachePath, isCloned, resetCache } from '../../git';
import { HintBar } from '../components/HintBar';
import { theme } from '../theme';

const AGENTS: AgentName[] = ['claude-code', 'cursor', 'copilot'];
const SCOPES: Array<'global' | 'project'> = ['global', 'project'];

type Field = 'agent' | 'scope' | 'registryUrl';
const FIELDS: Field[] = ['agent', 'scope', 'registryUrl'];

export interface SettingsScreenProps {
  config: SkillHubConfig;
  updateConfig: (updates: Partial<SkillHubConfig>) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ config, updateConfig }) => {
  const { setStatus } = useStatus();

  const [localAgent, setLocalAgent] = useState<AgentName>(config.agent);
  const [localScope, setLocalScope] = useState<'global' | 'project'>(config.defaultScope);
  const [localRegistryUrl, setLocalRegistryUrl] = useState<string>(config.registryUrl);
  const [activeField, setActiveField] = useState<Field>('agent');

  const cachePath = getCachePath();
  const cacheInstalled = isCloned(cachePath);

  useInput((input, key) => {
    if (key.upArrow || key.downArrow) {
      setActiveField(f => {
        const idx = FIELDS.indexOf(f);
        const next = key.downArrow
          ? (idx + 1) % FIELDS.length
          : (idx - 1 + FIELDS.length) % FIELDS.length;
        return FIELDS[next];
      });
      return;
    }

    if (activeField === 'registryUrl') {
      if (key.backspace || key.delete) {
        setLocalRegistryUrl(prev => prev.slice(0, -1));
        return;
      }
      if (input && !key.return && !key.escape && !key.leftArrow && !key.rightArrow) {
        setLocalRegistryUrl(prev => prev + input);
        return;
      }
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
      const urlChanged = localRegistryUrl !== config.registryUrl;
      updateConfig({ agent: localAgent, defaultScope: localScope, registryUrl: localRegistryUrl });
      if (urlChanged) {
        resetCache();
        setStatus('Настройки сохранены. Кэш сброшен.', 'success');
      } else {
        setStatus('Настройки сохранены', 'success');
      }
    }
  });

  return (
    <Box flexDirection="column" padding={2}>
      {/* Поле Агент */}
      <Box marginBottom={1}>
        <Text color={activeField === 'agent' ? theme.selected : theme.secondary}>
          {activeField === 'agent' ? '▶ ' : '  '}{'Агент:       '}
        </Text>
        <Text color={theme.warning}>[{localAgent}]</Text>
        <Text dimColor> ←→</Text>
      </Box>

      {/* Поле Scope */}
      <Box marginBottom={1}>
        <Text color={activeField === 'scope' ? theme.selected : theme.secondary}>
          {activeField === 'scope' ? '▶ ' : '  '}{'Scope:       '}
        </Text>
        <Text color={theme.warning}>[{localScope}]</Text>
        <Text dimColor> ←→</Text>
      </Box>

      {/* Поле Registry URL */}
      <Box marginBottom={1}>
        <Text color={activeField === 'registryUrl' ? theme.selected : theme.secondary}>
          {activeField === 'registryUrl' ? '▶ ' : '  '}{'Registry URL: '}
        </Text>
        <Text color={theme.warning}>
          {localRegistryUrl}
          {activeField === 'registryUrl' ? '▌' : ''}
        </Text>
      </Box>

      {/* Информация о кэше */}
      <Box marginBottom={2}>
        <Text dimColor>{'  '}{'Кэш:          '}</Text>
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
