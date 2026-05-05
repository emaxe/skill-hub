/**
 * Корневой компонент TUI — оркестрирует навигацию, хуки, экраны и модальные диалоги.
 *
 * Структура:
 * - Header (вкладки) + основная область (экраны) + InfoBar + StatusBar + HintBar
 * - При старте последовательно выполняет 8 проверок:
 *   updateCatalog → conventions health → project config → extension sync → conflicts
 *   → extension updates → self update → agent dirs gitignore
 * - Глобальные хоткеи: Tab — смена вкладки, 1-3 — переход, Ctrl+Q — выход
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { useLayout } from './hooks/useLayout';
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
import { Extension, loadCatalog, AgentName } from '../catalog';
import { InstalledEntry } from './hooks/useRegistry';
import { getConventionsStatus, ensureConventionsStructure } from '../conventions';
import { ProjectExtensionRecord, addProjectExtension, resolveProject, ResolvedProject, loadGitignoreAgentDirs, findProjectRoot } from '../config';
import { checkExtensionSync, UntrackedExtension, MissingExtension, checkProjectConflicts, ProjectConflict } from '../sync';
import { getCachePath, ensureCache, ensureCacheWithCredentials, updateCache, GitAuthError } from '../git';
import { ScanResult } from '../adapters/types';
import { getMissingGitignoreEntries, addAgentDirsToGitignore } from '../gitignore-agents';
import { AgentDirsGitignoreDialog } from './components/AgentDirsGitignoreDialog';
import { CatalogUpdateDialog, CatalogUpdateStatus } from './components/CatalogUpdateDialog';
import { ExtensionUpdatesDialog, ExtensionUpdateEntry } from './components/ExtensionUpdatesDialog';
import { SelfUpdateDialog } from './components/SelfUpdateDialog';
import { checkSetupStatus, updateSelf } from '../base-setup';

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
  const [missingExtensions, setMissingExtensions] = useState<MissingExtension[]>([]);
  const [untrackedExtensions, setUntrackedExtensions] = useState<UntrackedExtension[]>([]);
  const [showProjectConflictDialog, setShowProjectConflictDialog] = useState(false);
  const [projectConflicts, setProjectConflicts] = useState<ProjectConflict[]>([]);
  const [resolvedProject, setResolvedProject] = useState<ResolvedProject>(() => resolveProject());

  // Состояние диалога gitignore ИИ-агентов
  const [showGitignoreAgentDirsDialog, setShowGitignoreAgentDirsDialog] = useState(false);
  const [missingGitignoreEntries, setMissingGitignoreEntries] = useState<string[]>([]);

  // Состояние диалога обновления каталога
  const [showCatalogUpdateDialog, setShowCatalogUpdateDialog] = useState(false);
  const [catalogUpdateStatus, setCatalogUpdateStatus] = useState<CatalogUpdateStatus>('loading');
  const [catalogUpdateError, setCatalogUpdateError] = useState<string | undefined>(undefined);
  const catalogUpdateStarted = useRef(false);

  // Состояние диалога обновления расширений
  const [showExtensionUpdatesDialog, setShowExtensionUpdatesDialog] = useState(false);
  const [extensionUpdates, setExtensionUpdates] = useState<ExtensionUpdateEntry[]>([]);

  // Состояние диалога обновления base-skill/MCP
  const [showSelfUpdateDialog, setShowSelfUpdateDialog] = useState(false);
  const [selfUpdateHasSkill, setSelfUpdateHasSkill] = useState(false);
  const [selfUpdateHasMcp, setSelfUpdateHasMcp] = useState(false);

  // Состояние диалога ввода учётных данных git
  const [showGitCredentials, setShowGitCredentials] = useState(false);
  const [gitCredentialsUrl, setGitCredentialsUrl] = useState('');
  /** Callback, который нужно повторить после успешного ввода credentials */
  const [gitCredentialsPending, setGitCredentialsPending] = useState<((creds: GitCredentials) => Promise<void>) | null>(null);

  // Фазы стартовых проверок — выполняются последовательно, каждая ждёт закрытия диалога
  type StartupPhase = 'updateCatalog' | 'conventions' | 'projectConfig' | 'sync' | 'conflicts' | 'updateExtensions' | 'selfUpdate' | 'gitignoreAgentDirs' | 'done';
  const [startupPhase, setStartupPhase] = useState<StartupPhase>('updateCatalog');

  // Флаг: активен ли какой-либо диалог — блокирует ввод на фоновых экранах
  const dialogActive = showConventionsWarning || showProjectConfigDialog || showSyncDialog || showProjectConflictDialog || showGitignoreAgentDirsDialog || showGitCredentials || showCatalogUpdateDialog || showExtensionUpdatesDialog || showSelfUpdateDialog;

  useEffect(() => {
    if (startupPhase === 'done') return;

    // Проверка 0: обновление каталога (git pull)
    if (startupPhase === 'updateCatalog') {
      if (catalogUpdateStarted.current) return;
      catalogUpdateStarted.current = true;
      setCatalogUpdateStatus('loading');
      setShowCatalogUpdateDialog(true);
      updateCache()
        .then(() => {
          setCatalogUpdateStatus('success');
          setShowCatalogUpdateDialog(false);
          setStartupPhase('conventions');
        })
        .catch((err: unknown) => {
          setCatalogUpdateStatus('error');
          setCatalogUpdateError(String(err));
        });
      return;
    }

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
          return;
        }
      }
      setStartupPhase('updateExtensions');
      return;
    }

    // Проверка 5: обновления установленных расширений
    if (startupPhase === 'updateExtensions') {
      if (registry.installed.length > 0) {
        const cachePath = getCachePath();
        try {
          const catalog = loadCatalog(cachePath);
          const outdated: ExtensionUpdateEntry[] = [];
          for (const entry of registry.installed) {
            if (entry.effectiveScope === 'parent') continue;
            const catExt = catalog.extensions.find(e => e.name === entry.name && e.type === entry.type);
            // Не предлагаем обновления если текущая версия неизвестна (manual/scan-only)
            if (catExt && catExt.version && entry.version && entry.version !== '?' && catExt.version !== entry.version) {
              outdated.push({
                type: entry.type,
                name: entry.name,
                currentVersion: entry.version,
                newVersion: catExt.version,
                scope: entry.effectiveScope as 'global' | 'project',
                sourceAgent: entry.sourceAgent,
              });
            }
          }
          if (outdated.length > 0) {
            setExtensionUpdates(outdated);
            setShowExtensionUpdatesDialog(true);
            return;
          }
        } catch {
          // Каталог недоступен — пропускаем проверку обновлений
        }
      }
      setStartupPhase('selfUpdate');
      return;
    }

    // Проверка 6: обновление базового скилла и MCP
    if (startupPhase === 'selfUpdate') {
      let ignore = false;
      checkSetupStatus(config.agent).then(status => {
        if (ignore) return;
        if (status.mcpOutdated || status.baseSkillOutdated) {
          setSelfUpdateHasMcp(status.mcpOutdated);
          setSelfUpdateHasSkill(status.baseSkillOutdated);
          setShowSelfUpdateDialog(true);
        } else {
          setStartupPhase('gitignoreAgentDirs');
        }
      });
      return () => { ignore = true; };
    }

    // Проверка 7: папки ИИ-агентов в .gitignore
    if (startupPhase === 'gitignoreAgentDirs') {
      if (source === 'project') {
        const projectRoot = findProjectRoot();
        if (projectRoot && loadGitignoreAgentDirs(projectRoot)) {
          const missing = getMissingGitignoreEntries(projectRoot);
          if (missing.length > 0) {
            setMissingGitignoreEntries(missing);
            setShowGitignoreAgentDirsDialog(true);
            return;
          }
        }
      }
      setStartupPhase('done');
    }
  }, [startupPhase, source, config.agent, hasProjectRoot, registry.installed]);

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
    setStatus('Проектный конфиг создан', 'success');
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

      // Установка missing-расширений (только те, что есть в каталоге)
      let skippedCount = 0;
      if (missingExtensions.length > 0) {
        const installable = missingExtensions.filter(e => e.inCatalog);
        skippedCount = missingExtensions.length - installable.length;
        if (installable.length > 0) {
          await ensureCache();
          const cachePath = getCachePath();
          const catalog = loadCatalog(cachePath);
          for (const ext of installable) {
            const fullExt = catalog.extensions.find(e => e.name === ext.name && e.type === ext.type);
            if (fullExt) {
              await registry.install(fullExt, agent, ext.scope);
              installedCount++;
            }
          }
        }
      }

      // Добавление untracked-расширений в проектный конфиг (только из каталога, с актуальной версией)
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
      if (skippedCount > 0) parts.push(`не в каталоге: ${skippedCount}`);
      if (parts.length > 0) {
        const type = installedCount > 0 || trackedCount > 0 ? 'success' : 'error';
        setStatus(`Синхронизация: ${parts.join(', ')}`, type);
      } else {
        setStatus('Нечего синхронизировать', 'idle');
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
    setStartupPhase(prev => prev === 'conflicts' ? 'updateExtensions' : prev);
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
    setStartupPhase(prev => prev === 'conflicts' ? 'updateExtensions' : prev);
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

  // --- Обработчики диалога обновления каталога ---
  const handleCatalogUpdateSkip = useCallback(() => {
    setShowCatalogUpdateDialog(false);
    setStartupPhase(prev => prev === 'updateCatalog' ? 'conventions' : prev);
  }, []);

  const handleCatalogUpdateRetry = useCallback(() => {
    catalogUpdateStarted.current = false;
    setCatalogUpdateStatus('loading');
    setCatalogUpdateError(undefined);
    // Пересбрасываем фазу чтобы useEffect перезапустился
    setStartupPhase('updateCatalog');
  }, []);

  // --- Обработчики диалога обновления расширений ---
  const handleUpdateExtensions = useCallback(async () => {
    setShowExtensionUpdatesDialog(false);
    setStartupPhase(prev => prev === 'updateExtensions' ? 'selfUpdate' : prev);
    try {
      const cachePath = getCachePath();
      const catalog = loadCatalog(cachePath);
      let updatedCount = 0;
        for (const entry of extensionUpdates) {
        const catExt = catalog.extensions.find(e => e.name === entry.name && e.type === entry.type);
        if (!catExt) continue;
        try {
          const targetAgent = (entry.sourceAgent || agent) as AgentName;
          await registry.update(catExt, targetAgent, entry.scope);
          updatedCount++;
        } catch {
          // skip
        }
      }
      setStatus(`Обновлено расширений: ${updatedCount}`, 'success');
    } catch (err) {
      setStatus(`Ошибка обновления: ${String(err)}`, 'error');
    }
  }, [extensionUpdates, agent, registry, setStatus]);

  const handleSkipExtensionUpdates = useCallback(() => {
    setShowExtensionUpdatesDialog(false);
    setStartupPhase(prev => prev === 'updateExtensions' ? 'selfUpdate' : prev);
  }, []);

  // --- Обработчики диалога self-update ---
  const handleSelfUpdate = useCallback(async () => {
    setShowSelfUpdateDialog(false);
    setStartupPhase(prev => prev === 'selfUpdate' ? 'gitignoreAgentDirs' : prev);
    try {
      const result = await updateSelf(agent as AgentName);
      const parts: string[] = [];
      if (result.skill) parts.push('base-skill');
      if (result.mcp) parts.push('MCP');
      if (parts.length > 0) {
        setStatus(`Обновлено: ${parts.join(', ')}`, 'success');
      }
    } catch (err) {
      setStatus(`Ошибка обновления компонентов: ${String(err)}`, 'error');
    }
  }, [agent, setStatus]);

  const handleSkipSelfUpdate = useCallback(() => {
    setShowSelfUpdateDialog(false);
    setStartupPhase(prev => prev === 'selfUpdate' ? 'gitignoreAgentDirs' : prev);
  }, []);

  // --- Обработчик восстановления conventions ---
  const handleRepairConventions = useCallback(() => {
    setShowConventionsWarning(false);
    try {
      ensureConventionsStructure();
      setStatus('Структура agents-conventions восстановлена', 'success');
    } catch (err) {
      setStatus(`Ошибка восстановления: ${String(err)}`, 'error');
    }
    setStartupPhase(prev => prev === 'conventions' ? 'projectConfig' : prev);
  }, [setStatus]);

  const handleSyncGitignoreAgentDirs = useCallback(() => {
    setShowGitignoreAgentDirsDialog(false);
    const projectRoot = findProjectRoot();
    if (projectRoot && missingGitignoreEntries.length > 0) {
      addAgentDirsToGitignore(projectRoot, missingGitignoreEntries);
      setStatus(`Добавлено в .gitignore: ${missingGitignoreEntries.join(', ')}`, 'success');
    }
    setStartupPhase(prev => prev === 'gitignoreAgentDirs' ? 'done' : prev);
  }, [missingGitignoreEntries, setStatus]);

  const handleDismissGitignoreAgentDirs = useCallback(() => {
    setShowGitignoreAgentDirsDialog(false);
    setStartupPhase(prev => prev === 'gitignoreAgentDirs' ? 'done' : prev);
  }, []);

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

    if (!isTopLevel) {
      if (key.escape) {
        handleBack();
        return;
      }
      return;
    }
  }, { isActive: !dialogActive });
  const screen = nav.currentScreen;

  const layout = useLayout();
  const { breakpoint, columns: termWidth, rows: termHeight, catalogTable, installedTable, dialogInnerWidth, labelPadWidth } = layout;
  const isCompact = breakpoint === 'compact';
  // При малой высоте скрываем InfoBar и разделители — экономия 3 строк
  const hiddenRows = layout.showInfoBar ? 0 : 3;
  const contentAreaHeight = termHeight - 8 + hiddenRows; // Header(1+border) + Separator(1) + InfoBar(1) + Separator(1) + StatusBar(1) + HintBar(1)

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
          labelPadWidth={labelPadWidth}
          termColumns={termWidth}
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
          labelPadWidth={labelPadWidth}
          termColumns={termWidth}
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
          termColumns={termWidth}
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
          tableConfig={installedTable}
          compact={isCompact}
          termColumns={termWidth}
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
        tableConfig={catalogTable}
        compact={isCompact}
        termColumns={termWidth}
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
  const MIN_ROWS = 12;

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
        <Header activeTab={nav.activeTab} compact={isCompact} />
        <Box height={contentAreaHeight} flexDirection="column">
          {renderScreen()}
          {showConventionsWarning && (
            <Box position="absolute" marginTop={2} marginLeft={2}>
              <ConventionsWarningDialog
                issues={conventionsIssues}
                onGoToSettings={handleGoToSettings}
                onDismiss={handleDismissWarning}
                onRepair={handleRepairConventions}
                dialogWidth={dialogInnerWidth}
              />
            </Box>
          )}
          {showProjectConfigDialog && (
            <Box position="absolute" marginTop={2} marginLeft={2}>
              <ProjectConfigDialog
                onCreate={handleCreateProjectConfig}
                onDismiss={handleDismissProjectConfigDialog}
                dialogWidth={dialogInnerWidth}
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
                dialogWidth={dialogInnerWidth}
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
                dialogWidth={dialogInnerWidth}
              />
            </Box>
          )}
          {showGitignoreAgentDirsDialog && (
            <Box position="absolute" marginTop={2} marginLeft={2}>
              <AgentDirsGitignoreDialog
                missingEntries={missingGitignoreEntries}
                onSync={handleSyncGitignoreAgentDirs}
                onDismiss={handleDismissGitignoreAgentDirs}
                dialogWidth={dialogInnerWidth}
              />
            </Box>
          )}
          {showGitCredentials && (
            <Box position="absolute" marginTop={2} marginLeft={2}>
              <GitCredentialsDialog
                url={gitCredentialsUrl}
                onConfirm={handleGitCredentialsConfirm}
                onCancel={handleGitCredentialsCancel}
                dialogWidth={dialogInnerWidth}
              />
            </Box>
          )}
          {showCatalogUpdateDialog && (
            <Box position="absolute" marginTop={2} marginLeft={2}>
              <CatalogUpdateDialog
                status={catalogUpdateStatus}
                errorMessage={catalogUpdateError}
                onSkip={handleCatalogUpdateSkip}
                onRetry={handleCatalogUpdateRetry}
                dialogWidth={dialogInnerWidth}
              />
            </Box>
          )}
          {showExtensionUpdatesDialog && (
            <Box position="absolute" marginTop={2} marginLeft={2}>
              <ExtensionUpdatesDialog
                updates={extensionUpdates}
                onUpdate={handleUpdateExtensions}
                onSkip={handleSkipExtensionUpdates}
                dialogWidth={dialogInnerWidth}
              />
            </Box>
          )}
          {showSelfUpdateDialog && (
            <Box position="absolute" marginTop={2} marginLeft={2}>
              <SelfUpdateDialog
                hasBaseSkill={selfUpdateHasSkill}
                hasMcp={selfUpdateHasMcp}
                onUpdate={handleSelfUpdate}
                onSkip={handleSkipSelfUpdate}
                dialogWidth={dialogInnerWidth}
              />
            </Box>
          )}
        </Box>
        {!isFullscreen && (
          <>
            {layout.showSeparators ? <Separator /> : null}
            {layout.showInfoBar ? (
              <InfoBar
                totalCount={registry.installed.length}
                globalCount={globalCount}
                projectCount={projectCount}
                parentCount={parentCount}
                agent={agent}
                defaultScope={config.defaultScope}
                compact={isCompact}
              />
            ) : null}
            {layout.showSeparators ? <Separator /> : null}
            <StatusBar message={statusMessage} status={statusType} />
            <HintBar hints={hints} maxWidth={termWidth} />
          </>
        )}
      </Box>
    </StatusContext.Provider>
  );
};
