/**
 * Центральный хук управления расширениями — загрузка, установка, удаление, перемещение, обновление.
 *
 * Два режима работы:
 * - Стандартный (claude-code, cursor, copilot): реестр + filesystem scan для одного агента
 * - agents-conventions: агрегация проектных из .agents/ + глобальных от всех ИИ-агентов
 *
 * Все операции обёрнуты в withStatus() для единообразной обработки loading/error/success.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import os from 'os';
import path from 'path';
import { AgentName, ExtensionType, Extension } from '../../catalog';
import { createRegistry, InstallRecord } from '../../registry';
import { getAdapter } from '../../adapters/get-adapter';
import { ScanResult } from '../../adapters/types';
import { getCachePath } from '../../git';
import { EffectiveScope, filterRecordsByDirectory } from '../../path-filter';
import { hasProjectConfig, addProjectExtension, removeProjectExtension } from '../../config';

const REGISTRY_DIR = path.join(os.homedir(), '.skill-hub');

export interface InstalledEntry extends InstallRecord {
  source: 'registry' | 'manual';
  effectiveScope: EffectiveScope;
  /** ИИ-агент-владелец (актуально для agents-conventions, где глобальные расширения берутся от разных агентов) */
  sourceAgent?: AgentName;
}

export interface UseRegistryState {
  installed: InstalledEntry[];
  loading: boolean;
  error: string | null;
  operationStatus: string | null;
}

export interface UseRegistryActions {
  install: (ext: Extension, agent: AgentName, scope: 'global' | 'project') => Promise<void>;
  remove: (ext: Extension, agent: AgentName, scope: 'global' | 'project', deleteFromDisk?: boolean) => Promise<void>;
  move: (ext: Extension, agent: AgentName, fromScope: 'global' | 'project') => Promise<void>;
  update: (ext: Extension, agent: AgentName, scope: 'global' | 'project') => Promise<void>;
  isInstalled: (name: string, type: ExtensionType, agent: AgentName) => boolean;
  refresh: () => void;
}

