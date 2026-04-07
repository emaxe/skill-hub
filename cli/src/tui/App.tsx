import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { normalizeInput, isCtrl } from './keymap';
import { Header, TabName } from './components/Header';
import { HintBar, Hint } from './components/HintBar';
import { StatusBar, StatusType } from './components/StatusBar';
import { InfoBar } from './components/InfoBar';
import { Separator } from './components/Separator';
import { useNavigation } from './hooks/useNavigation';
import { useRegistry } from './hooks/useRegistry';
import { useSettings } from './hooks/useSettings';
import { useBaseSetup } from './hooks/useBaseSetup';
import { useTerminalSize } from './hooks/useTerminalSize';
import { StatusContext } from './contexts/StatusContext';
import { CatalogScreen } from './screens/CatalogScreen';
import { InstalledScreen } from './screens/InstalledScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { DetailScreen } from './screens/DetailScreen';
import { MoveScreen } from './screens/MoveScreen';
import { InstalledDetailScreen } from './screens/InstalledDetailScreen';
import { ContentScreen } from './screens/ContentScreen';
import { ConventionsWarningDialog } from './components/ConventionsWarningDialog';
import { ProjectConfigDialog } from './components/ProjectConfigDialog';
import { Extension } from '../catalog';
import { InstalledEntry } from './hooks/useRegistry';
import { getConventionsStatus } from '../conventions';

const TABS: TabName[] = ['catalog', 'installed', 'settings'];

const GLOBAL_HINTS: Hint[] = [
  { key: 'Tab', description: 'следующий таб' },
  { key: '1-3', description: 'перейти к табу' },
  { key: 'Ctrl+Q', description: 'выход' },
];

