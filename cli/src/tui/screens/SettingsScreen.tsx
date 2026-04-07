import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { AgentName } from '../../catalog';
import { SkillHubConfig, AiAgentsConfig, ConfigSource } from '../../config';
import { useStatus } from '../contexts/StatusContext';
import { getCachePath, isCloned, resetCache, updateCache } from '../../git';
import { HintBar } from '../components/HintBar';
import { SubTabBar } from '../components/SubTabBar';
import { theme } from '../theme';
import { useBaseSetup, InstallState } from '../hooks/useBaseSetup';
import { InitConventionsModal } from '../components/InitConventionsModal';
import { ExitConventionsModal } from '../components/ExitConventionsModal';
import { getConventionsStatus, ConventionsStatus, disableConventions } from '../../conventions';
import { GeneralTab, AiAgentsTab, SetupTab } from './settings';

const AGENTS: AgentName[] = ['claude-code', 'cursor', 'copilot', 'agents-conventions'];
const SCOPES: Array<'global' | 'project'> = ['global', 'project'];

type Field = 'agent' | 'scope' | 'registryUrl' | 'installMcp' | 'installBaseSkill' | 'updateCache' | 'updateAgent'
  | 'initConventions'
  | 'saveAsGlobal' | 'resetToGlobal' | 'createProjectConfig'
  | `aiAgent:${AgentName}`
  | 'aiProxy'
  | `aiAgentProxy:${AgentName}`;

const AI_AGENTS: AgentName[] = ['claude-code', 'cursor', 'copilot'];
const AI_AGENT_FIELDS: Field[] = [
  ...AI_AGENTS.map(a => `aiAgent:${a}` as Field),
  'aiProxy',
  ...AI_AGENTS.map(a => `aiAgentProxy:${a}` as Field),
];

type SettingsSubTab = 'general' | 'aiAgents';
const SETTINGS_SUBTABS: SettingsSubTab[] = ['general', 'aiAgents'];
const SUBTAB_ITEMS = [
  { id: 'general', label: 'Основное' },
  { id: 'aiAgents', label: 'AI-агенты' },
];

