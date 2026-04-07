import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { normalizeInput } from '../keymap';
import { Extension, AgentName, ExtensionType } from '../../catalog';
import { InstallRecord } from '../../registry';
import { InstalledEntry } from '../hooks/useRegistry';
import { Confirm } from '../components/Confirm';
import { HintBar, Hint } from '../components/HintBar';
import { SearchInput } from '../components/SearchInput';
import { FilterBar } from '../components/FilterBar';
import { useStatus } from '../contexts/StatusContext';
import { theme } from '../theme';

export interface InstalledScreenProps {
  agent: AgentName;
  onMoveExt: (ext: Extension, scope: 'global' | 'project') => void;
  onOpenDetail: (entry: InstalledEntry) => void;
  onSearchFocusChange?: (focused: boolean) => void;
  installed: InstalledEntry[];
  loading: boolean;
  error: string | null;
  remove: (ext: Extension, agent: AgentName, scope: 'global' | 'project', deleteFromDisk?: boolean) => Promise<void>;
  update: (ext: Extension, agent: AgentName, scope: 'global' | 'project') => Promise<void>;
  updateSelf: () => Promise<void>;
}

type ScopeFilter = 'all' | 'global' | 'project' | 'parent';
type AgentFilter = 'all' | 'claude-code' | 'cursor' | 'copilot';

const PAGE_SIZE = 10;

const CONVENTIONS_SCOPE_FILTERS: ScopeFilter[] = ['global', 'project'];
const STANDARD_SCOPE_FILTERS: ScopeFilter[] = ['all', 'global', 'project', 'parent'];
const AGENT_FILTERS: AgentFilter[] = ['all', 'claude-code', 'cursor', 'copilot'];

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function recordToExtension(record: InstallRecord): Extension {
  return {
    type: record.type,
    name: record.name,
    description: '',
    tags: [],
    scope: record.scope === 'parent' ? 'project' : record.scope,
    platforms: {},
    path: record.path,
    dependencies: [],
    version: record.version,
  };
}

function nextInList<T>(current: T, list: T[]): T {
  const idx = list.indexOf(current);
  return list[(idx + 1) % list.length];
}

