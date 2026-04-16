/**
 * Корневой компонент TUI — оркестрирует навигацию, хуки, экраны и модальные диалоги.
 *
 * Структура:
 * - Header (вкладки) + основная область (экраны) + InfoBar + StatusBar + HintBar
 * - При старте последовательно выполняет 4 проверки: conventions health → project config → extension sync → conflicts
 * - Глобальные хоткеи: Tab — смена вкладки, 1-3 — переход, Ctrl+Q — выход
 */
import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import path from 'path';
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
import { UploadScreen } from './screens/UploadScreen';
import { useUploadAccess } from './hooks/useUploadAccess';
import { ConventionsWarningDialog, ConventionsIssue } from './components/ConventionsWarningDialog';
import { ProjectConfigDialog } from './components/ProjectConfigDialog';
import { ExtensionSyncDialog } from './components/ExtensionSyncDialog';
import { ProjectConflictDialog } from './components/ProjectConflictDialog';
import { GitCredentialsDialog, GitCredentials } from './components/GitCredentialsDialog';
import { Extension, loadCatalog } from '../catalog';
import { InstalledEntry } from './hooks/useRegistry';
import { getConventionsStatus } from '../conventions';
import { ProjectExtensionRecord, addProjectExtension, resolveProject, ResolvedProject } from '../config';
import { checkExtensionSync, UntrackedExtension, checkProjectConflicts, ProjectConflict } from '../sync';
import { getCachePath, ensureCache, ensureCacheWithCredentials, GitAuthError } from '../git';
import { ScanResult } from '../adapters/types';

const TABS: TabName[] = ['catalog', 'installed', 'settings'];

const GLOBAL_HINTS: Hint[] = [
  { key: 'Tab', description: 'следующий таб' },
  { key: '1-3', description: 'перейти к табу' },
  { key: 'Ctrl+Q', description: 'выход' },
];