export const App: React.FC = () => {
  const { exit } = useApp();
  const nav = useNavigation();
  const { config, updateConfig, source, hasProjectRoot, doSaveAsGlobal, doResetToGlobal, doCreateProjectConfig } = useSettings();
  const agent = config.agent;
  const registry = useRegistry(agent);
  const setup = useBaseSetup(agent);

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
  const [settingsEditing, setSettingsEditing] = useState(false);
  const [contentData, setContentData] = useState<{ title: string; content: string } | null>(null);
  const [showConventionsWarning, setShowConventionsWarning] = useState(false);
  const [showProjectConfigDialog, setShowProjectConfigDialog] = useState(false);

  useEffect(() => {
    if (config.agent === 'agents-conventions' && !getConventionsStatus().hasAgentsDir) {
      setShowConventionsWarning(true);
    } else if (source === 'global' && hasProjectRoot) {
      setShowProjectConfigDialog(true);
    }
  }, []);

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

  const handleOpenContent = useCallback((title: string, content: string) => {
    setContentData({ title, content });
    nav.pushScreen('contentView');
  }, [nav]);

  const handleGoToSettings = useCallback(() => {
    setShowConventionsWarning(false);
    nav.setTab('settings');
  }, [nav]);

  const handleDismissWarning = useCallback(() => {
    setShowConventionsWarning(false);
  }, []);

  const handleCreateProjectConfig = useCallback(() => {
    doCreateProjectConfig();
    setShowProjectConfigDialog(false);
    setStatus('Проектный конфиг создан (.skill-hub.json)', 'success');
  }, [doCreateProjectConfig, setStatus]);

  const handleDismissProjectConfigDialog = useCallback(() => {
    setShowProjectConfigDialog(false);
  }, []);

  const handleBack = useCallback(() => {
    const leaving = nav.currentScreen;
    nav.popScreen();
    if (leaving === 'contentView') {
      setContentData(null);
    } else {
      setDetailExt(null);
      setMoveExt(null);
      setInstalledDetailEntry(null);
    }
  }, [nav]);

  useInput((input, key) => {
    const screen = nav.currentScreen;
    const isTopLevel = screen === 'catalog' || screen === 'installed' || screen === 'settings';

    if (showConventionsWarning || showProjectConfigDialog) return;
    if (searchFocused || settingsEditing) return;

    if (isCtrl(key) && normalizeInput(input) === 'q') {
      exit();
      return;
    }

    if (key.tab && nav.activeTab !== 'settings') {
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

    if (!isTopLevel) return;

    if (key.escape && !isTopLevel) {
      handleBack();
      return;
    }
  });

  const screen = nav.currentScreen;

  const { rows: termHeight, columns: termWidth } = useTerminalSize();
  const contentAreaHeight = termHeight - 8; // Header(1+border) + Separator(1) + InfoBar(1) + Separator(1) + StatusBar(1) + HintBar(1)

  const globalCount = registry.installed.filter(e => e.effectiveScope === 'global').length;
  const projectCount = registry.installed.filter(e => e.effectiveScope === 'project').length;
  const parentCount = registry.installed.filter(e => e.effectiveScope === 'parent').length;

  const renderScreen = () => {
    if (screen === 'contentView' && contentData) {
      return (
        <ContentScreen
          title={contentData.title}
          content={contentData.content}
          onBack={handleBack}
          viewHeight={contentAreaHeight}
        />
      );
    }
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
          onOpenContent={handleOpenContent}
          viewHeight={contentAreaHeight}
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
          onOpenContent={handleOpenContent}
          viewHeight={contentAreaHeight}
        />
      );
    }
    if (nav.activeTab === 'installed') {
      return (
        <InstalledScreen
          agent={agent}
          onMoveExt={handleOpenMove}
          onOpenDetail={handleOpenInstalledDetail}
          onSearchFocusChange={setSearchFocused}
          installed={registry.installed}
          loading={registry.loading}
          error={registry.error}
          remove={registry.remove}
          update={registry.update}
          updateSelf={setup.doUpdateSelf}
          viewHeight={contentAreaHeight}
        />
      );
    }
    if (nav.activeTab === 'settings') {
      return (
        <SettingsScreen
          config={config}
          updateConfig={updateConfig}
          onEditingChange={setSettingsEditing}
          configSource={source}
          hasProjectRoot={hasProjectRoot}
          onSaveAsGlobal={doSaveAsGlobal}
          onResetToGlobal={doResetToGlobal}
          onCreateProjectConfig={doCreateProjectConfig}
          viewHeight={contentAreaHeight}
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
        viewHeight={contentAreaHeight}
      />
    );
  };

  const isTopLevel = screen === 'catalog' || screen === 'installed' || screen === 'settings';
  const isFullscreen = screen === 'contentView';
  const hints: Hint[] = isTopLevel
    ? (searchFocused
      ? GLOBAL_HINTS.filter(h => h.key === 'Tab')
      : nav.activeTab === 'settings'
        ? GLOBAL_HINTS.filter(h => h.key !== 'Tab')
        : GLOBAL_HINTS)
    : [{ key: 'Esc', description: 'назад' }, { key: 'Ctrl+Q', description: 'выход' }];

  const MIN_COLS = 60;
  const MIN_ROWS = 10;

  if (termWidth < MIN_COLS || termHeight < MIN_ROWS) {
    return (
      <Box flexDirection="column" justifyContent="center" alignItems="center" height={termHeight}>
        <Text color="yellow" bold>⚠ Терминал слишком мал</Text>
        <Text color="gray">Минимум: {MIN_COLS}×{MIN_ROWS} | Текущий: {termWidth}×{termHeight}</Text>
        <Text color="gray" dimColor>Увеличьте окно терминала</Text>
      </Box>
    );
  }

  return (
    <StatusContext.Provider value={{ message: statusMessage, status: statusType, setStatus, clearStatus }}>
      <Box flexDirection="column" height="100%">
        <Header activeTab={nav.activeTab} />
        <Box height={contentAreaHeight} flexDirection="column">
          {renderScreen()}
          {showConventionsWarning && (
            <Box position="absolute" marginTop={2} marginLeft={2}>
              <ConventionsWarningDialog
                onGoToSettings={handleGoToSettings}
                onDismiss={handleDismissWarning}
              />
            </Box>
          )}
          {showProjectConfigDialog && (
            <Box position="absolute" marginTop={2} marginLeft={2}>
              <ProjectConfigDialog
                onCreate={handleCreateProjectConfig}
                onDismiss={handleDismissProjectConfigDialog}
              />
            </Box>
          )}
        </Box>
        {!isFullscreen && (
          <>
            <Separator />
            <InfoBar
              totalCount={registry.installed.length}
              globalCount={globalCount}
              projectCount={projectCount}
              parentCount={parentCount}
              agent={agent}
              defaultScope={config.defaultScope}
            />
            <Separator />
            <StatusBar message={statusMessage} status={statusType} />
            <HintBar hints={hints} />
          </>
        )}
      </Box>
    </StatusContext.Provider>
  );
};