export function useRegistry(agent: AgentName): UseRegistryState & UseRegistryActions {
  const [installed, setInstalled] = useState<InstalledEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operationStatus, setOperationStatus] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const registryRef = useRef(createRegistry(REGISTRY_DIR));

  // Загрузка списка установленных (фильтруем по текущему агенту и директории)
  useEffect(() => {
    const cwd = process.cwd();
    const homeDir = os.homedir();
    const isConventions = agent === 'agents-conventions';

    const entries: InstalledEntry[] = [];

    if (isConventions) {
      // --- agents-conventions: проектные из .agents/ + глобальные от всех ИИ-агентов ---

      // 1) Проектные расширения из .agents/ (через AgentsConventionsAdapter)
      const acRecords = registryRef.current.list(agent);
      const acFiltered = filterRecordsByDirectory(acRecords, cwd, homeDir);
      for (const { record, effectiveScope } of acFiltered) {
        entries.push({ ...record, source: 'registry', effectiveScope, sourceAgent: agent });
      }

      try {
        const acAdapter = getAdapter(agent);
        const acScanned = acAdapter.scanInstalled();
        for (const scan of acScanned) {
          const alreadyInRegistry = entries.some(e => e.name === scan.name && e.type === scan.type && e.effectiveScope === scan.scope);
          if (!alreadyInRegistry) {
            entries.push({
              type: scan.type, name: scan.name, version: '?',
              agent, scope: scan.scope, path: scan.path,
              source: 'manual', effectiveScope: scan.scope, sourceAgent: agent,
            });
          }
        }
      } catch { /* ignore */ }

      // 2) Глобальные расширения от всех ИИ-агентов
      const realAgents: AgentName[] = ['claude-code', 'cursor', 'copilot'];
      for (const realAgent of realAgents) {
        // Из реестра — только global
        const agentRecords = registryRef.current.list(realAgent);
        for (const record of agentRecords) {
          if (record.scope !== 'global') continue;
          const already = entries.some(e => e.name === record.name && e.type === record.type && e.effectiveScope === 'global' && e.sourceAgent === realAgent);
          if (!already) {
            entries.push({ ...record, source: 'registry', effectiveScope: 'global', sourceAgent: realAgent });
          }
        }

        // Filesystem scan — только global
        try {
          const realAdapter = getAdapter(realAgent);
          const scanned = realAdapter.scanInstalled();
          for (const scan of scanned) {
            if (scan.scope !== 'global') continue;
            const already = entries.some(e => e.name === scan.name && e.type === scan.type && e.effectiveScope === 'global' && e.sourceAgent === realAgent);
            if (!already) {
              entries.push({
                type: scan.type, name: scan.name, version: '?',
                agent: realAgent, scope: 'global', path: scan.path,
                source: 'manual', effectiveScope: 'global', sourceAgent: realAgent,
              });
            }
          }
        } catch { /* ignore */ }
      }
    } else {
      // --- Стандартный режим (claude-code, cursor, copilot) ---
      const records = registryRef.current.list(agent);
      const filtered = filterRecordsByDirectory(records, cwd, homeDir);
      for (const { record, effectiveScope } of filtered) {
        entries.push({ ...record, source: 'registry', effectiveScope });
      }

      try {
        const adapter = getAdapter(agent);
        const scanned: ScanResult[] = adapter.scanInstalled();
        for (const scan of scanned) {
          const alreadyInRegistry = entries.some(e => e.name === scan.name && e.type === scan.type);
          if (!alreadyInRegistry) {
            entries.push({
              type: scan.type, name: scan.name, version: '?',
              agent, scope: scan.scope, path: scan.path,
              source: 'manual', effectiveScope: scan.scope,
            });
          }
        }
      } catch { /* ignore */ }
    }

    setInstalled(entries);
  }, [agent, refreshKey]);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  /** Обёртка для async-операций: показывает статус загрузки, обрабатывает ошибки, автообновляет список */
  const withStatus = useCallback(async (label: string, fn: () => Promise<void>) => {
    if (!mountedRef.current) return;
    setError(null);
    setOperationStatus(label);
    setLoading(true);
    try {
      await fn();
      if (!mountedRef.current) return;
      setOperationStatus(`✓ ${label}`);
      refresh();
      setTimeout(() => { if (mountedRef.current) setOperationStatus(null); }, 3000);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(String(err));
      setOperationStatus(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [refresh]);

  const install = useCallback(async (ext: Extension, agent: AgentName, scope: 'global' | 'project') => {
    await withStatus(`Устанавливаю ${ext.name}...`, async () => {
      const adapter = getAdapter(agent);
      const cachePath = getCachePath();
      await adapter.install(ext, scope, cachePath);
      registryRef.current.add({
        type: ext.type, name: ext.name,
        version: ext.version || '0.0.0',
        agent, scope,
        path: adapter.getInstallPath(ext, scope),
      });
      if (hasProjectConfig()) {
        addProjectExtension({ type: ext.type, name: ext.name, version: ext.version, scope });
      }
    });
  }, [withStatus]);

  const remove = useCallback(async (ext: Extension, agent: AgentName, scope: 'global' | 'project', deleteFromDisk = true) => {
    await withStatus(`Удаляю ${ext.name}...`, async () => {
      if (deleteFromDisk) {
        const adapter = getAdapter(agent);
        await adapter.remove(ext, scope);
      }
      registryRef.current.remove(ext.name, ext.type, agent);
      if (hasProjectConfig()) {
        removeProjectExtension(ext.name, ext.type);
      }
    });
  }, [withStatus]);

  const move = useCallback(async (ext: Extension, agent: AgentName, fromScope: 'global' | 'project') => {
    const toScope = fromScope === 'global' ? 'project' : 'global';
    await withStatus(`Перемещаю ${ext.name} в ${toScope}...`, async () => {
      const adapter = getAdapter(agent);
      const cachePath = getCachePath();
      await adapter.install(ext, toScope, cachePath);
      registryRef.current.add({
        type: ext.type, name: ext.name,
        version: ext.version || '0.0.0',
        agent, scope: toScope,
        path: adapter.getInstallPath(ext, toScope),
      });
      await adapter.remove(ext, fromScope);
      if (hasProjectConfig()) {
        addProjectExtension({ type: ext.type, name: ext.name, version: ext.version, scope: toScope });
      }
    });
  }, [withStatus]);

  const update = useCallback(async (ext: Extension, agent: AgentName, scope: 'global' | 'project') => {
    await withStatus(`Обновляю ${ext.name}...`, async () => {
      const adapter = getAdapter(agent);
      const cachePath = getCachePath();
      await adapter.install(ext, scope, cachePath);
      registryRef.current.add({
        type: ext.type, name: ext.name,
        version: ext.version || '0.0.0',
        agent, scope,
        path: adapter.getInstallPath(ext, scope),
      });
      if (hasProjectConfig()) {
        addProjectExtension({ type: ext.type, name: ext.name, version: ext.version, scope });
      }
    });
  }, [withStatus]);

  const isInstalled = useCallback((name: string, type: ExtensionType, _agent: AgentName) => {
    return installed.some(e => e.name === name && e.type === type);
  }, [installed]);

  return {
    installed,
    loading,
    error,
    operationStatus,
    install,
    remove,
    move,
    update,
    isInstalled,
    refresh,
  };
}
