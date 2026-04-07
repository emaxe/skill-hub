import React from 'react';
import { Box, Text, useStdout } from 'ink';
import { theme } from '../theme';

export interface SubTab {
  id: string;
  label: string;
}

interface Props {
  tabs: SubTab[];
  activeTab: string;
}

export const SubTabBar: React.FC<Props> = ({ tabs, activeTab }) => {
  const { stdout } = useStdout();
  const width = Math.max(10, (stdout?.columns ?? 80) - 4); // account for padding
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box paddingX={2}>
        {tabs.map((tab, i) => (
          <React.Fragment key={tab.id}>
            {i > 0 && <Text color={theme.muted}>  │  </Text>}
            <Text
              color={activeTab === tab.id ? theme.selected : theme.muted}
              bold={activeTab === tab.id}
            >
              [{tab.label}]
            </Text>
          </React.Fragment>
        ))}
      </Box>
      <Box paddingX={1}>
        <Text color={theme.border}>{'─'.repeat(width)}</Text>
      </Box>
    </Box>
  );
};
