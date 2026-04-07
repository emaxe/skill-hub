import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme';

export interface SubTab {
  id: string;
  label: string;
}

interface Props {
  tabs: SubTab[];
  activeTab: string;
}

export const SubTabBar: React.FC<Props> = ({ tabs, activeTab }) => (
  <Box paddingX={2} marginBottom={1}>
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
);
