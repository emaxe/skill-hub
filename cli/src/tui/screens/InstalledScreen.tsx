import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { Extension, AgentName } from '../../catalog';
import { InstallRecord } from '../../registry';
import { useRegistry, InstalledEntry } from '../hooks/useRegistry';
import { Confirm } from '../components/Confirm';
import { HintBar, Hint } from '../components/HintBar';
import { useStatus } from '../contexts/StatusContext';
import { theme } from '../theme';

export interface InstalledScreenProps {
  agent: AgentName;
  onMoveExt: (ext: Extension, scope: 'global' | 'project') => void;
}

type ScopeFilter = 'all' | 'global' | 'project';

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

export const InstalledScreen: React.FC<InstalledScreenProps> = ({ agent, onMoveExt }) => {
  const { installed, loading, error, remove, update } = useRegistry();
  const { setStatus } = useStatus();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [confirmTarget, setConfirmTarget] = useState<InstalledEntry | null>(null);

  const filtered = useMemo(() => {
    if (scopeFilter === 'all') return installed;
    return installed.filter(e => e.scope === scopeFilter);
  }, [installed, scopeFilter]);

  const safeIndex = Math.min(selectedIndex, Math.max(0, filtered.length - 1));

  useInput((input, key) => {
    if (confirmTarget) return;

    if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setSelectedIndex(i => Math.min(filtered.length - 1, i + 1));
    } else if (input === 's') {
      setScopeFilter(f => nextScopeFilter(f));
      setSelectedIndex(0);
    } else if (input === 'd') {
      if (filtered.length > 0) {
        setConfirmTarget(filtered[safeIndex]);
      }
    } else if (input === 'm') {
      if (filtered.length > 0) {
        const entry = filtered[safeIndex];
        const ext = recordToExtension(entry);
        const toScope = entry.scope === 'global' ? 'project' : 'global';
        onMoveExt(ext, toScope);
      }
    } else if (input === 'u') {
      if (filtered.length > 0) {
        const entry = filtered[safeIndex];
        const ext = recordToExtension(entry);
        update(ext, agent, entry.scope).then(() => {
          setStatus(`Обновлено: ${entry.name}`, 'success');
        }).catch((err: unknown) => {
          setStatus(`Ошибка обновления: ${String(err)}`, 'error');
        });
      }
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
    { key: 's', description: `scope: ${scopeFilter}` },
    { key: 'd', description: 'удалить' },
    { key: 'm', description: 'переместить' },
    { key: 'u', description: 'обновить' },
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

      <Box flexDirection="column" paddingX={1}>
        {filtered.map((entry, idx) => {
          const isSelected = idx === safeIndex;
          return (
            <Box key={`${entry.type}:${entry.name}:${entry.scope}`} flexDirection="row">
              <Text color={isSelected ? theme.selected : theme.muted}>
                {isSelected ? '▶ ' : '  '}
              </Text>
              <Text color={theme.muted}>[</Text>
              <Text color={theme.accent}>{entry.type}</Text>
              <Text color={theme.muted}>] </Text>
              <Text color={isSelected ? theme.selected : theme.secondary} bold={isSelected}>
                {entry.name}
              </Text>
              <Text color={theme.muted}>{'  '}</Text>
              <Text color={theme.muted}>{entry.version || '?'}</Text>
              <Text color={theme.muted}>{'  '}</Text>
              <Text color={entry.scope === 'global' ? theme.success : theme.warning}>
                {entry.scope}
              </Text>
              <Text color={theme.muted}>{'  '}</Text>
              <Text color={entry.source === 'manual' ? theme.muted : theme.accent}>
                {entry.source}
              </Text>
            </Box>
          );
        })}
      </Box>

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
