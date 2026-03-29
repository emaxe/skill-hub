import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { AgentName } from '../../catalog';
import { SkillHubConfig } from '../../config';
import { useStatus } from '../contexts/StatusContext';
import { getCachePath, isCloned, resetCache, updateCache } from '../../git';
import { HintBar } from '../components/HintBar';
import { theme } from '../theme';
import { useBaseSetup, InstallState } from '../hooks/useBaseSetup';

const AGENTS: AgentName[] = ['claude-code', 'cursor', 'copilot'];
const SCOPES: Array<'global' | 'project'> = ['global', 'project'];

type Field = 'agent' | 'scope' | 'registryUrl' | 'installMcp' | 'installBaseSkill' | 'updateCache' | 'updateAgent';
const BASE_FIELDS: Field[] = ['agent', 'scope', 'registryUrl'];

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

  const setup = useBaseSetup(localAgent);
  const [cacheUpdateState, setCacheUpdateState] = useState<InstallState>('idle');

  const fields = useMemo<Field[]>(() => {
    const extra: Field[] = [];
    if (setup.status?.mcpInstalled === false) extra.push('installMcp');
    if (setup.status?.baseSkillInstalled === false) extra.push('installBaseSkill');
    if (cacheInstalled) extra.push('updateCache');
    if (setup.status?.mcpInstalled === true || setup.status?.baseSkillInstalled === true) extra.push('updateAgent');
    return [...BASE_FIELDS, ...extra];
  }, [setup.status, cacheInstalled]);

  useEffect(() => {
    if (!fields.includes(activeField)) {
      setActiveField('agent');
    }
  }, [fields, activeField]);

  useInput((input, key) => {
    if (key.upArrow || key.downArrow) {
      setActiveField(f => {
        const idx = fields.indexOf(f);
        const next = key.downArrow
          ? (idx + 1) % fields.length
          : (idx - 1 + fields.length) % fields.length;
        return fields[next];
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
      if (activeField === 'installMcp') {
        setup.doInstallMcp()
          .then(() => setStatus('MCP зарегистрирован. Перезапустите агента.', 'success'))
          .catch(() => setStatus('Ошибка регистрации MCP', 'error'));
        return;
      }
      if (activeField === 'installBaseSkill') {
        setup.doInstallBaseSkill()
          .then(() => setStatus('Базовый скил установлен', 'success'))
          .catch(() => setStatus('Ошибка установки скила', 'error'));
        return;
      }
      if (activeField === 'updateCache') {
        setCacheUpdateState('loading');
        updateCache()
          .then(() => {
            setCacheUpdateState('success');
            setStatus('Кэш обновлён', 'success');
          })
          .catch(() => {
            setCacheUpdateState('error');
            setStatus('Ошибка обновления кэша', 'error');
          });
        return;
      }
      if (activeField === 'updateAgent') {
        setup.doUpdateSelf()
          .then(() => setStatus('Агент обновлён', 'success'))
          .catch(() => setStatus('Ошибка обновления агента', 'error'));
        return;
      }
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

  const isInstallField = activeField === 'installMcp' || activeField === 'installBaseSkill';

  return (
    <Box flexDirection="column" padding={2}>
      {/* Поле Агент */}
      <Box marginBottom={1}>
        <Text color={activeField === 'agent' ? theme.selected : theme.secondary}>
          {activeField === 'agent' ? '▶ ' : '  '}{'Агент:        '}
        </Text>
        <Text color={theme.warning}>[{localAgent}]</Text>
        <Text dimColor> ←→</Text>
      </Box>

      {/* Поле Scope */}
      <Box marginBottom={1}>
        <Text color={activeField === 'scope' ? theme.selected : theme.secondary}>
          {activeField === 'scope' ? '▶ ' : '  '}{'Scope:        '}
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
      <Box marginBottom={1}>
        <Text dimColor>{'  '}{'Кэш:          '}</Text>
        <Text dimColor>{cachePath} </Text>
        <Text color={cacheInstalled ? theme.success : theme.error}>
          {cacheInstalled ? '(установлен)' : '(не установлен)'}
        </Text>
      </Box>

      {/* Обновить кэш */}
      {cacheInstalled && (
        <Box marginBottom={2}>
          <Text color={activeField === 'updateCache' ? theme.selected : theme.secondary}>
            {activeField === 'updateCache' ? '▶ ' : '  '}{'Обновить кэш: '}
          </Text>
          {cacheUpdateState === 'loading' && <Text color={theme.warning}>обновляем...</Text>}
          {cacheUpdateState === 'idle' && <Text dimColor>[Enter]</Text>}
          {cacheUpdateState === 'success' && <Text color={theme.success}>✓ обновлён</Text>}
          {cacheUpdateState === 'error' && <Text color={theme.error}>ошибка</Text>}
        </Box>
      )}

      {/* Настройка агента */}
      <Box flexDirection="column" marginBottom={2}>
        <Box marginBottom={1}>
          <Text dimColor>{'  — Настройка ('}{localAgent}{') —'}</Text>
        </Box>

        {/* MCP */}
        {setup.checking ? (
          <Box>
            <Text dimColor>{'  '}{'MCP:          '}</Text>
            <Text dimColor>проверяем...</Text>
          </Box>
        ) : setup.status?.mcpInstalled === null ? (
          <Box>
            <Text dimColor>{'  '}{'MCP:          '}</Text>
            <Text dimColor>не поддерживается</Text>
          </Box>
        ) : setup.status?.mcpInstalled === true ? (
          <Box>
            <Text dimColor>{'  '}{'MCP:          '}</Text>
            <Text color={theme.success}>✓ установлен</Text>
          </Box>
        ) : (
          <Box>
            <Text color={activeField === 'installMcp' ? theme.selected : theme.secondary}>
              {activeField === 'installMcp' ? '▶ ' : '  '}{'MCP:          '}
            </Text>
            <Text color={theme.error}>✗ не установлен  </Text>
            {setup.mcpInstallState === 'loading' && <Text color={theme.warning}>устанавливаем...</Text>}
            {setup.mcpInstallState === 'idle' && <Text dimColor>[Enter — установить]</Text>}
            {setup.mcpInstallState === 'error' && <Text color={theme.error}>ошибка</Text>}
          </Box>
        )}

        {/* Базовый скил */}
        {setup.checking ? (
          <Box>
            <Text dimColor>{'  '}{'Базовый скил: '}</Text>
            <Text dimColor>проверяем...</Text>
          </Box>
        ) : setup.status?.baseSkillInstalled === null ? (
          <Box>
            <Text dimColor>{'  '}{'Базовый скил: '}</Text>
            <Text dimColor>не поддерживается</Text>
          </Box>
        ) : setup.status?.baseSkillInstalled === true ? (
          <Box>
            <Text dimColor>{'  '}{'Базовый скил: '}</Text>
            <Text color={theme.success}>✓ установлен</Text>
          </Box>
        ) : (
          <Box>
            <Text color={activeField === 'installBaseSkill' ? theme.selected : theme.secondary}>
              {activeField === 'installBaseSkill' ? '▶ ' : '  '}{'Базовый скил: '}
            </Text>
            <Text color={theme.error}>✗ не установлен  </Text>
            {setup.baseSkillInstallState === 'loading' && <Text color={theme.warning}>устанавливаем...</Text>}
            {setup.baseSkillInstallState === 'idle' && <Text dimColor>[Enter — установить]</Text>}
            {setup.baseSkillInstallState === 'error' && <Text color={theme.error}>ошибка</Text>}
          </Box>
        )}

        {/* Переустановить MCP + base-skill */}
        {(setup.status?.mcpInstalled === true || setup.status?.baseSkillInstalled === true) && (
          <Box>
            <Text color={activeField === 'updateAgent' ? theme.selected : theme.secondary}>
              {activeField === 'updateAgent' ? '▶ ' : '  '}{'Переустановить: '}
            </Text>
            {setup.updateSelfState === 'loading' && <Text color={theme.warning}>обновляем...</Text>}
            {setup.updateSelfState === 'idle' && <Text dimColor>[Enter — обновить MCP + скил]</Text>}
            {setup.updateSelfState === 'success' && <Text color={theme.success}>✓ обновлено</Text>}
            {setup.updateSelfState === 'error' && <Text color={theme.error}>ошибка</Text>}
          </Box>
        )}
      </Box>

      <HintBar hints={[
        { key: '↑↓', description: 'выбор поля' },
        { key: '←→', description: 'изменить значение' },
        { key: 'Enter', description: isInstallField ? 'установить' : 'сохранить' },
      ]} />
    </Box>
  );
};
