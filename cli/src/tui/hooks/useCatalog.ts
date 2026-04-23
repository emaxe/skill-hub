import { useState, useEffect, useCallback, useRef } from 'react';
import { Catalog, Extension, AgentName, ExtensionType, loadCatalog, searchExtensions } from '../../catalog';
import { getCachePath, ensureCache, isCloned } from '../../git';

export interface UseCatalogState {
  catalog: Catalog | null;
  results: Extension[];
  query: string;
  typeFilter: ExtensionType | 'all';
  loading: boolean;
  error: string | null;
}

export interface UseCatalogActions {
  setQuery: (q: string) => void;
  setTypeFilter: (type: ExtensionType | 'all') => void;
  reload: () => void;
}

export function useCatalog(agent?: AgentName, project?: string | null): UseCatalogState & UseCatalogActions {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [query, setQueryRaw] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ExtensionType | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Загрузка каталога (при необходимости — clone/pull)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const cachePath = getCachePath();

    const load = async () => {
      // Если кеш ещё не загружен — скачать
      if (!isCloned(cachePath)) {
        await ensureCache(cachePath);
      }
      if (cancelled) return;
      const cat = loadCatalog(cachePath);
      setCatalog(cat);
    };

    load()
      .catch(err => { if (!cancelled) setError(String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [reloadKey]);

  // Debounce поиска
  const setQuery = useCallback((q: string) => {
    setQueryRaw(q);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedQuery(q), 300);
  }, []);

  // Результаты поиска
  const results = catalog
    ? searchExtensions(
        catalog,
        debouncedQuery,
        agent,
        typeFilter === 'all' ? undefined : typeFilter,
        project
      )
    : [];

  const reload = useCallback(() => setReloadKey(k => k + 1), []);

  return {
    catalog,
    results,
    query,
    typeFilter,
    loading,
    error,
    setQuery,
    setTypeFilter,
    reload,
  };
}
