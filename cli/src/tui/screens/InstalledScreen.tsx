/**
 * Экран установленных расширений — таблица с фильтрами, действиями и пагинацией.
 *
 * Два режима: стандартный и agents-conventions (дополнительные фильтры: поиск, тип, агент).
 * Удаление — двухэтапное: 1) «Удалить?» → 2) «Удалить файлы с диска?» (можно оставить только из реестра).
 * Хоткеи: d(удалить), m(переместить), u(обновить), U(обновить все), s(scope), /(поиск).
 */
import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { normalizeInput, isUpArrow, isDownArrow } from '../keymap';
import { Extension, AgentName, ExtensionType } from '../../catalog';
import { InstallRecord } from '../../registry';
import { InstalledEntry } from '../hooks/useRegistry';
import { ScanResult } from '../../adapters/types';
import { InstalledTableConfig } from '../hooks/useLayout';
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
  viewHeight: number;
  project?: string | null;
  inputActive?: boolean;
  /** Есть ли write-доступ к каталогу (для кнопки загрузки) */
  hasUploadAccess?: boolean;
  /** Открыть экран загрузки */
  onOpenUpload?: (preselected?: ScanResult[]) => void;
  /** Адаптивная конфигурация колонок таблицы */
  tableConfig?: InstalledTableConfig;
  /** Compact-режим для вложенных компонентов */
  compact?: boolean;
  /** Ширина терминала для адаптивных хинтов */
  termColumns?: number;
}

type ScopeFilter = 'all' | 'global' | 'project' | 'parent';
type AgentFilter = 'all' | 'claude-code' | 'cursor' | 'copilot' | 'codex';

const PAGE_SIZE_MIN = 3;
// Fixed rows: title(1) + header(1) + separator(1) + HintBar(1) + pagination(2) + search/filter(~2 in conventions mode)
const FIXED_ROWS = 6;

const CONVENTIONS_SCOPE_FILTERS: ScopeFilter[] = ['global', 'project'];
const STANDARD_SCOPE_FILTERS: ScopeFilter[] = ['all', 'global', 'project', 'parent'];
const AGENT_FILTERS: AgentFilter[] = ['all', 'claude-code', 'cursor', 'copilot', 'codex'];

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function recordToExtension(record: InstallRecord): Extension {
  return {
    type: record.type,
    name: record.name,
    description: '',
    tags: record.tags ?? [],
    scope: record.scope === 'parent' ? 'project' : record.scope,
    platforms: {},
    path: record.path,
    dependencies: [],
    version: record.version,
    projects: record.projects ?? [],
  };
}

function nextInList<T>(current: T, list: T[]): T {
  const idx = list.indexOf(current);
  return list[(idx + 1) % list.length];
}

