import React, { useState, useCallback } from 'react';
import { Box, useInput, useApp } from 'ink';
import { Header, TabName } from './components/Header';
import { HintBar, Hint } from './components/HintBar';
import { StatusBar, StatusType } from './components/StatusBar';
import { useNavigation } from './hooks/useNavigation';
import { StatusContext } from './contexts/StatusContext';
import { CatalogScreen } from './screens/CatalogScreen';
import { InstalledScreen } from './screens/InstalledScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { DetailScreen } from './screens/DetailScreen';
import { MoveScreen } from './screens/MoveScreen';
import { Extension, AgentName } from '../catalog';
import { detectAgent } from '../detect-agent';

const TABS: TabName[] = ['catalog', 'installed', 'settings'];

const GLOBAL_HINTS: Hint[] = [
  { key: 'Tab', description: 'следующий таб' },
  { key: '1-3', description: 'перейти к табу' },
  { key: 'q', description: 'выход' },
];

export const App: React.FC = () => {
  const { exit } = useApp();
  const nav = useNavigation();
  const agent = detectAgent() as AgentName;

  const [statusMessage, setStatusMessage] = useState<string | undefined>(undefined);
  const [statusType, setStatusType] = useState<StatusType>('idle');

  const setStatus = useCallback((message: string | undefined, type: StatusType = 'idle') => {
    setStatusMessage(message);
    setStatusType(type);
    if (type === 'success' || type === 'error') {
      setTimeout(() => {
        setStatusMessage(undefined);
        setStatusType('idle');
      }, 3000);
    }
  }, []);

  const clearStatus = useCallback(() => {
    setStatusMessage(undefined);
    setStatusType('idle');
  }, []);

  const [detailExt, setDetailExt] = useState<Extension | null>(null);
  const [moveExt, setMoveExt] = useState<Extension | null>(null);
  const [moveScope, setMoveScope] = useState<'global' | 'project'>('project');

  const handleOpenDetail = useCallback((ext: Extension) => {
    setDetailExt(ext);
    nav.pushScreen('detail');
  }, [nav]);

  const handleOpenMove = useCallback((ext: Extension, scope: 'global' | 'project') => {
    setMoveExt(ext);
    setMoveScope(scope);
    nav.pushScreen('move');
  }, [nav]);

  const handleBack = useCallback(() => {
    nav.popScreen();
    setDetailExt(null);
    setMoveExt(null);
  }, [nav]);

  useInput((input, key) => {
    const screen = nav.currentScreen;
    const isTopLevel = screen === 'catalog' || screen === 'installed' || screen === 'settings';

    if (input === 'q' && isTopLevel) {
      exit();
      return;
    }

    if (key.escape && !isTopLevel) {
      handleBack();
      return;
    }

    if (!isTopLevel) return;

    if (key.tab) {
      const currentIdx = TABS.indexOf(nav.activeTab);
      const nextIdx = key.shift
        ? (currentIdx - 1 + TABS.length) % TABS.length
        : (currentIdx + 1) % TABS.length;
      nav.setTab(TABS[nextIdx]);
      return;
    }

    if (input === '1') { nav.setTab('catalog'); return; }
    if (input === '2') { nav.setTab('installed'); return; }
    if (input === '3') { nav.setTab('settings'); return; }
  });

  const screen = nav.currentScreen;

  const renderScreen = () => {
    if (screen === 'detail' && detailExt) {
      return (
        <DetailScreen
          extension={detailExt}
          agent={agent}
          onBack={handleBack}
        />
      );
    }
    if (screen === 'move' && moveExt) {
      return (
        <MoveScreen
          extension={moveExt}
          currentScope={moveScope}
          agent={agent}
          onBack={handleBack}
        />
      );
    }
    if (nav.activeTab === 'installed') {
      return (
        <InstalledScreen
          agent={agent}
          onMoveExt={handleOpenMove}
        />
      );
    }
    if (nav.activeTab === 'settings') {
      return <SettingsScreen />;
    }
    return (
      <CatalogScreen
        agent={agent}
        onOpenDetail={handleOpenDetail}
      />
    );
  };

  const isTopLevel = screen === 'catalog' || screen === 'installed' || screen === 'settings';
  const hints: Hint[] = isTopLevel
    ? GLOBAL_HINTS
    : [{ key: 'Esc', description: 'назад' }, ...GLOBAL_HINTS.slice(2)];

  return (
    <StatusContext.Provider value={{ message: statusMessage, status: statusType, setStatus, clearStatus }}>
      <Box flexDirection="column" height="100%">
        <Header activeTab={nav.activeTab} />
        <Box flexGrow={1} flexDirection="column">
          {renderScreen()}
        </Box>
        <StatusBar message={statusMessage} status={statusType} />
        <HintBar hints={hints} />
      </Box>
    </StatusContext.Provider>
  );
};
