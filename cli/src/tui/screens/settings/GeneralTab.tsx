import React from 'react';
import { Box, Text } from 'ink';
import { AgentName } from '../../../catalog';
import { ConfigSource, ResolvedProject } from '../../../config';
import { InstallState } from '../../hooks/useBaseSetup';
import { theme } from '../../theme';

type Field = 'agent' | 'scope' | 'project' | 'registryUrl' | 'updateCache' | 'saveAsGlobal' | 'resetToGlobal' | 'createProjectConfig' | 'syncExtensions' | 'checkProjectConflicts' | 'gitignoreAgentDirs';

interface Props {
  localAgent: AgentName;
  localScope: 'global' | 'project';
  localRegistryUrl: string;
  resolvedProject: ResolvedProject;
  cachePath: string;
  cacheInstalled: boolean;
  cacheUpdateState: InstallState;
  activeField: string;
  configSource: ConfigSource;
  hasProjectRoot: boolean;
  localGitignoreAgentDirs: boolean;
}

export const GeneralTab: React.FC<Props> = ({
  localAgent,
  localScope,
  localRegistryUrl,
  resolvedProject,
  cachePath,
  cacheInstalled,
  cacheUpdateState,
  activeField,
  configSource,
  hasProjectRoot,
  localGitignoreAgentDirs,
}) => (
  <Box flexDirection="column">
    {/* Рабочая папка */}
    <Box marginBottom={1}>
      <Text dimColor>{'  '}{'Рабочая папка: '}</Text>
      <Text color={theme.muted}>{process.cwd()}</Text>
    </Box>

    {/* Источник настроек */}
    <Box marginBottom={1}>
      <Text dimColor>{'  '}{'Источник:     '}</Text>
      <Text color={configSource === 'project' ? theme.success : theme.warning}>
        {configSource === 'project' ? '📁 проектные (.skill-hub.json + .local)' : '🌐 глобальные (~/.skill-hub/config.json)'}
      </Text>
    </Box>

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

    {/* Проект */}
    <Box marginBottom={1}>
      <Text color={activeField === 'project' ? theme.selected : theme.secondary}>
        {activeField === 'project' ? '▶ ' : '  '}{'Проект:       '}
      </Text>
      {resolvedProject.project ? (
        <>
          <Text color={theme.warning}>[{resolvedProject.project}]</Text>
          {resolvedProject.source === 'parent' && (
            <Text dimColor> (из родительской папки: {resolvedProject.parentPath})</Text>
          )}
        </>
      ) : (
        <Text dimColor>[не задан]</Text>
      )}
      {activeField === 'project' && <Text dimColor> [Enter]</Text>}
    </Box>

    {/* Registry URL */}
    <Box marginBottom={1}>
      <Text color={activeField === 'registryUrl' ? theme.selected : theme.secondary}>
        {activeField === 'registryUrl' ? '▶ ' : '  '}{'Registry URL: '}
      </Text>
      <Text color={theme.warning}>
        {localRegistryUrl}
      </Text>
      {activeField === 'registryUrl' && <Text dimColor> [Enter]</Text>}
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

    {/* Сохранить как глобальные (только для проектных настроек) */}
    {configSource === 'project' && (
      <Box marginBottom={1}>
        <Text color={activeField === 'gitignoreAgentDirs' ? theme.selected : theme.secondary}>
          {activeField === 'gitignoreAgentDirs' ? '▶ ' : '  '}{'Папки ИИ-агентов в .gitignore: '}
        </Text>
        <Text color={theme.warning}>[{localGitignoreAgentDirs ? 'да' : 'нет'}]</Text>
        <Text dimColor> ←→</Text>
      </Box>
    )}

    {/* Сохранить как глобальные (только для проектных настроек) */}
    {configSource === 'project' && (
      <Box marginBottom={1}>
        <Text color={activeField === 'saveAsGlobal' ? theme.selected : theme.secondary}>
          {activeField === 'saveAsGlobal' ? '▶ ' : '  '}{'Сохранить как глобальные '}
        </Text>
        <Text dimColor>[Enter]</Text>
      </Box>
    )}

    {/* Сбросить на глобальные (только для проектных настроек) */}
    {configSource === 'project' && (
      <Box marginBottom={1}>
        <Text color={activeField === 'resetToGlobal' ? theme.selected : theme.secondary}>
          {activeField === 'resetToGlobal' ? '▶ ' : '  '}{'Сбросить на глобальные '}
        </Text>
        <Text dimColor>[Enter]</Text>
      </Box>
    )}

    {/* Синхронизировать расширения (только для проектных настроек) */}
    {configSource === 'project' && (
      <Box marginBottom={1}>
        <Text color={activeField === 'syncExtensions' ? theme.selected : theme.secondary}>
          {activeField === 'syncExtensions' ? '▶ ' : '  '}{'Синхронизировать расширения '}
        </Text>
        <Text dimColor>[Enter]</Text>
      </Box>
    )}

    {/* Проверить конфликты проектов */}
    {resolvedProject.project && (
      <Box marginBottom={1}>
        <Text color={activeField === 'checkProjectConflicts' ? theme.selected : theme.secondary}>
          {activeField === 'checkProjectConflicts' ? '▶ ' : '  '}{'Проверить конфликты проектов '}
        </Text>
        <Text dimColor>[Enter]</Text>
      </Box>
    )}

    {/* Создать проектный конфиг (только для глобальных настроек в git-проекте) */}
    {configSource === 'global' && hasProjectRoot && (
      <Box marginBottom={1}>
        <Text color={activeField === 'createProjectConfig' ? theme.selected : theme.secondary}>
          {activeField === 'createProjectConfig' ? '▶ ' : '  '}{'Создать проектный конфиг '}
        </Text>
        <Text dimColor>[Enter]</Text>
      </Box>
    )}
  </Box>
);