export const InstalledScreen: React.FC<InstalledScreenProps> = ({
  agent, onMoveExt, onOpenDetail, onSearchFocusChange, installed, loading, error, remove, update, updateSelf,
}) => {
  const { setStatus } = useStatus();
  const isConventions = agent === 'agents-conventions';

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>(isConventions ? 'project' : 'all');
  const [typeFilter, setTypeFilter] = useState<ExtensionType | 'all'>('all');
  const [agentFilter, setAgentFilter] = useState<AgentFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<InstalledEntry | null>(null);
  const [confirmDiskDelete, setConfirmDiskDelete] = useState<InstalledEntry | null>(null);

  const setSearch = (focused: boolean) => {
    setSearchFocused(focused);
    onSearchFocusChange?.(focused);
  };

  const filtered = useMemo(() => {
    let list = installed;

    // Scope filter
    if (scopeFilter !== 'all') {
      list = list.filter(e => e.effectiveScope === scopeFilter);
    }

    // Type filter (conventions mode)
    if (isConventions && typeFilter !== 'all') {
      list = list.filter(e => e.type === typeFilter);
    }

    // Agent filter (conventions mode, only for global scope)
    if (isConventions && scopeFilter === 'global' && agentFilter !== 'all') {
      list = list.filter(e => (e.sourceAgent || e.agent) === agentFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q));
    }

    return list;
  }, [installed, scopeFilter, typeFilter, agentFilter, searchQuery, isConventions]);

  const safeIndex = Math.min(selectedIndex, Math.max(0, filtered.length - 1));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.floor(safeIndex / PAGE_SIZE);
  const pageStart = currentPage * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  useInput((input, key) => {
    if (confirmTarget || confirmDiskDelete) return;

    // Search mode
    if (searchFocused) {
      if (key.escape || key.return) {
        setSearch(false);
      }
      return;
    }

    const ni = normalizeInput(input);

    if (isConventions && ni === '/') {
      setSearch(true);
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setSelectedIndex(i => Math.min(filtered.length - 1, i + 1));
    } else if (key.return) {
      if (filtered.length > 0) {
        onOpenDetail(filtered[safeIndex]);
      }
    } else if (ni === 's') {
      const scopeList = isConventions ? CONVENTIONS_SCOPE_FILTERS : STANDARD_SCOPE_FILTERS;
      setScopeFilter(f => nextInList(f, scopeList));
      setSelectedIndex(0);
    } else if (isConventions && ni === 't') {
      const types: (ExtensionType | 'all')[] = ['all', 'skill', 'agent', 'command', 'rule'];
      setTypeFilter(f => nextInList(f, types));
      setSelectedIndex(0);
    } else if (isConventions && ni === 'a' && scopeFilter === 'global') {
      setAgentFilter(f => nextInList(f, AGENT_FILTERS));
      setSelectedIndex(0);
    } else if (ni === 'd') {
      if (filtered.length > 0) {
        setConfirmTarget(filtered[safeIndex]);
      }
    } else if (ni === 'm' && !isConventions) {
      if (filtered.length > 0) {
        const entry = filtered[safeIndex];
        if (entry.effectiveScope === 'parent') return;
        const ext = recordToExtension(entry);
        const toScope = entry.scope === 'global' ? 'project' : 'global';
        onMoveExt(ext, toScope);
      }
    } else if (ni === 'u') {
      if (filtered.length > 0) {
        const entry = filtered[safeIndex];
        if (entry.effectiveScope === 'parent') return;
        const ext = recordToExtension(entry);
        update(ext, agent, entry.scope as 'global' | 'project').then(() => {
          setStatus(`Обновлено: ${entry.name}`, 'success');
        }).catch((err: unknown) => {
          setStatus(`Ошибка обновления: ${String(err)}`, 'error');
        });
      }
    } else if (ni === 'U') {
      setStatus('Обновляю все расширения и систему...', 'loading');
      void (async () => {
        try {
          for (const entry of filtered) {
            if (entry.effectiveScope === 'parent') continue;
            await update(recordToExtension(entry), agent, entry.scope as 'global' | 'project');
          }
          await updateSelf();
          setStatus('Всё обновлено', 'success');
        } catch (err: unknown) {
          setStatus(`Ошибка обновления: ${String(err)}`, 'error');
        }
      })();
    }
  });

  const handleConfirmDelete = () => {
    if (!confirmTarget) return;
    setConfirmDiskDelete(confirmTarget);
    setConfirmTarget(null);
  };

  const handleDiskDeleteChoice = async (deleteFromDisk: boolean) => {
    if (!confirmDiskDelete) return;
    const entry = confirmDiskDelete;
    setConfirmDiskDelete(null);
    const ext = recordToExtension(entry);
    try {
      await remove(ext, agent, entry.scope as 'global' | 'project', deleteFromDisk);
      setStatus(`Удалено: ${entry.name}${deleteFromDisk ? '' : ' (файлы сохранены)'}`, 'success');
    } catch (err) {
      setStatus(`Ошибка удаления: ${String(err)}`, 'error');
    }
  };

  const hints: Hint[] = searchFocused
    ? [{ key: 'Esc', description: 'закрыть поиск' }]
    : isConventions
      ? [
          { key: '/', description: 'поиск' },
          { key: '↑↓', description: 'навигация' },
          { key: 'Enter', description: 'детали' },
          { key: 's', description: `scope: ${scopeFilter}` },
          { key: 't', description: `тип: ${typeFilter}` },
          ...(scopeFilter === 'global' ? [{ key: 'a', description: `агент: ${agentFilter}` }] : []),
          { key: 'd', description: 'удалить' },
          { key: 'u', description: 'обновить' },
          { key: 'U', description: 'обновить все' },
        ]
      : [
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
      {/* Search input (conventions mode only) */}
      {isConventions && (
        <SearchInput value={searchQuery} onChange={setSearchQuery} focused={searchFocused} />
      )}

      {/* Type filter bar (conventions mode only) */}
      {isConventions && (
        <FilterBar activeType={typeFilter} onTypeChange={setTypeFilter} />
      )}

      {/* Agent filter bar (conventions mode, global scope only) */}
      {isConventions && scopeFilter === 'global' && (
        <Box paddingX={1}>
          <Text color={theme.muted}>Агент: </Text>
          {AGENT_FILTERS.map(af => (
            <React.Fragment key={af}>
              <Text color={theme.muted}>  </Text>
              <Text
                color={agentFilter === af ? theme.selected : theme.muted}
                bold={agentFilter === af}
              >
                {af === 'all' ? 'Все' : af}
              </Text>
            </React.Fragment>
          ))}
        </Box>
      )}

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
            <Box minWidth={10}><Text dimColor>SOURCE</Text></Box>
            <Text dimColor>AGENT</Text>
          </Box>
          {/* Separator */}
          <Box flexDirection="row">
            <Box minWidth={2}><Text> </Text></Box>
            <Box minWidth={9}><Text dimColor>{'────────'}</Text></Box>
            <Box minWidth={24}><Text dimColor>{'──────────────────────'}</Text></Box>
            <Box minWidth={8}><Text dimColor>{'──────'}</Text></Box>
            <Box minWidth={8}><Text dimColor>{'───────'}</Text></Box>
            <Box minWidth={10}><Text dimColor>{'────────'}</Text></Box>
            <Text dimColor>{'────────'}</Text>
          </Box>
          {/* Rows */}
          {pageItems.map((entry, localIdx) => {
            const isSelected = pageStart + localIdx === safeIndex;
            const displayAgent = isConventions
              ? (entry.sourceAgent === 'agents-conventions' ? 'all agents' : (entry.sourceAgent || entry.agent))
              : (entry.agent === 'agents-conventions' ? 'all agents' : entry.agent);
            return (
              <Box key={`${entry.type}:${entry.name}:${entry.scope}:${entry.sourceAgent || entry.agent}`} flexDirection="row">
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
                  <Text color={entry.effectiveScope === 'global' ? theme.success : entry.effectiveScope === 'parent' ? theme.accent : theme.warning}>
                    {entry.effectiveScope}
                  </Text>
                </Box>
                <Box minWidth={10}>
                  <Text color={entry.source === 'manual' ? theme.muted : theme.accent}>
                    {entry.source}
                  </Text>
                </Box>
                <Text color={displayAgent === 'all agents' ? theme.primary : theme.muted}>
                  {displayAgent}
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
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmTarget(null)}
        />
      )}

      {confirmDiskDelete && (
        <Confirm
          message={`Удалить файлы ${confirmDiskDelete.name} с диска? (n = только из реестра)`}
          onConfirm={() => { void handleDiskDeleteChoice(true); }}
          onCancel={() => { void handleDiskDeleteChoice(false); }}
        />
      )}

      <Box marginTop={1}>
        <HintBar hints={hints} />
      </Box>
    </Box>
  );
};