export const App: React.FC = () => {
  // --- Инициализация хуков ---
  const { exit } = useApp();
  const nav = useNavigation();
  const { config, updateConfig, source, hasProjectRoot, doSaveAsGlobal, doResetToGlobal, doCreateProjectConfig } = useSettings();
  const agent = config.agent;
  const registry = useRegistry(agent);
  const setup = useBaseSetup(agent);
  const uploadAccess = useUploadAccess();

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

  // --- Состояние экранов и диалогов ---
  const [detailExt, setDetailExt] = useState<Extension | null>(null);
  const [moveExt, setMoveExt] = useState<Extension | null>(null);
  const [moveScope, setMoveScope] = useState<'global' | 'project'>('project');
  const [installedDetailEntry, setInstalledDetailEntry] = useState<InstalledEntry | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [settingsEditing, setSettingsEditing] = useState(false);
  const [contentData, setContentData] = useState<{ title: string; content: string } | null>(null);
  const [uploadPreselected, setUploadPreselected] = useState<ScanResult[] | undefined>(undefined);
  const [showConventionsWarning, setShowConventionsWarning] = useState(false);
  const [conventionsIssues, setConventionsIssues] = useState<ConventionsIssue[]>([]);
  const [showProjectConfigDialog, setShowProjectConfigDialog] = useState(false);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [missingExtensions, setMissingExtensions] = useState<ProjectExtensionRecord[]>([]);
  const [untrackedExtensions, setUntrackedExtensions] = useState<UntrackedExtension[]>([]);
  const [showProjectConflictDialog, setShowProjectConflictDialog] = useState(false);
  const [projectConflicts, setProjectConflicts] = useState<ProjectConflict[]>([]);
  const [resolvedProject, setResolvedProject] = useState<ResolvedProject>(() => resolveProject());

  // Состояние диалога ввода учётных данных git
  const [showGitCredentials, setShowGitCredentials] = useState(false);
  const [gitCredentialsUrl, setGitCredentialsUrl] = useState('');
  /** Callback, который нужно повторить после успешного ввода credentials */
  const [gitCredentialsPending, setGitCredentialsPending] = useState<((creds: GitCredentials) => Promise<void>) | null>(null);

  // Фазы стартовых проверок — выполняются последовательно, каждая ждёт закрытия диалога
  type StartupPhase = 'conventions' | 'projectConfig' | 'sync' | 'conflicts' | 'done';
  const [startupPhase, setStartupPhase] = useState<StartupPhase>('conventions');

  // Флаг: активен ли какой-либо диалог — блокирует ввод на фоновых экранах
  const dialogActive = showConventionsWarning || showProjectConfigDialog || showSyncDialog || showProjectConflictDialog || showGitCredentials;

  useEffect(() => {
    if (startupPhase === 'done') return;

    // Проверка 1: agents-conventions — полная валидация
    if (startupPhase === 'conventions') {
      if (config.agent === 'agents-conventions') {
        const status = getConventionsStatus();
        if (!status.isHealthy) {
          const issues: ConventionsIssue[] = [];
          if (!status.hasAgentsDir) {
            issues.push({ label: 'Директория .agents/ не найдена' });
          }
          if (!status.hasAgentsMd) {
            issues.push({ label: 'Файл AGENTS.md не найден' });
          }
          const brokenSymlinks = status.symlinks.filter(s => !s.valid);
          for (const s of brokenSymlinks) {
            const name = s.path.split(path.sep).slice(-2).join('/');
            issues.push({ label: `Битый симлинк: ${name}` });
          }
          if (issues.length > 0) {
            setConventionsIssues(issues);
            setShowConventionsWarning(true);
            return;
          }
        }
      }
      setStartupPhase('projectConfig');
      return;
    }

    // Проверка 2: проектный конфиг
    if (startupPhase === 'projectConfig') {
      if (source === 'global' && hasProjectRoot) {
        setShowProjectConfigDialog(true);
        return;
      }
      setStartupPhase('sync');
      return;
    }

    // Проверка 3: синхронизация расширений (missing + untracked)
    if (startupPhase === 'sync') {
      if (source === 'project') {
        const syncResult = checkExtensionSync(config.agent);
        if (syncResult.missing.length > 0 || syncResult.untracked.length > 0) {
          setMissingExtensions(syncResult.missing);
          setUntrackedExtensions(syncResult.untracked);
          setShowSyncDialog(true);
          return;
        }
      }
      setStartupPhase('conflicts');
      return;
    }

    // Проверка 4: конфликты проектов
    if (startupPhase === 'conflicts') {
      const rp = resolveProject();
      setResolvedProject(rp);
      if (rp.project) {
        const conflicts = checkProjectConflicts(config.agent, rp.project);
        if (conflicts.length > 0) {
          setProjectConflicts(conflicts);
          setShowProjectConflictDialog(true);
        }
      }
      setStartupPhase('done');
    }
  }, [startupPhase, source, config.agent, hasProjectRoot]);

  // --- Навигация между экранами ---
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

  const handleOpenUpload = useCallback((preselected?: ScanResult[]) => {
    setUploadPreselected(preselected);
    nav.pushScreen('upload');
  }, [nav]);

  const handleGoToSettings = useCallback(() => {
    setShowConventionsWarning(false);
    setStartupPhase(prev => prev === 'conventions' ? 'projectConfig' : prev);
    nav.setTab('settings');
  }, [nav]);

  const handleDismissWarning = useCallback(() => {
    setShowConventionsWarning(false);
    setStartupPhase(prev => prev === 'conventions' ? 'projectConfig' : prev);
  }, []);

  const handleCreateProjectConfig = useCallback(() => {
    doCreateProjectConfig();
    setShowProjectConfigDialog(false);
    setResolvedProject(resolveProject());
    setStatus('Проектный конфиг создан (.skill-hub.json)', 'success');
    setStartupPhase(prev => prev === 'projectConfig' ? 'sync' : prev);
  }, [doCreateProjectConfig, setStatus]);

  const handleDismissProjectConfigDialog = useCallback(() => {
    setShowProjectConfigDialog(false);
    setStartupPhase(prev => prev === 'projectConfig' ? 'sync' : prev);
  }, []);

  const handleSync = useCallback(async () => {
    setShowSyncDialog(false);
    try {
      let installedCount = 0;
      let trackedCount = 0;

      // Установка missing-расширений
      if (missingExtensions.length > 0) {
        await ensureCache();
        const cachePath = getCachePath();
        const catalog = loadCatalog(cachePath);
        for (const ext of missingExtensions) {
          const fullExt = catalog.extensions.find(e => e.name === ext.name && e.type === ext.type);
          if (fullExt) {
            await registry.install(fullExt, agent, ext.scope);
            installedCount++;
          }
        }
      }

      // Добавление untracked-расширений в .skill-hub.json (только из каталога, с актуальной версией)
      for (const ext of untrackedExtensions) {
        if (!ext.inCatalog) continue;
        addProjectExtension({
          type: ext.type,
          name: ext.name,
          version: ext.catalogVersion,
          scope: ext.scope === 'parent' ? 'project' : ext.scope,
        });
        trackedCount++;
      }

      const parts: string[] = [];
      if (installedCount > 0) parts.push(`установлено: ${installedCount}`);
      if (trackedCount > 0) parts.push(`добавлено в конфиг: ${trackedCount}`);
      if (parts.length > 0) {
        setStatus(`Синхронизация: ${parts.join(', ')}`, 'success');
      } else {
        setStatus('Расширения не найдены в каталоге', 'error');
      }
      setStartupPhase(prev => prev === 'sync' ? 'conflicts' : prev);
    } catch (err) {
      if (err instanceof GitAuthError) {
        // Показываем диалог учётных данных, сохраняем pending-операцию для повтора
        setGitCredentialsUrl(err.url);
        setGitCredentialsPending(() => async (creds: GitCredentials) => {
          await ensureCacheWithCredentials(creds.username, creds.password);
          // После успешного ensureCache повторяем установку расширений
          const cachePath = getCachePath();
          const catalog = loadCatalog(cachePath);
          let installedCount = 0;
          for (const ext of missingExtensions) {
            const fullExt = catalog.extensions.find(e => e.name === ext.name && e.type === ext.type);
            if (fullExt) {
              await registry.install(fullExt, agent, ext.scope);
              installedCount++;
            }
          }
          if (installedCount > 0) {
            setStatus(`Синхронизация: установлено ${installedCount}`, 'success');
          }
          setStartupPhase(prev => prev === 'sync' ? 'conflicts' : prev);
        });
        setShowGitCredentials(true);
        return;
      }
      setStatus(`Ошибка синхронизации: ${String(err)}`, 'error');
      setStartupPhase(prev => prev === 'sync' ? 'conflicts' : prev);
    }
  }, [missingExtensions, untrackedExtensions, agent, registry, setStatus]);

  const handleDismissSync = useCallback(() => {
    setShowSyncDialog(false);
    setStartupPhase(prev => prev === 'sync' ? 'conflicts' : prev);
  }, []);

  const handleGitCredentialsConfirm = useCallback(async (creds: GitCredentials) => {
    setShowGitCredentials(false);
    const pending = gitCredentialsPending;
    setGitCredentialsPending(null);
    if (!pending) return;
    try {
      await pending(creds);
    } catch (err) {
      setStatus(`Ошибка аутентификации: ${String(err)}`, 'error');
    }
  }, [gitCredentialsPending, setStatus]);

  const handleGitCredentialsCancel = useCallback(() => {
    setShowGitCredentials(false);
    setGitCredentialsPending(null);
    setStartupPhase(prev => prev === 'sync' ? 'conflicts' : prev);
  }, []);

  const handleRemoveProjectConflicts = useCallback(async () => {
    setShowProjectConflictDialog(false);
    try {
      let removedCount = 0;
      for (const conflict of projectConflicts) {
        await registry.remove(
          { type: conflict.type, name: conflict.name } as Extension,
          agent,
          conflict.scope === 'parent' ? 'project' : conflict.scope,
          true
        );
        removedCount++;
      }
      setStatus(`Удалено конфликтующих расширений: ${removedCount}`, 'success');
    } catch (err) {
      setStatus(`Ошибка удаления: ${String(err)}`, 'error');
    }
  }, [projectConflicts, agent, registry, setStatus]);

  const handleDismissProjectConflicts = useCallback(() => {
    setShowProjectConflictDialog(false);
  }, []);

  const handleCheckProjectConflictsFromSettings = useCallback(() => {
    const rp = resolveProject();
    setResolvedProject(rp);
    if (rp.project) {
      const conflicts = checkProjectConflicts(agent, rp.project);
      if (conflicts.length > 0) {
        setProjectConflicts(conflicts);
        setShowProjectConflictDialog(true);
      }
    }
  }, [agent]);

  const handleSyncFromSettings = useCallback(() => {
    const syncResult = checkExtensionSync(agent);
    if (syncResult.missing.length > 0 || syncResult.untracked.length > 0) {
      setMissingExtensions(syncResult.missing);
      setUntrackedExtensions(syncResult.untracked);
      setShowSyncDialog(true);
    }
  }, [agent]);

  const handleBack = useCallback(() => {
    const leaving = nav.currentScreen;
    nav.popScreen();
    if (leaving === 'contentView') {
      setContentData(null);
    } else if (leaving === 'upload') {
      setUploadPreselected(undefined);
    } else {
      setDetailExt(null);
      setMoveExt(null);
      setInstalledDetailEntry(null);
    }
  }, [nav]);

  // --- Глобальная обработка клавиатуры ---
  useInput((input, key) => {
    const screen = nav.currentScreen;
    const isTopLevel = screen === 'catalog' || screen === 'installed' || screen === 'settings';

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
  }, { isActive: !dialogActive });
  const screen = nav.currentScreen;

  const { rows: termHeight, columns: termWidth } = useTerminalSize();
  const contentAreaHeight = termHeight - 8; // Header(1+border) + Separator(1) + InfoBar(1) + Separator(1) + StatusBar(1) + HintBar(1)

  const globalCount = registry.installed.filter(e => e.effectiveScope === 'global').length;
  const projectCount = registry.installed.filter(e => e.effectiveScope === 'project').length;
  const parentCount = registry.installed.filter(e => e.effectiveScope === 'parent').length;

  // --- Рендеринг экранов (стек: detail/move/content поверх вкладок) ---
  const renderScreen = () => {
    if (screen === 'contentView' && contentData) {
      return (
        <ContentScreen
          title={contentData.title}
          content={contentData.content}
          onBack={handleBack}
          viewHeight={contentAreaHeight}
          inputActive={!dialogActive}
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
          inputActive={!dialogActive}
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
          inputActive={!dialogActive}
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
          inputActive={!dialogActive}
          hasUploadAccess={uploadAccess.hasAccess}
          onOpenUpload={handleOpenUpload}
        />
      );
    }
    if (screen === 'upload') {
      return (
        <UploadScreen
          agent={agent}
          onBack={handleBack}
          preselected={uploadPreselected}
          onOpenContent={handleOpenContent}
          viewHeight={contentAreaHeight}
          inputActive={!dialogActive}
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
          project={resolvedProject.project}
          inputActive={!dialogActive}
          hasUploadAccess={uploadAccess.hasAccess}
          onOpenUpload={handleOpenUpload}
        />
      );
    }
    if (nav.activeTab === 'settings') {
      return (
        <SettingsScreen
          config={config}
          updateConfig={(updates) => {
            updateConfig(updates);
            // Обновляем resolvedProject после изменения project в конфиге
            if ('project' in updates) {
              setResolvedProject(resolveProject());
            }
          }}
          onEditingChange={setSettingsEditing}
          configSource={source}
          hasProjectRoot={hasProjectRoot}
          onSaveAsGlobal={doSaveAsGlobal}
          onResetToGlobal={doResetToGlobal}
          onCreateProjectConfig={doCreateProjectConfig}
          onSyncExtensions={handleSyncFromSettings}
          onCheckProjectConflicts={handleCheckProjectConflictsFromSettings}
          resolvedProject={resolvedProject}
          viewHeight={contentAreaHeight}
          inputActive={!dialogActive}
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
        project={resolvedProject.project}
        viewHeight={contentAreaHeight}
        inputActive={!dialogActive}
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
                issues={conventionsIssues}
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
          {showSyncDialog && (
            <Box position="absolute" marginTop={2} marginLeft={2}>
              <ExtensionSyncDialog
                missing={missingExtensions}
                untracked={untrackedExtensions}
                onSync={handleSync}
                onDismiss={handleDismissSync}
                hasUploadAccess={uploadAccess.hasAccess}
                loadingUploadAccess={uploadAccess.loading}
                onOpenUpload={handleOpenUpload}
              />
            </Box>
          )}
          {showProjectConflictDialog && resolvedProject.project && (
            <Box position="absolute" marginTop={2} marginLeft={2}>
              <ProjectConflictDialog
                conflicts={projectConflicts}
                currentProject={resolvedProject.project}
                onRemove={handleRemoveProjectConflicts}
                onDismiss={handleDismissProjectConflicts}
              />
            </Box>
          )}
          {showGitCredentials && (
            <Box position="absolute" marginTop={2} marginLeft={2}>
              <GitCredentialsDialog
                url={gitCredentialsUrl}
                onConfirm={handleGitCredentialsConfirm}
                onCancel={handleGitCredentialsCancel}
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
