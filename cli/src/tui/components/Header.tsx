import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme';

export type TabName = 'catalog' | 'installed' | 'settings';

interface Props {
  activeTab: TabName;
}

export const Header: React.FC<Props> = ({ activeTab }) => {
  const tabs: { id: TabName; label: string; key: string }[] = [
    { id: 'catalog', label: 'Каталог', key: '1' },
    { id: 'installed', label: 'Установленные', key: '2' },
    { id: 'settings', label: 'Настройки', key: '3' },
  ];

  return (
    <Box borderStyle="double" borderColor={theme.border} paddingX={1}>
      <Text bold color={theme.primary}>skill-hub</Text>
      <Text color={theme.muted}>  │  </Text>
      {tabs.map((tab, i) => (
        <React.Fragment key={tab.id}>
          {i > 0 && <Text color={theme.muted}>  │  </Text>}
          <Text
            color={activeTab === tab.id ? theme.selected : theme.muted}
            bold={activeTab === tab.id}
          >
            [{tab.key}] {tab.label}
          </Text>
        </React.Fragment>
      ))}
    </Box>
  );
};
