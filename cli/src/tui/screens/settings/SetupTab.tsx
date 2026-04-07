import React from 'react';
import { Box, Text } from 'ink';
import { AgentName } from '../../../catalog';
import { UseBaseSetupResult } from '../../hooks/useBaseSetup';
import { ConventionsStatus } from '../../../conventions';
import { theme } from '../../theme';

interface Props {
  localAgent: AgentName;
  setup: UseBaseSetupResult;
  conventionsStatus: ConventionsStatus | null;
  isConventionsInitialized: boolean;
  isConventionsHealthy: boolean;
  activeField: string;
}

export const SetupTab: React.FC<Props> = ({
  localAgent,
  setup,
  conventionsStatus,
  isConventionsInitialized,
  isConventionsHealthy,
  activeField,
}) => {
  if (localAgent === 'agents-conventions') {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color={activeField === 'initConventions' ? theme.selected : theme.secondary}>
            {activeField === 'initConventions' ? '▶ ' : '  '}{'Инициализация: '}
          </Text>
          {!isConventionsInitialized
            ? <Text color={theme.error}>✗ не инициализировано  <Text dimColor>[Enter — запустить]</Text></Text>
            : !isConventionsHealthy
              ? <Text color={theme.warning}>⚠ требует внимания  <Text dimColor>[Enter — переинициализировать]</Text></Text>
              : <Text color={theme.success}>✓ готово  <Text dimColor>[Enter — переинициализировать]</Text></Text>
          }
        </Box>
        {conventionsStatus && isConventionsInitialized && (
          <Box flexDirection="column" marginTop={0} marginLeft={4}>
            <Box>
              <Text dimColor>{'  .agents/: '}</Text>
              <Text color={conventionsStatus.hasAgentsDir ? theme.success : theme.error}>
                {conventionsStatus.hasAgentsDir ? '✓' : '✗'}
              </Text>
            </Box>
            <Box>
              <Text dimColor>{'  AGENTS.md: '}</Text>
              <Text color={conventionsStatus.hasAgentsMd ? theme.success : theme.warning}>
                {conventionsStatus.hasAgentsMd ? '✓' : '✗ нет (создаётся ИИ-агентом)'}
              </Text>
            </Box>
            <Box>
              <Text dimColor>{'  симлинки:  '}</Text>
              <Text color={conventionsStatus.symlinks.every(s => s.valid) ? theme.success : theme.error}>
                {conventionsStatus.symlinks.every(s => s.valid)
                  ? `✓ (${conventionsStatus.symlinks.length})`
                  : `✗ (${conventionsStatus.symlinks.filter(s => s.valid).length}/${conventionsStatus.symlinks.length})`}
              </Text>
            </Box>
          </Box>
        )}
      </Box>
    );
  }

  const hasInstalled = setup.status?.mcpInstalled === true || setup.status?.baseSkillInstalled === true;
  const hasUninstalled = setup.status?.mcpInstalled === false || setup.status?.baseSkillInstalled === false;

  if (!setup.checking && !hasInstalled && !hasUninstalled) {
    return (
      <Box>
        <Text color={theme.success}>{'  '}Всё настроено ✓</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
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

      {/* Переустановить */}
      {hasInstalled && (
        <Box marginBottom={1}>
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
  );
};
