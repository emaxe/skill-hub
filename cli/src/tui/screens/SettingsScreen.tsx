/**
 * Экран настроек — самый сложный экран TUI.
 *
 * Две подвкладки (SubTabBar): «Основное» и «AI-агенты».
 * Динамический список полей (fields) зависит от текущей подвкладки и контекста.
 * Клавиатура: Tab — подвкладка, ↑↓ — поле, ←→ — значение, Enter — действие/сохранение.
 * Модалки: InitConventionsModal (включение), ExitConventionsModal (выключение), TextEditModal (URL/proxy).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { AgentName } from '../../catalog';
import { SkillHubConfig, AiAgentsConfig, ConfigSource, pushHistory, resolveProject, ResolvedProject, loadProjectExtensions, loadGitignoreAgentDirs, saveGitignoreAgentDirs, findProjectRoot } from '../../config';
import { useStatus } from '../contexts/StatusContext';
import { getCachePath, isCloned, resetCache, fullCatalogReset, updateCache, ensureCache } from '../../git';
import { HintBar } from '../components/HintBar';
import { SubTabBar } from '../components/SubTabBar';
import { theme } from '../theme';
import { useBaseSetup, InstallState } from '../hooks/useBaseSetup';
import { InitConventionsModal } from '../components/InitConventionsModal';
import { ExitConventionsModal } from '../components/ExitConventionsModal';
import { TextEditModal } from '../components/TextEditModal';
import { getConventionsStatus, ConventionsStatus } from '../../conventions';
import { checkExtensionSync } from '../../sync';
import { checkProjectConflicts, ProjectConflict } from '../../sync';
import { GeneralTab, AiAgentsTab, SetupTab } from './settings';
import { ScrollableBox } from '../components/ScrollableBox';
import { Confirm } from '../components/Confirm';

const AGENTS: AgentName[] = ['claude-code', 'cursor', 'copilot', 'codex', 'agents-conventions'];
const SCOPES: Array<'global' | 'project'> = ['global', 'project'];

type Field = 'agent' | 'scope' | 'project' | 'registryUrl' | 'installMcp' | 'installBaseSkill' | 'updateCache' | 'updateAgent'
  | 'initConventions'
  | 'saveAsGlobal' | 'resetToGlobal' | 'createProjectConfig'
  | 'syncExtensions'
  | 'checkProjectConflicts'
  | 'gitignoreAgentDirs'
  | `aiAgent:${AgentName}`
  | 'aiProxy'
  | `aiAgentProxy:${AgentName}`;

const AI_AGENTS: AgentName[] = ['claude-code', 'cursor', 'copilot', 'codex'];
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
  onSyncExtensions?: () => void;
  onCheckProjectConflicts?: () => void;
  resolvedProject: ResolvedProject;
  viewHeight: number;
  inputActive?: boolean;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ config, updateConfig, onEditingChange, configSource, hasProjectRoot, onSaveAsGlobal, onResetToGlobal, onCreateProjectConfig, onSyncExtensions, onCheckProjectConflicts, resolvedProject, viewHeight, inputActive }) => {
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
  const [editModal, setEditModal] = useState<'registryUrl' | 'aiProxy' | 'project' | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [pendingRegistryUrl, setPendingRegistryUrl] = useState<string | null>(null);
  const [pendingResetContext, setPendingResetContext] = useState<'settings' | 'editModal' | null>(null);
  const [pendingExtCount, setPendingExtCount] = useState(0);
  const [localGitignoreAgentDirs, setLocalGitignoreAgentDirs] = useState<boolean>(() => loadGitignoreAgentDirs());

  const cachePath = getCachePath();
  const cacheInstalled = isCloned(cachePath);

  const conventionsStatus: ConventionsStatus | null = localAgent === 'agents-conventions'
    ? getConventionsStatus()
    : null;
  const isConventionsInitialized = conventionsStatus?.hasAgentsDir ?? false;
  const isConventionsHealthy = conventionsStatus?.isHealthy ?? false;

  const setup = useBaseSetup(localAgent);
  const [cacheUpdateState, setCacheUpdateState] = useState<InstallState>('idle');

  /** Сброс кеша + автоматическая загрузка нового каталога */
  const resetAndRedownload = () => {
    fullCatalogReset();
    setCacheUpdateState('loading');
    ensureCache()
      .then(() => {
        setCacheUpdateState('success');
        setStatus('Каталог загружен из нового URL', 'success');
      })
      .catch(() => {
        setCacheUpdateState('error');
        setStatus('Ошибка загрузки каталога', 'error');
      });
  };

  // Динамический список полей: зависит от подвкладки, агента, статуса setup и config source
  const fields = useMemo<Field[]>(() => {
    switch (activeSubTab) {
      case 'general': {
        const f: Field[] = ['agent', 'scope', 'project', 'registryUrl'];
        f.push('updateCache');
        if (configSource === 'project') {
          f.push('gitignoreAgentDirs');
          f.push('saveAsGlobal', 'resetToGlobal', 'syncExtensions');
        } else if (hasProjectRoot) {
          f.push('createProjectConfig');
        }
        if (resolvedProject.project) {
          f.push('checkProjectConflicts');
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
  }, [activeSubTab, localAgent, setup.status, cacheInstalled, configSource, hasProjectRoot, resolvedProject]);

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
    onEditingChange?.(editModal !== null);
  }, [editModal, onEditingChange]);

  // --- Обработка клавиатуры: Tab(подвкладки), ↑↓(поле), ←→(значение), Enter(действие/сохранение) ---
  useInput((input, key) => {
    if (showModal || editModal || showResetConfirm) return;

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
      } else if (activeField === 'gitignoreAgentDirs') {
        setLocalGitignoreAgentDirs(prev => !prev);
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
      if (activeField === 'registryUrl') {
        setEditModal('registryUrl');
        return;
      }
      if (activeField === 'project') {
        setEditModal('project');
        return;
      }
      if (activeField === 'aiProxy') {
        setEditModal('aiProxy');
        return;
      }
      if (activeField === 'createProjectConfig') {
        if (onCreateProjectConfig()) {
          setStatus('Проектный конфиг создан', 'success');
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
      if (activeField === 'syncExtensions') {
        const syncResult = checkExtensionSync(localAgent);
        if (syncResult.missing.length === 0 && syncResult.untracked.length === 0) {
          setStatus('Все расширения синхронизированы', 'success');
        } else if (onSyncExtensions) {
          onSyncExtensions();
        }
        return;
      }
      if (activeField === 'checkProjectConflicts') {
        const conflicts = checkProjectConflicts(localAgent, resolvedProject.project);
        if (conflicts.length === 0) {
          setStatus('Конфликтов проектов не найдено', 'success');
        } else if (onCheckProjectConflicts) {
          onCheckProjectConflicts();
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
      if (urlChanged) {
        const extCount = loadProjectExtensions().length;
        if (extCount > 0) {
          setPendingRegistryUrl(localRegistryUrl);
          setPendingExtCount(extCount);
          setPendingResetContext('settings');
          setShowResetConfirm(true);
          return;
        }
      }
      updateConfig({ agent: localAgent, defaultScope: localScope, registryUrl: localRegistryUrl, aiAgents: localAiAgents });
      // Сохраняем gitignoreAgentDirs отдельно — это поле публичного конфига, не SkillHubConfig
      saveGitignoreAgentDirs(localGitignoreAgentDirs);
      if (urlChanged) {
        resetAndRedownload();
        setStatus('Настройки сохранены. Загрузка каталога...', 'success');
      } else {
        setStatus('Настройки сохранены', 'success');
      }
    }
  }, { isActive: inputActive !== false });

  const isActionField = activeField === 'installMcp'
    || activeField === 'installBaseSkill'
    || activeField === 'updateCache'
    || activeField === 'updateAgent'
    || activeField === 'initConventions'
    || activeField === 'saveAsGlobal'
    || activeField === 'resetToGlobal'
    || activeField === 'createProjectConfig'
    || activeField === 'syncExtensions'
    || activeField === 'checkProjectConflicts';

  if (showResetConfirm && pendingRegistryUrl !== null) {
    return (
      <Box flexDirection="column" padding={2}>
        <Confirm
          message={`Смена каталога очистит список расширений в проектном конфиге (${pendingExtCount} шт.). Файлы на диске останутся. Продолжить?`}
          onConfirm={() => {
            setShowResetConfirm(false);
            if (pendingResetContext === 'settings') {
              updateConfig({ agent: localAgent, defaultScope: localScope, registryUrl: pendingRegistryUrl, aiAgents: localAiAgents });
              resetAndRedownload();
              setStatus('Настройки сохранены. Загрузка каталога...', 'success');
            } else {
              const newHistory = {
                ...config.history,
                registryUrl: pushHistory(config.history?.registryUrl, config.registryUrl),
              };
              updateConfig({ ...config, agent: localAgent, defaultScope: localScope, registryUrl: pendingRegistryUrl, aiAgents: localAiAgents, history: newHistory });
              resetAndRedownload();
              setStatus('Registry URL обновлён. Загрузка каталога...', 'success');
            }
            setPendingRegistryUrl(null);
            setPendingResetContext(null);
          }}
          onCancel={() => {
            setShowResetConfirm(false);
            setLocalRegistryUrl(config.registryUrl);
            setPendingRegistryUrl(null);
            setPendingResetContext(null);
            setStatus('Смена каталога отменена', 'idle');
          }}
        />
      </Box>
    );
  }

  if (showModal) {
    const enabledAgents = (['claude-code', 'cursor', 'copilot', 'codex'] as const)
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
    const enabledAgents = (['claude-code', 'cursor', 'copilot', 'codex'] as const)
      .filter(a => localAiAgents.agents[a]?.enabled);
    return (
      <Box flexDirection="column" padding={2}>
        <ExitConventionsModal
          targetAgent={exitTargetAgent}
          enabledAgents={enabledAgents}
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
        />
      </Box>
    );
  }

  if (editModal) {
    const isProxy = editModal === 'aiProxy';
    const isProject = editModal === 'project';
    const currentValue = isProxy ? localAiAgents.proxy : isProject ? (config.project ?? '') : localRegistryUrl;
    const historyList = isProxy
      ? (config.history?.proxy ?? [])
      : isProject
        ? []
        : (config.history?.registryUrl ?? []);
    return (
      <Box flexDirection="column" padding={2}>
        <TextEditModal
          title={isProxy ? 'Редактирование прокси' : isProject ? 'Редактирование проекта' : 'Редактирование Registry URL'}
          value={currentValue}
          history={historyList}
          onConfirm={(newValue) => {
            if (isProject) {
              const projectValue = newValue.trim() || undefined;
              updateConfig({ ...config, agent: localAgent, defaultScope: localScope, registryUrl: localRegistryUrl, aiAgents: localAiAgents, project: projectValue });
              setStatus(projectValue ? `Проект: ${projectValue}` : 'Проект сброшен', 'success');
            } else if (isProxy) {
              setLocalAiAgents(prev => ({ ...prev, proxy: newValue }));
              const newHistory = {
                ...config.history,
                proxy: pushHistory(config.history?.proxy, currentValue),
              };
              updateConfig({ ...config, agent: localAgent, defaultScope: localScope, registryUrl: localRegistryUrl, aiAgents: { ...localAiAgents, proxy: newValue }, history: newHistory });
              setStatus('Прокси обновлён', 'success');
            } else {
              setLocalRegistryUrl(newValue);
              const urlChanged = newValue !== config.registryUrl;
              const newHistory = {
                ...config.history,
                registryUrl: pushHistory(config.history?.registryUrl, currentValue),
              };
              if (urlChanged) {
                const extCount = loadProjectExtensions().length;
                if (extCount > 0) {
                  setPendingRegistryUrl(newValue);
                  setPendingExtCount(extCount);
                  setPendingResetContext('editModal');
                  setShowResetConfirm(true);
                  setEditModal(null);
                  return;
                }
              }
              updateConfig({ ...config, agent: localAgent, defaultScope: localScope, registryUrl: newValue, aiAgents: localAiAgents, history: newHistory });
              if (urlChanged) {
                resetAndRedownload();
                setStatus('Registry URL обновлён. Загрузка каталога...', 'success');
              } else {
                setStatus('Registry URL сохранён', 'success');
              }
            }
            setEditModal(null);
          }}
          onCancel={() => setEditModal(null)}
        />
      </Box>
    );
  }

  // padding(2+2) + SubTabBar(2) + HintBar(1) = 7 fixed rows
  const scrollHeight = Math.max(3, viewHeight - 7);
  const activeFieldIndex = fields.indexOf(activeField);

  return (
    <Box flexDirection="column" flexGrow={1} padding={2}>
      <SubTabBar tabs={SUBTAB_ITEMS} activeTab={activeSubTab} />
      <ScrollableBox height={scrollHeight} isActive={!showModal && !editModal} activeIndex={activeFieldIndex >= 0 ? activeFieldIndex : undefined}>
        {activeSubTab === 'general' && (
          <>
            <GeneralTab
              localAgent={localAgent}
              localScope={localScope}
              localRegistryUrl={localRegistryUrl}
              resolvedProject={resolvedProject}
              cachePath={cachePath}
              cacheInstalled={cacheInstalled}
              cacheUpdateState={cacheUpdateState}
              activeField={activeField}
              configSource={configSource}
              hasProjectRoot={hasProjectRoot}
              localGitignoreAgentDirs={localGitignoreAgentDirs}
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
      </ScrollableBox>
      <HintBar hints={[
        { key: 'Tab', description: 'подвкладка' },
        { key: '↑↓', description: 'выбор поля' },
        { key: '←→', description: 'изменить значение' },
        { key: 'Enter', description: isActionField ? 'установить' : (activeField === 'registryUrl' || activeField === 'aiProxy' || activeField === 'project') ? 'редактировать' : 'сохранить' },
      ]} />
    </Box>
  );
};