export const InstalledScreen: React.FC<InstalledScreenProps> = ({
  agent, onMoveExt, onOpenDetail, onSearchFocusChange, installed, loading, error, remove, update, updateSelf, viewHeight, project, inputActive,
  hasUploadAccess, onOpenUpload, tableConfig, compact, termColumns,
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

  const extraRows = isConventions ? 4 : 0; // search + filter + agent filter rows
  const pageSize = Math.max(PAGE_SIZE_MIN, viewHeight - FIXED_ROWS - extraRows);

  const safeIndex = Math.min(selectedIndex, Math.max(0, filtered.length - 1));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.floor(safeIndex / pageSize);
  const pageStart = currentPage * pageSize;
  const pageItems = filtered.slice(pageStart, pageStart + pageSize);

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

    if (isUpArrow(input, key)) {
      setSelectedIndex(i => Math.max(0, i - 1));
    } else if (isDownArrow(input, key)) {
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
      const types: (ExtensionType | 'all')[] = ['all', 'skill', 'agent', 'command'];
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
        update(ext, entry.sourceAgent || agent, entry.scope as 'global' | 'project').then(() => {
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
            await update(recordToExtension(entry), entry.sourceAgent || agent, entry.scope as 'global' | 'project');
          }
          await updateSelf();
          setStatus('Всё обновлено', 'success');
        } catch (err: unknown) {
          setStatus(`Ошибка обновления: ${String(err)}`, 'error');
        }
      })();
    } else if (ni === 'p' && hasUploadAccess && onOpenUpload) {
      onOpenUpload();
    }
  }, { isActive: inputActive !== false });

  // --- Двухэтапное удаление: 1) confirm → 2) выбор «удалить файлы с диска?» ---
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
      await remove(ext, entry.sourceAgent || agent, entry.scope as 'global' | 'project', deleteFromDisk);
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
          { key: 'd', description: 'удалить' },
          { key: 'u', description: 'обновить' },
          { key: 'U', description: 'обновить все' },
          ...(hasUploadAccess ? [{ key: 'p', description: 'загрузить в каталог' }] : []),
        ]
      : [
          { key: '↑↓', description: 'навигация' },
          { key: 'Enter', description: 'детали' },
          { key: 's', description: `scope: ${scopeFilter}` },
          { key: 'd', description: 'удалить' },
          { key: 'm', description: 'переместить' },
          { key: 'u', description: 'обновить' },
          { key: 'U', description: 'обновить все' },
          ...(hasUploadAccess ? [{ key: 'p', description: 'загрузить в каталог' }] : []),
        ];

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Search input (conventions mode only) */}
      {isConventions && (
        <SearchInput value={searchQuery} onChange={setSearchQuery} focused={searchFocused} />
      )}

      {/* Type filter bar (conventions mode only) */}
      {isConventions && (
        <FilterBar activeType={typeFilter} onTypeChange={setTypeFilter} compact={compact} />
      )}

      {/* Agent filter bar (conventions mode, global scope only) */}
      {isConventions && scopeFilter === 'global' && (
        <Box paddingX={1}>
          <Text color={theme.muted}>Агент </Text>
          <Text color={theme.warning}>[a]</Text>
          <Text color={theme.muted}>: </Text>
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
        <Text color={theme.warning}>[s]</Text>
        <Text color={theme.primary} bold>: </Text>
        <Text color={theme.muted}>
          {`[${scopeFilter === 'all' ? 'все' : scopeFilter}] ${filtered.length} шт.`}
        </Text>
      </Box>

      <Box flexDirection="column" flexGrow={1}>
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
              <Box minWidth={tableConfig ? tableConfig.selector.width : 2}><Text> </Text></Box>
              <Box minWidth={tableConfig ? tableConfig.type.width : 9}><Text dimColor>TYPE</Text></Box>
              <Box minWidth={tableConfig ? tableConfig.name.width : 22}><Text dimColor>NAME</Text></Box>
              <Box minWidth={tableConfig ? tableConfig.version.width : 8}><Text dimColor>VER</Text></Box>
              <Box minWidth={tableConfig ? tableConfig.scope.width : 8}><Text dimColor>SCOPE</Text></Box>
              {(tableConfig ? tableConfig.tags.visible : true) ? <Box minWidth={tableConfig ? tableConfig.tags.width : 16}><Text dimColor>TAGS</Text></Box> : null}
              {(tableConfig ? tableConfig.project.visible : true) ? <Box minWidth={tableConfig ? tableConfig.project.width : 12}><Text dimColor>PROJECT</Text></Box> : null}
              {(tableConfig ? tableConfig.source.visible : true) ? <Box minWidth={tableConfig ? tableConfig.source.width : 10}><Text dimColor>SOURCE</Text></Box> : null}
              <Text dimColor>AGENT</Text>
            </Box>
            {/* Separator */}
            <Box flexDirection="row">
              <Box minWidth={tableConfig ? tableConfig.selector.width : 2}><Text> </Text></Box>
              <Box minWidth={tableConfig ? tableConfig.type.width : 9}><Text dimColor>{'─'.repeat(tableConfig ? tableConfig.type.width - 2 : 8)}</Text></Box>
              <Box minWidth={tableConfig ? tableConfig.name.width : 22}><Text dimColor>{'─'.repeat(tableConfig ? tableConfig.name.width - 2 : 20)}</Text></Box>
              <Box minWidth={tableConfig ? tableConfig.version.width : 8}><Text dimColor>{'─'.repeat(tableConfig ? tableConfig.version.width - 2 : 6)}</Text></Box>
              <Box minWidth={tableConfig ? tableConfig.scope.width : 8}><Text dimColor>{'─'.repeat(tableConfig ? tableConfig.scope.width - 2 : 7)}</Text></Box>
              {(tableConfig ? tableConfig.tags.visible : true) ? <Box minWidth={tableConfig ? tableConfig.tags.width : 16}><Text dimColor>{'─'.repeat(tableConfig ? tableConfig.tags.width - 2 : 14)}</Text></Box> : null}
              {(tableConfig ? tableConfig.project.visible : true) ? <Box minWidth={tableConfig ? tableConfig.project.width : 12}><Text dimColor>{'─'.repeat(tableConfig ? tableConfig.project.width - 2 : 10)}</Text></Box> : null}
              {(tableConfig ? tableConfig.source.visible : true) ? <Box minWidth={tableConfig ? tableConfig.source.width : 10}><Text dimColor>{'─'.repeat(tableConfig ? tableConfig.source.width - 2 : 8)}</Text></Box> : null}
              <Text dimColor>{'────────'}</Text>
            </Box>
            {/* Rows */}
            {pageItems.map((entry, localIdx) => {
              const isSelected = pageStart + localIdx === safeIndex;
              const displayAgent = isConventions
                ? (entry.sourceAgent === 'agents-conventions' ? 'all agents' : (entry.sourceAgent || entry.agent))
                : (entry.agent === 'agents-conventions' ? 'all agents' : entry.agent);
              const tagsText = (entry.tags && entry.tags.length > 0) ? entry.tags.join(', ') : '—';
              const projectText = (entry.projects && entry.projects.length > 0)
                ? entry.projects[0] + (entry.projects.length > 1 ? '+' : '')
                : '—';
              return (
                <Box key={`${entry.type}:${entry.name}:${entry.scope}:${entry.sourceAgent || entry.agent}`} flexDirection="row">
                  <Box minWidth={tableConfig ? tableConfig.selector.width : 2}>
                    <Text color={isSelected ? theme.selected : theme.muted}>
                      {isSelected ? '▶' : ' '}
                    </Text>
                  </Box>
                  <Box minWidth={tableConfig ? tableConfig.type.width : 9}>
                    <Text color={theme.accent}>{truncate(entry.type, tableConfig ? tableConfig.type.truncateAt : 8)}</Text>
                  </Box>
                  <Box minWidth={tableConfig ? tableConfig.name.width : 22}>
                    <Text color={isSelected ? theme.selected : theme.secondary} bold={isSelected}>
                      {truncate(entry.name, tableConfig ? tableConfig.name.truncateAt : 20)}
                    </Text>
                  </Box>
                  <Box minWidth={tableConfig ? tableConfig.version.width : 8}>
                    <Text color={theme.muted}>{truncate(entry.version || '?', tableConfig ? tableConfig.version.truncateAt : 7)}</Text>
                  </Box>
                  <Box minWidth={tableConfig ? tableConfig.scope.width : 8}>
                    <Text color={entry.effectiveScope === 'global' ? theme.success : entry.effectiveScope === 'parent' ? theme.accent : theme.warning}>
                      {entry.effectiveScope}
                    </Text>
                  </Box>
                  {(tableConfig ? tableConfig.tags.visible : true) ? (
                    <Box minWidth={tableConfig ? tableConfig.tags.width : 16}>
                      <Text color={theme.muted} dimColor>{truncate(tagsText, tableConfig ? tableConfig.tags.truncateAt : 15)}</Text>
                    </Box>
                  ) : null}
                  {(tableConfig ? tableConfig.project.visible : true) ? (
                    <Box minWidth={tableConfig ? tableConfig.project.width : 12}>
                      <Text color={projectText === '—' ? theme.muted : theme.accent} dimColor={projectText === '—'}>
                        {truncate(projectText, tableConfig ? tableConfig.project.truncateAt : 11)}
                      </Text>
                    </Box>
                  ) : null}
                  {(tableConfig ? tableConfig.source.visible : true) ? (
                    <Box minWidth={tableConfig ? tableConfig.source.width : 10}>
                      <Text color={entry.source === 'manual' ? theme.muted : theme.accent}>
                        {entry.source}
                      </Text>
                    </Box>
                  ) : null}
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
      </Box>
      <HintBar hints={hints} maxWidth={termColumns} />
    </Box>
  );
};
