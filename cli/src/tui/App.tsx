import React, { useState, useCallback } from 'react';
import { Box, useInput, useApp } from 'ink';
import { normalizeInput, isCtrl } from './keymap';
import { Header, TabName } from './components/Header';
import { HintBar, Hint } from './components/HintBar';
import { StatusBar, StatusType } from './components/StatusBar';
import { InfoBar } from './components/InfoBar';
import { Separator } from './components/Separator';
import { useNavigation } from './hooks/useNavigation';
import { useRegistry } from './hooks/useRegistry';
import { useSettings } from './hooks/useSettings';
import { StatusContext } from './contexts/StatusContext';
import { CatalogScreen } from './screens/CatalogScreen';
import { InstalledScreen } from './screens/InstalledScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { DetailScreen } from './screens/DetailScreen';
import { MoveScreen } from './screens/MoveScreen';
import { InstalledDetailScreen } from './screens/InstalledDetailScreen';
import { Extension } from '../catalog';
import { InstalledEntry } from './hooks/useRegistry';

const TABS: TabName[] = ['catalog', 'installed', 'settings'];

const GLOBAL_HINTS: Hint[] = [
  { key: 'Tab', description: 'следующий таб' },
  { key: '1-3', description: 'перейти к табу' },
  { key: 'Ctrl+Q', description: 'выход' },
];

export const App: React.FC = () => {
  const { exit } = useApp();
  const nav = useNavigation();
  const { config, updateConfig } = useSettings();
  const agent = config.agent;
  const registry = useRegistry(agent);

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
  const [installedDetailEntry, setInstalledDetailEntry] = useState<InstalledEntry | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  const handleOpenDetail = useCallback((ext: Extension) => {
    setDetailExt(ext);
    nav.pushScreen('detail');
  }, [nav]);

  const handleOpenInstalledDetail = useCallback((entry: InstalledEntry) => {
    setInstalledDetailEntry(entry);
    nav.pushScreen('installedDetail');
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
    setInstalledDetailEntry(null);
  }, [nav]);

  useInput((input, key) => {
    const screen = nav.currentScreen;
    const isTopLevel = screen === 'catalog' || screen === 'installed' || screen === 'settings';

    if (searchFocused) return;

    if (isCtrl(key) && normalizeInput(input) === 'q') {
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

  const globalCount = registry.installed.filter(e => e.scope === 'global').length;
  const projectCount = registry.installed.filter(e => e.scope === 'project').length;

  const renderScreen = () => {
    if (screen === 'detail' && detailExt) {
      return (
        <DetailScreen
          extension={detailExt}
          agent={agent}
          onBack={handleBack}
          install={registry.install}
          remove={registry.remove}
          isInstalled={registry.isInstalled}
          defaultScope={config.defaultScope}
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
          move={registry.move}
        />
      );
    }
    if (screen === 'installedDetail' && installedDetailEntry) {
      return (
        <InstalledDetailScreen
          entry={installedDetailEntry}
          agent={agent}
          onBack={handleBack}
          remove={registry.remove}
          move={registry.move}
          update={registry.update}
          install={registry.install}
          defaultScope={config.defaultScope}
        />
      );
    }
    if (nav.activeTab === 'installed') {
      return (
        <InstalledScreen
          agent={agent}
          onMoveExt={handleOpenMove}
          onOpenDetail={handleOpenInstalledDetail}
          installed={registry.installed}
          loading={registry.loading}
          error={registry.error}
          remove={registry.remove}
          update={registry.update}
        />
      );
    }
    if (nav.activeTab === 'settings') {
      return (
        <SettingsScreen
          config={config}
          updateConfig={updateConfig}
        />
      );
    }
    return (
      <CatalogScreen
        agent={agent}
        onOpenDetail={handleOpenDetail}
        onSearchFocusChange={setSearchFocused}
        install={registry.install}
        installed={registry.installed}
        defaultScope={config.defaultScope}
      />
    );
  };

  const isTopLevel = screen === 'catalog' || screen === 'installed' || screen === 'settings';
  const hints: Hint[] = isTopLevel
    ? (searchFocused ? GLOBAL_HINTS.filter(h => h.key === 'Tab') : GLOBAL_HINTS)
    : [{ key: 'Esc', description: 'назад' }, { key: 'Ctrl+Q', description: 'выход' }];

  return (
    <StatusContext.Provider value={{ message: statusMessage, status: statusType, setStatus, clearStatus }}>
      <Box flexDirection="column" height="100%">
        <Header activeTab={nav.activeTab} />
        <Box flexGrow={1} flexDirection="column">
          {renderScreen()}
        </Box>
        <Separator />
        <InfoBar
          totalCount={registry.installed.length}
          globalCount={globalCount}
          projectCount={projectCount}
          agent={agent}
          defaultScope={config.defaultScope}
        />
        <Separator />
        <StatusBar message={statusMessage} status={statusType} />
        <HintBar hints={hints} />
      </Box>
    </StatusContext.Provider>
  );
};
