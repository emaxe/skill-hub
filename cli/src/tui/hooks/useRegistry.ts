import { useState, useEffect, useCallback, useRef } from 'react';
import os from 'os';
import path from 'path';
import { AgentName, ExtensionType, Extension } from '../../catalog';
import { createRegistry, InstallRecord } from '../../registry';
import { getAdapter } from '../../adapters/get-adapter';
import { ScanResult } from '../../adapters/types';
import { getCachePath } from '../../git';
import { EffectiveScope, filterRecordsByDirectory } from '../../path-filter';

const REGISTRY_DIR = path.join(os.homedir(), '.skill-hub');

export interface InstalledEntry extends InstallRecord {
  source: 'registry' | 'manual';
  effectiveScope: EffectiveScope;
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
    const records = registryRef.current.list(agent);

    // Фильтруем записи реестра по текущей директории
    const filtered = filterRecordsByDirectory(records, cwd, homeDir);
    const entries: InstalledEntry[] = filtered.map(({ record, effectiveScope }) => ({
      ...record,
      source: 'registry' as const,
      effectiveScope,
    }));

    // Добавляем manual installs из filesystem scan для текущего агента
    // (scanInstalled сканирует только cwd — effectiveScope = scope)
    try {
      const adapter = getAdapter(agent);
      const scanned: ScanResult[] = adapter.scanInstalled();
      for (const scan of scanned) {
        const alreadyInRegistry = entries.some(e => e.name === scan.name && e.type === scan.type);
        if (!alreadyInRegistry) {
          entries.push({
            type: scan.type,
            name: scan.name,
            version: '?',
            agent,
            scope: scan.scope,
            path: scan.path,
            source: 'manual',
            effectiveScope: scan.scope,
          });
        }
      }
    } catch {
      // scan failed — ignore
    }

    setInstalled(entries);
  }, [agent, refreshKey]);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

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
    });
  }, [withStatus]);

  const remove = useCallback(async (ext: Extension, agent: AgentName, scope: 'global' | 'project', deleteFromDisk = true) => {
    await withStatus(`Удаляю ${ext.name}...`, async () => {
      if (deleteFromDisk) {
        const adapter = getAdapter(agent);
        await adapter.remove(ext, scope);
      }
      registryRef.current.remove(ext.name, ext.type, agent);
    });
  }, [withStatus]);

  const move = useCallback(async (ext: Extension, agent: AgentName, fromScope: 'global' | 'project') => {
    const toScope = fromScope === 'global' ? 'project' : 'global';
    await withStatus(`Перемещаю ${ext.name} в ${toScope}...`, async () => {
      const adapter = getAdapter(agent);
      const cachePath = getCachePath();
      // Устанавливаем в новый scope
      await adapter.install(ext, toScope, cachePath);
      registryRef.current.add({
        type: ext.type, name: ext.name,
        version: ext.version || '0.0.0',
        agent, scope: toScope,
        path: adapter.getInstallPath(ext, toScope),
      });
      // Удаляем из старого scope
      await adapter.remove(ext, fromScope);
    });
  }, [withStatus]);

  const update = useCallback(async (ext: Extension, agent: AgentName, scope: 'global' | 'project') => {
    await withStatus(`Обновляю ${ext.name}...`, async () => {
      const adapter = getAdapter(agent);
      const cachePath = getCachePath();
      // Переустанавливаем — это и есть обновление
      await adapter.install(ext, scope, cachePath);
      registryRef.current.add({
        type: ext.type, name: ext.name,
        version: ext.version || '0.0.0',
        agent, scope,
        path: adapter.getInstallPath(ext, scope),
      });
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
