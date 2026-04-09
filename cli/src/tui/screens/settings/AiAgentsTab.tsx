import React from 'react';
import { Box, Text } from 'ink';
import { AgentName } from '../../../catalog';
import { AiAgentsConfig } from '../../../config';
import { theme } from '../../theme';

const AI_AGENTS: AgentName[] = ['claude-code', 'cursor', 'copilot'];

interface Props {
  localAiAgents: AiAgentsConfig;
  activeField: string;
}

export const AiAgentsTab: React.FC<Props> = ({ localAiAgents, activeField }) => (
  <Box flexDirection="column">
    {AI_AGENTS.map(agentName => {
      const field = `aiAgent:${agentName}`;
      const isActive = activeField === field;
      const agentCfg = localAiAgents.agents[agentName];
      return (
        <Box key={agentName} marginBottom={0}>
          <Text color={isActive ? theme.selected : theme.secondary}>
            {isActive ? '▶ ' : '  '}{agentName.padEnd(22)}
          </Text>
          <Text color={agentCfg.enabled ? theme.success : theme.muted}>
            [{agentCfg.enabled ? '✓ вкл' : '✗ выкл'}]
          </Text>
          {isActive && <Text dimColor> ←→</Text>}
        </Box>
      );
    })}

    <Box marginTop={1} marginBottom={0}>
      <Text color={activeField === 'aiProxy' ? theme.selected : theme.secondary}>
        {activeField === 'aiProxy' ? '▶ ' : '  '}{'Прокси:               '}
      </Text>
      <Text color={theme.warning}>
        {localAiAgents.proxy || ''}
        {!localAiAgents.proxy && activeField !== 'aiProxy' ? <Text dimColor>(не задан)</Text> : ''}
      </Text>
      {activeField === 'aiProxy' && <Text dimColor> [Enter]</Text>}
    </Box>

    {AI_AGENTS.map(agentName => {
      const field = `aiAgentProxy:${agentName}`;
      const isActive = activeField === field;
      const agentCfg = localAiAgents.agents[agentName];
      const proxySet = !!localAiAgents.proxy;
      return (
        <Box key={`proxy-${agentName}`} marginBottom={0}>
          <Text color={isActive ? theme.selected : (proxySet ? theme.secondary : theme.muted)}>
            {isActive ? '▶ ' : '  '}{agentName.padEnd(22)}
          </Text>
          <Text color={proxySet ? (agentCfg.useProxy ? theme.success : theme.muted) : theme.muted} dimColor={!proxySet}>
            [{agentCfg.useProxy ? '✓ с прокси' : '✗ без прокси'}]
          </Text>
          {isActive && proxySet && <Text dimColor> ←→</Text>}
        </Box>
      );
    })}
  </Box>
);
