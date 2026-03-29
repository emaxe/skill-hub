import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { normalizeInput } from '../keymap';
import { Extension, AgentName, ExtensionType } from '../../catalog';
import { InstalledEntry } from '../hooks/useRegistry';
import { useCatalog } from '../hooks/useCatalog';
import { useStatus } from '../contexts/StatusContext';
import { ExtensionList } from '../components/ExtensionList';
import { SearchInput } from '../components/SearchInput';
import { FilterBar } from '../components/FilterBar';
import { HintBar } from '../components/HintBar';
import type { Hint } from '../components/HintBar';

export interface CatalogScreenProps {
  agent: AgentName;
  onOpenDetail: (ext: Extension) => void;
  onSearchFocusChange?: (focused: boolean) => void;
  install: (ext: Extension, agent: AgentName, scope: 'global' | 'project') => Promise<void>;
  installed: InstalledEntry[];
  defaultScope: 'global' | 'project';
}

const PAGE_SIZE = 10;

export const CatalogScreen: React.FC<CatalogScreenProps> = ({
  agent, onOpenDetail, onSearchFocusChange, install, installed, defaultScope,
}) => {
  const { results, query, typeFilter, loading, error, setQuery, setTypeFilter } = useCatalog(agent);
  const { setStatus } = useStatus();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    if (results.length > 0 && selectedIndex >= results.length) {
      setSelectedIndex(Math.max(0, results.length - 1));
    }
  }, [results.length, selectedIndex]);

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.floor(selectedIndex / PAGE_SIZE);
  const pageStart = currentPage * PAGE_SIZE;
  const pageItems = results.slice(pageStart, pageStart + PAGE_SIZE);
  const localIndex = selectedIndex - pageStart;

  const installedNames = useMemo(() => {
    return new Set<string>(installed.map(e => e.name));
  }, [installed]);

  const installedScopes = useMemo(() => {
    const map = new Map<string, 'global' | 'project'>();
    for (const e of installed) {
      map.set(`${e.type}:${e.name}`, e.scope);
    }
    return map;
  }, [installed]);

  const setSearch = (focused: boolean) => {
    setSearchFocused(focused);
    onSearchFocusChange?.(focused);
  };

  useInput((input, key) => {
    if (searchFocused) {
      if (key.escape || key.return) {
        setSearch(false);
      }
      return;
    }

    const ni = normalizeInput(input);

    if (ni === '/') {
      setSearch(true);
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex(i => Math.min(results.length - 1, i + 1));
      return;
    }

    if (key.return && results[selectedIndex]) {
      onOpenDetail(results[selectedIndex]);
      return;
    }

    if (ni === 'i' && results[selectedIndex]) {
      const ext = results[selectedIndex];
      install(ext, agent, defaultScope).then(() => {
        setStatus(`Установлен: ${ext.name}`, 'success');
      }).catch((err: unknown) => {
        setStatus(String(err), 'error');
      });
      return;
    }

    if (ni === 't') {
      const types: (ExtensionType | 'all')[] = ['all', 'skill', 'agent', 'command'];
      const idx = types.indexOf(typeFilter);
      setTypeFilter(types[(idx + 1) % types.length]);
    }
  });

  const hints: Hint[] = searchFocused
    ? [{ key: 'Esc', description: 'закрыть поиск' }]
    : [
        { key: '/', description: 'поиск' },
        { key: '↑↓', description: 'навигация' },
        { key: 'Enter', description: 'детали' },
        { key: 'i', description: 'установить' },
        { key: 't', description: 'фильтр типа' },
      ];

  return (
    <Box flexDirection="column" flexGrow={1}>
      <SearchInput value={query} onChange={setQuery} focused={searchFocused} />
      <FilterBar activeType={typeFilter} onTypeChange={setTypeFilter} />
      {loading ? (
        <Box paddingX={2}>
          <Text dimColor>Загрузка каталога...</Text>
        </Box>
      ) : error ? (
        <Box paddingX={2}>
          <Text color="red">{error}</Text>
        </Box>
      ) : (
        <Box flexGrow={1} flexDirection="column" marginTop={1} marginBottom={1}>
          <ExtensionList
            extensions={pageItems}
            selectedIndex={localIndex}
            installedNames={installedNames}
            installedScopes={installedScopes}
          />
          {totalPages > 1 && (
            <Box paddingX={1} marginTop={1}>
              <Text dimColor>{`Стр. ${currentPage + 1} из ${totalPages}  (${results.length} шт.)`}</Text>
            </Box>
          )}
        </Box>
      )}
      <HintBar hints={hints} />
    </Box>
  );
};
