import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { normalizeInput } from '../keymap';
import { Extension, AgentName } from '../../catalog';
import { InstallRecord } from '../../registry';
import { InstalledEntry } from '../hooks/useRegistry';
import { Confirm } from '../components/Confirm';
import { HintBar, Hint } from '../components/HintBar';
import { useStatus } from '../contexts/StatusContext';
import { theme } from '../theme';

export interface InstalledScreenProps {
  agent: AgentName;
  onMoveExt: (ext: Extension, scope: 'global' | 'project') => void;
  onOpenDetail: (entry: InstalledEntry) => void;
  installed: InstalledEntry[];
  loading: boolean;
  error: string | null;
  remove: (ext: Extension, agent: AgentName, scope: 'global' | 'project') => Promise<void>;
  update: (ext: Extension, agent: AgentName, scope: 'global' | 'project') => Promise<void>;
  updateSelf: () => Promise<void>;
}

type ScopeFilter = 'all' | 'global' | 'project';

const PAGE_SIZE = 10;

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function recordToExtension(record: InstallRecord): Extension {
  return {
    type: record.type,
    name: record.name,
    description: '',
    tags: [],
    scope: record.scope,
    platforms: {},
    path: record.path,
    dependencies: [],
    version: record.version,
  };
}

function nextScopeFilter(current: ScopeFilter): ScopeFilter {
  if (current === 'all') return 'global';
  if (current === 'global') return 'project';
  return 'all';
}

