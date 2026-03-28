import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { Extension, AgentName, ExtensionType } from '../../catalog';
import { useCatalog } from '../hooks/useCatalog';
import { useRegistry } from '../hooks/useRegistry';
import { useSettings } from '../hooks/useSettings';
import { useStatus } from '../contexts/StatusContext';
import { ExtensionList } from '../components/ExtensionList';
import { SearchInput } from '../components/SearchInput';
import { FilterBar } from '../components/FilterBar';
import { HintBar } from '../components/HintBar';
import type { Hint } from '../components/HintBar';

export interface CatalogScreenProps {
  agent: AgentName;
  onOpenDetail: (ext: Extension) => void;
}

export const CatalogScreen: React.FC<CatalogScreenProps> = ({ agent, onOpenDetail }) => {
  const { results, query, typeFilter, loading, error, setQuery, setTypeFilter } = useCatalog(agent);
  const { install, installed } = useRegistry();
  const { setStatus } = useStatus();
  const { config } = useSettings();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);

  // Сбрасываем selectedIndex если выходит за пределы
  useEffect(() => {
    if (results.length > 0 && selectedIndex >= results.length) {
      setSelectedIndex(Math.max(0, results.length - 1));
    }
  }, [results.length, selectedIndex]);

  const installedNames = useMemo(() => {
    return new Set<string>(installed.map(e => e.name));
  }, [installed]);

  useInput((input, key) => {
    if (searchFocused) {
      if (key.escape) {
        setSearchFocused(false);
      }
      return; // SearchInput сам обрабатывает ввод
    }

    if (input === '/') {
      setSearchFocused(true);
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

    if (input === 'i' && results[selectedIndex]) {
      const ext = results[selectedIndex];
      install(ext, agent, config.defaultScope).then(() => {
        setStatus(`Установлен: ${ext.name}`, 'success');
      }).catch((err: unknown) => {
        setStatus(String(err), 'error');
      });
      return;
    }

    if (input === 't') {
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
        <Box flexGrow={1} flexDirection="column">
          <ExtensionList
            extensions={results}
            selectedIndex={selectedIndex}
            installedNames={installedNames}
          />
        </Box>
      )}
      <HintBar hints={hints} />
    </Box>
  );
};