export interface SettingsScreenProps {
  config: SkillHubConfig;
  updateConfig: (updates: Partial<SkillHubConfig>) => void;
  onEditingChange?: (editing: boolean) => void;
  configSource: ConfigSource;
  hasProjectRoot: boolean;
  onSaveAsGlobal: () => boolean;
  onResetToGlobal: () => SkillHubConfig | null;
  onCreateProjectConfig: () => boolean;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ config, updateConfig, onEditingChange, configSource, hasProjectRoot, onSaveAsGlobal, onResetToGlobal, onCreateProjectConfig }) => {
  const { setStatus } = useStatus();

  const [localAgent, setLocalAgent] = useState<AgentName>(config.agent);
  const [showModal, setShowModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitTargetAgent, setExitTargetAgent] = useState<AgentName>('claude-code');
  const [localScope, setLocalScope] = useState<'global' | 'project'>(config.defaultScope);
  const [localRegistryUrl, setLocalRegistryUrl] = useState<string>(config.registryUrl);
  const [localAiAgents, setLocalAiAgents] = useState<AiAgentsConfig>(config.aiAgents);
  const [activeField, setActiveField] = useState<Field>('agent');
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('general');

  const cachePath = getCachePath();
  const cacheInstalled = isCloned(cachePath);

  const conventionsStatus: ConventionsStatus | null = localAgent === 'agents-conventions'
    ? getConventionsStatus()
    : null;
  const isConventionsInitialized = conventionsStatus?.hasAgentsDir ?? false;
  const isConventionsHealthy = conventionsStatus?.isHealthy ?? false;

  const setup = useBaseSetup(localAgent);
  const [cacheUpdateState, setCacheUpdateState] = useState<InstallState>('idle');

  const fields = useMemo<Field[]>(() => {
    switch (activeSubTab) {
      case 'general': {
        const f: Field[] = ['agent', 'scope', 'registryUrl'];
        if (cacheInstalled) f.push('updateCache');
        if (configSource === 'project') {
          f.push('saveAsGlobal', 'resetToGlobal');
        } else if (hasProjectRoot) {
          f.push('createProjectConfig');
        }
        if (localAgent === 'agents-conventions') {
          f.push('initConventions');
        } else {
          if (setup.status?.mcpInstalled === false) f.push('installMcp');
          if (setup.status?.baseSkillInstalled === false) f.push('installBaseSkill');
          if (setup.status?.mcpInstalled === true || setup.status?.baseSkillInstalled === true) f.push('updateAgent');
        }
        return f;
      }
      case 'aiAgents':
        return [...AI_AGENT_FIELDS];
    }
  }, [activeSubTab, localAgent, setup.status, cacheInstalled, configSource, hasProjectRoot]);

  useEffect(() => {
    if (fields.length > 0) {
      setActiveField(fields[0]);
    }
  }, [activeSubTab]);

  useEffect(() => {
    if (!fields.includes(activeField) && fields.length > 0) {
      setActiveField(fields[0]);
    }
  }, [fields, activeField]);

  useEffect(() => {
    onEditingChange?.(activeField === 'registryUrl' || activeField === 'aiProxy');
  }, [activeField, onEditingChange]);

  useInput((input, key) => {
    if (showModal) return;

    if (key.tab) {
      const idx = SETTINGS_SUBTABS.indexOf(activeSubTab);
      const next = key.shift
        ? (idx - 1 + SETTINGS_SUBTABS.length) % SETTINGS_SUBTABS.length
        : (idx + 1) % SETTINGS_SUBTABS.length;
      setActiveSubTab(SETTINGS_SUBTABS[next]);
      return;
    }

    if (key.upArrow || key.downArrow) {
      if (fields.length === 0) return;
      setActiveField(f => {
        const idx = fields.indexOf(f);
        const next = key.downArrow
          ? (idx + 1) % fields.length
          : (idx - 1 + fields.length) % fields.length;
        return fields[next];
      });
      return;
    }

    if (activeField === 'registryUrl' || activeField === 'aiProxy') {
      if (key.backspace || key.delete) {
        if (activeField === 'aiProxy') {
          setLocalAiAgents(prev => ({ ...prev, proxy: prev.proxy.slice(0, -1) }));
        } else {
          setLocalRegistryUrl(prev => prev.slice(0, -1));
        }
        return;
      }
      if (input && !key.return && !key.escape && !key.leftArrow && !key.rightArrow) {
        if (activeField === 'aiProxy') {
          setLocalAiAgents(prev => ({ ...prev, proxy: prev.proxy + input }));
        } else {
          setLocalRegistryUrl(prev => prev + input);
        }
        return;
      }
    }

    if (key.leftArrow || key.rightArrow) {
      if (activeField === 'agent') {
        const idx = AGENTS.indexOf(localAgent);
        const newIdx = key.leftArrow
          ? (idx - 1 + AGENTS.length) % AGENTS.length
          : (idx + 1) % AGENTS.length;
        const newAgent = AGENTS[newIdx];
        if (newAgent === 'agents-conventions') {
          setLocalScope('project');
        }
        setLocalAgent(newAgent);
      } else if (activeField === 'scope') {
        if (localAgent === 'agents-conventions') return;
        const idx = SCOPES.indexOf(localScope);
        const newIdx = key.leftArrow
          ? (idx - 1 + SCOPES.length) % SCOPES.length
          : (idx + 1) % SCOPES.length;
        setLocalScope(SCOPES[newIdx]);
      } else if (activeField.startsWith('aiAgent:')) {
        const agentName = activeField.slice('aiAgent:'.length) as AgentName;
        setLocalAiAgents(prev => ({
          ...prev,
          agents: {
            ...prev.agents,
            [agentName]: { ...prev.agents[agentName], enabled: !prev.agents[agentName].enabled },
          },
        }));
      } else if (activeField.startsWith('aiAgentProxy:')) {
        if (!localAiAgents.proxy) return;
        const agentName = activeField.slice('aiAgentProxy:'.length) as AgentName;
        setLocalAiAgents(prev => ({
          ...prev,
          agents: {
            ...prev.agents,
            [agentName]: { ...prev.agents[agentName], useProxy: !prev.agents[agentName].useProxy },
          },
        }));
      }
      return;
    }

    if (key.return) {
      if (activeField === 'createProjectConfig') {
        if (onCreateProjectConfig()) {
          setStatus('Проектный конфиг создан (.skill-hub.json)', 'success');
        } else {
          setStatus('Не удалось создать проектный конфиг', 'error');
        }
        return;
      }
      if (activeField === 'saveAsGlobal') {
        if (onSaveAsGlobal()) {
          setStatus('Проектные настройки сохранены как глобальные', 'success');
        } else {
          setStatus('Не удалось сохранить', 'error');
        }
        return;
      }
      if (activeField === 'resetToGlobal') {
        const fresh = onResetToGlobal();
        if (fresh) {
          setLocalAgent(fresh.agent);
          setLocalScope(fresh.defaultScope);
          setLocalRegistryUrl(fresh.registryUrl);
          setLocalAiAgents(fresh.aiAgents);
          setStatus('Проектные настройки сброшены на глобальные', 'success');
        } else {
          setStatus('Не удалось сбросить', 'error');
        }
        return;
      }
      if (activeField === 'initConventions') {
        setShowModal(true);
        return;
      }
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
        if (cacheUpdateState === 'loading') return;
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
        if (setup.updateSelfState === 'loading') return;
        setup.doUpdateSelf()
          .then(() => setStatus('Агент обновлён', 'success'))
          .catch(() => setStatus('Ошибка обновления агента', 'error'));
        return;
      }
      // Если переключаемся НА agents-conventions и не инициализировано — показать модалку
      if (localAgent === 'agents-conventions' && !isConventionsInitialized && config.agent !== 'agents-conventions') {
        setShowModal(true);
        return;
      }
      // Если уходим из agents-conventions — показать exit-flow
      if (config.agent === 'agents-conventions' && localAgent !== 'agents-conventions') {
        setExitTargetAgent(localAgent);
        setShowExitModal(true);
        return;
      }
      const urlChanged = localRegistryUrl !== config.registryUrl;
      updateConfig({ agent: localAgent, defaultScope: localScope, registryUrl: localRegistryUrl, aiAgents: localAiAgents });
      if (urlChanged) {
        resetCache();
        setStatus('Настройки сохранены. Кэш сброшен.', 'success');
      } else {
        setStatus('Настройки сохранены', 'success');
      }
    }
  });

  const isActionField = activeField === 'installMcp'
    || activeField === 'installBaseSkill'
    || activeField === 'updateCache'
    || activeField === 'updateAgent'
    || activeField === 'initConventions'
    || activeField === 'saveAsGlobal'
    || activeField === 'resetToGlobal'
    || activeField === 'createProjectConfig';

  if (showModal) {
    const enabledAgents = (['claude-code', 'cursor', 'copilot'] as const)
      .filter(a => localAiAgents.agents[a]?.enabled);
    return (
      <Box flexDirection="column" padding={2}>
        <InitConventionsModal
          enabledAgents={enabledAgents}
          aiAgentsConfig={localAiAgents}
          onDone={() => {
            setShowModal(false);
            updateConfig({ agent: 'agents-conventions', defaultScope: 'project', registryUrl: localRegistryUrl, aiAgents: localAiAgents });
            setStatus('agents-conventions инициализирован', 'success');
          }}
          onCancel={() => {
            setShowModal(false);
          }}
        />
      </Box>
    );
  }

  if (showExitModal) {
    const enabledAgents = (['claude-code', 'cursor', 'copilot'] as const)
      .filter(a => localAiAgents.agents[a]?.enabled);
    return (
      <Box flexDirection="column" padding={2}>
        <ExitConventionsModal
          enabledAgents={enabledAgents}
          targetAgent={exitTargetAgent}
          aiAgentsConfig={localAiAgents}
          onDone={() => {
            setShowExitModal(false);
            setLocalAgent(exitTargetAgent);
            updateConfig({ agent: exitTargetAgent, defaultScope: localScope, registryUrl: localRegistryUrl, aiAgents: localAiAgents });
            setStatus('agents-conventions деактивирован', 'success');
          }}
          onCancel={() => {
            setShowExitModal(false);
          }}
          onSkip={() => {
            setShowExitModal(false);
            disableConventions(exitTargetAgent).then(() => {
              setLocalAgent(exitTargetAgent);
              updateConfig({ agent: exitTargetAgent, defaultScope: localScope, registryUrl: localRegistryUrl, aiAgents: localAiAgents });
              setStatus('agents-conventions деактивирован (без миграции)', 'success');
            }).catch(() => {
              setStatus('Ошибка при деактивации agents-conventions', 'error');
            });
          }}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={2}>
      <SubTabBar tabs={SUBTAB_ITEMS} activeTab={activeSubTab} />

      {activeSubTab === 'general' && (
        <>
          <GeneralTab
            localAgent={localAgent}
            localScope={localScope}
            localRegistryUrl={localRegistryUrl}
            cachePath={cachePath}
            cacheInstalled={cacheInstalled}
            cacheUpdateState={cacheUpdateState}
            activeField={activeField}
            configSource={configSource}
            hasProjectRoot={hasProjectRoot}
          />
          <Box flexDirection="column" borderStyle="round" borderColor={theme.border} paddingX={1} marginTop={1}>
            <SetupTab
              localAgent={localAgent}
              setup={setup}
              conventionsStatus={conventionsStatus}
              isConventionsInitialized={isConventionsInitialized}
              isConventionsHealthy={isConventionsHealthy}
              activeField={activeField}
            />
          </Box>
        </>
      )}
      {activeSubTab === 'aiAgents' && (
        <AiAgentsTab
          localAiAgents={localAiAgents}
          activeField={activeField}
        />
      )}

      <Box marginTop={1}>
        <HintBar hints={[
          { key: 'Tab', description: 'подвкладка' },
          { key: '↑↓', description: 'выбор поля' },
          { key: '←→', description: 'изменить значение' },
          { key: 'Enter', description: isActionField ? 'установить' : 'сохранить' },
        ]} />
      </Box>
    </Box>
  );
};