export const InstalledScreen: React.FC<InstalledScreenProps> = ({
  agent, onMoveExt, onOpenDetail, installed, loading, error, remove, update, updateSelf,
}) => {
  const { setStatus } = useStatus();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [confirmTarget, setConfirmTarget] = useState<InstalledEntry | null>(null);

  const filtered = useMemo(() => {
    if (scopeFilter === 'all') return installed;
    return installed.filter(e => e.scope === scopeFilter);
  }, [installed, scopeFilter]);

  const safeIndex = Math.min(selectedIndex, Math.max(0, filtered.length - 1));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.floor(safeIndex / PAGE_SIZE);
  const pageStart = currentPage * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  useInput((input, key) => {
    if (confirmTarget) return;

    const ni = normalizeInput(input);

    if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setSelectedIndex(i => Math.min(filtered.length - 1, i + 1));
    } else if (key.return) {
      if (filtered.length > 0) {
        onOpenDetail(filtered[safeIndex]);
      }
    } else if (ni === 's') {
      setScopeFilter(f => nextScopeFilter(f));
      setSelectedIndex(0);
    } else if (ni === 'd') {
      if (filtered.length > 0) {
        setConfirmTarget(filtered[safeIndex]);
      }
    } else if (ni === 'm') {
      if (filtered.length > 0) {
        const entry = filtered[safeIndex];
        const ext = recordToExtension(entry);
        const toScope = entry.scope === 'global' ? 'project' : 'global';
        onMoveExt(ext, toScope);
      }
    } else if (ni === 'u') {
      if (filtered.length > 0) {
        const entry = filtered[safeIndex];
        const ext = recordToExtension(entry);
        update(ext, agent, entry.scope).then(() => {
          setStatus(`Обновлено: ${entry.name}`, 'success');
        }).catch((err: unknown) => {
          setStatus(`Ошибка обновления: ${String(err)}`, 'error');
        });
      }
    } else if (input === 'U' || input === 'Г') {
      setStatus('Обновляю все расширения и систему...', 'loading');
      void (async () => {
        try {
          for (const entry of filtered) {
            await update(recordToExtension(entry), agent, entry.scope);
          }
          await updateSelf();
          setStatus('Всё обновлено', 'success');
        } catch (err: unknown) {
          setStatus(`Ошибка обновления: ${String(err)}`, 'error');
        }
      })();
    }
  });

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    const entry = confirmTarget;
    setConfirmTarget(null);
    const ext = recordToExtension(entry);
    try {
      await remove(ext, agent, entry.scope);
      setStatus(`Удалено: ${entry.name}`, 'success');
    } catch (err) {
      setStatus(`Ошибка удаления: ${String(err)}`, 'error');
    }
  };

  const hints: Hint[] = [
    { key: '↑↓', description: 'навигация' },
    { key: 'Enter', description: 'детали' },
    { key: 's', description: `scope: ${scopeFilter}` },
    { key: 'd', description: 'удалить' },
    { key: 'm', description: 'переместить' },
    { key: 'u', description: 'обновить' },
    { key: 'U', description: 'обновить все' },
  ];

  return (
    <Box flexDirection="column">
      <Box paddingX={1} paddingY={0}>
        <Text color={theme.primary} bold>Установленные расширения </Text>
        <Text color={theme.muted}>
          [{scopeFilter === 'all' ? 'все' : scopeFilter}] {filtered.length} шт.
        </Text>
      </Box>

      {loading && (
        <Box paddingX={1}>
          <Text color={theme.muted}>Загрузка...</Text>
        </Box>
      )}

      {error && (
        <Box paddingX={1}>
          <Text color={theme.error}>{error}</Text>
        </Box>
      )}

      {!loading && filtered.length === 0 && (
        <Box paddingX={1}>
          <Text color={theme.muted}>Нет установленных расширений</Text>
        </Box>
      )}

      {!loading && filtered.length > 0 && (
        <Box flexDirection="column" paddingX={1} marginTop={1}>
          {/* Table header */}
          <Box flexDirection="row">
            <Box minWidth={2}><Text> </Text></Box>
            <Box minWidth={9}><Text dimColor>TYPE</Text></Box>
            <Box minWidth={24}><Text dimColor>NAME</Text></Box>
            <Box minWidth={8}><Text dimColor>VER</Text></Box>
            <Box minWidth={8}><Text dimColor>SCOPE</Text></Box>
            <Text dimColor>SOURCE</Text>
          </Box>
          {/* Separator */}
          <Box flexDirection="row">
            <Box minWidth={2}><Text> </Text></Box>
            <Box minWidth={9}><Text dimColor>{'────────'}</Text></Box>
            <Box minWidth={24}><Text dimColor>{'──────────────────────'}</Text></Box>
            <Box minWidth={8}><Text dimColor>{'──────'}</Text></Box>
            <Box minWidth={8}><Text dimColor>{'───────'}</Text></Box>
            <Text dimColor>{'────────'}</Text>
          </Box>
          {/* Rows */}
          {pageItems.map((entry, localIdx) => {
            const isSelected = pageStart + localIdx === safeIndex;
            return (
              <Box key={`${entry.type}:${entry.name}:${entry.scope}`} flexDirection="row">
                <Box minWidth={2}>
                  <Text color={isSelected ? theme.selected : theme.muted}>
                    {isSelected ? '▶' : ' '}
                  </Text>
                </Box>
                <Box minWidth={9}>
                  <Text color={theme.accent}>{truncate(entry.type, 8)}</Text>
                </Box>
                <Box minWidth={24}>
                  <Text color={isSelected ? theme.selected : theme.secondary} bold={isSelected}>
                    {truncate(entry.name, 22)}
                  </Text>
                </Box>
                <Box minWidth={8}>
                  <Text color={theme.muted}>{truncate(entry.version || '?', 7)}</Text>
                </Box>
                <Box minWidth={8}>
                  <Text color={entry.scope === 'global' ? theme.success : theme.warning}>
                    {entry.scope}
                  </Text>
                </Box>
                <Text color={entry.source === 'manual' ? theme.muted : theme.accent}>
                  {entry.source}
                </Text>
              </Box>
            );
          })}
          {/* Pagination indicator */}
          {totalPages > 1 && (
            <Box marginTop={1}>
              <Text dimColor>
                {`Стр. ${currentPage + 1} из ${totalPages}  (${filtered.length} шт.)`}
              </Text>
            </Box>
          )}
        </Box>
      )}

      {confirmTarget && (
        <Confirm
          message={`Удалить ${confirmTarget.name}?`}
          onConfirm={() => { void handleConfirmDelete(); }}
          onCancel={() => setConfirmTarget(null)}
        />
      )}

      <Box marginTop={1}>
        <HintBar hints={hints} />
      </Box>
    </Box>
  );
};
