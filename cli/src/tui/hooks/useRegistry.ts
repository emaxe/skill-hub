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
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AgentName, ExtensionType, Extension } from '../../catalog';
import { createRegistry, InstallRecord } from '../../registry';
import { getAdapter } from '../../adapters/get-adapter';
import { ScanResult } from '../../adapters/types';
import { getCachePath } from '../../git';
import { EffectiveScope, filterRecordsByDirectory } from '../../path-filter';
import { hasProjectConfig, addProjectExtension, removeProjectExtension } from '../../config';
import { installExtension, removeExtension, moveExtension, updateExtension } from '../../extension-manager';
import { downloadSkillssh, writeSkillsshFilesToTmp, parseSkillsshRef } from '../../skillssh';

const REGISTRY_DIR = path.join(os.homedir(), '.skill-hub');

export interface InstalledEntry extends InstallRecord {
  entrySource: 'registry' | 'manual';
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

async function resolveSkillsshSource(ext: Extension): Promise<{ ext: Extension; sourcePath?: string }> {
  if (ext.source?.type !== 'skillssh') return { ext };
  const ref = parseSkillsshRef(ext.source.uri);
  if (!ref.source || !ref.slug) throw new Error(`Invalid skillssh source: ${ext.source.uri}`);
  const download = await downloadSkillssh(ref.source, ref.slug);
  const tmpDir = writeSkillsshFilesToTmp(download, ref.slug);
  const extWithHash = { ...ext, version: download.hash };
  return { ext: extWithHash, sourcePath: tmpDir };
}

function cleanupTmp(sourcePath?: string) {
  if (sourcePath) {
    try { fs.rmSync(sourcePath, { recursive: true }); } catch {}
  }
}

export function useRegistry(agent: AgentName): UseRegistryState & UseRegistryActions {
  const [installed, setInstalled] = useState<InstalledEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operationStatus, setOperationStatus] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Загрузка списка установленных (фильтруем по текущему агенту и директории)
  useEffect(() => {
    const cwd = process.cwd();
    const homeDir = os.homedir();
    const isConventions = agent === 'agents-conventions';

    const entries: InstalledEntry[] = [];

    if (isConventions) {
      // --- agents-conventions: проектные из .agents/ + глобальные от всех ИИ-агентов ---

      // 1) Проектные расширения из .agents/ (через AgentsConventionsAdapter)
      const acRecords = createRegistry(REGISTRY_DIR).list(agent);
      const acFiltered = filterRecordsByDirectory(acRecords, cwd, homeDir);
      for (const { record, effectiveScope } of acFiltered) {
        entries.push({ ...record, entrySource: 'registry', effectiveScope, sourceAgent: agent });
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
              entrySource: 'manual', effectiveScope: scan.scope, sourceAgent: agent,
            });
          }
        }
      } catch { /* ignore */ }

      // 2) Глобальные расширения от всех ИИ-агентов
      const realAgents: AgentName[] = ['claude-code', 'cursor', 'copilot', 'codex'];
      for (const realAgent of realAgents) {
        // Из реестра — только global
        const agentRecords = createRegistry(REGISTRY_DIR).list(realAgent);
        for (const record of agentRecords) {
          if (record.scope !== 'global') continue;
          // Пропускаем записи-призраки: файл удалён, но запись осталась в реестре
          if (!fs.existsSync(record.path)) continue;
          const already = entries.some(e => e.name === record.name && e.type === record.type && e.effectiveScope === 'global' && e.sourceAgent === realAgent);
          if (!already) {
            entries.push({ ...record, entrySource: 'registry', effectiveScope: 'global', sourceAgent: realAgent });
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
                entrySource: 'manual', effectiveScope: 'global', sourceAgent: realAgent,
              });
            }
          }
        } catch { /* ignore */ }
      }
    } else {
      // --- Стандартный режим (claude-code, cursor, copilot) ---
      const records = createRegistry(REGISTRY_DIR).list(agent);
      const filtered = filterRecordsByDirectory(records, cwd, homeDir);
      for (const { record, effectiveScope } of filtered) {
        entries.push({ ...record, entrySource: 'registry', effectiveScope });
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
              entrySource: 'manual', effectiveScope: scan.scope,
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
      const { ext: resolvedExt, sourcePath } = await resolveSkillsshSource(ext);
      try {
        await installExtension(resolvedExt, agent, scope, REGISTRY_DIR, sourcePath);
      } finally {
        cleanupTmp(sourcePath);
      }
    });
  }, [withStatus]);

  const remove = useCallback(async (ext: Extension, agent: AgentName, scope: 'global' | 'project', deleteFromDisk = true) => {
    await withStatus(`Удаляю ${ext.name}...`, async () => {
      await removeExtension(ext, agent, scope, REGISTRY_DIR, deleteFromDisk);
    });
  }, [withStatus]);

  const move = useCallback(async (ext: Extension, agent: AgentName, fromScope: 'global' | 'project') => {
    await withStatus(`Перемещаю ${ext.name}...`, async () => {
      const { ext: resolvedExt, sourcePath } = await resolveSkillsshSource(ext);
      try {
        await moveExtension(resolvedExt, agent, fromScope, REGISTRY_DIR, sourcePath);
      } finally {
        cleanupTmp(sourcePath);
      }
    });
  }, [withStatus]);

  const update = useCallback(async (ext: Extension, agent: AgentName, scope: 'global' | 'project') => {
    await withStatus(`Обновляю ${ext.name}...`, async () => {
      const { ext: resolvedExt, sourcePath } = await resolveSkillsshSource(ext);
      try {
        await updateExtension(resolvedExt, agent, scope, REGISTRY_DIR, sourcePath);
      } finally {
        cleanupTmp(sourcePath);
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
