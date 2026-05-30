import { useState, useEffect, useCallback, useRef } from 'react';
import { Extension } from '../../catalog';
import { searchSkillsshWithMeta, SkillsshSearchResult } from '../../skillssh';

export interface UseSkillsshSearchState {
  results: Extension[];
  query: string;
  loading: boolean;
  error: string | null;
}

export interface UseSkillsshSearchActions {
  setQuery: (q: string) => void;
  reload: () => void;
}

function searchResultToExtension(skill: SkillsshSearchResult): Extension {
  return {
    type: 'skill',
    name: skill.id,
    description: skill.description || '',
    tags: [],
    author: skill.source.split('/')[0],
    scope: 'both',
    platforms: {
      'claude-code': 'SKILL.md',
      cursor: 'SKILL.md',
      copilot: 'SKILL.md',
      codex: 'SKILL.md',
      'agents-conventions': 'SKILL.md',
    },
    path: 'SKILL.md',
    dependencies: [],
    projects: [],
    source: { type: 'skillssh', uri: `skillssh:${skill.source}@${skill.id}` },
  };
}

export function useSkillsshSearch(): UseSkillsshSearchState & UseSkillsshSearchActions {
  const [query, setQueryRaw] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Debounce query
  const setQuery = useCallback((q: string) => {
    setQueryRaw(q);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedQuery(q), 300);
  }, []);

  // Search effect
  useEffect(() => {
    let cancelled = false;
    setResults([]);
    setError(null);

    const q = debouncedQuery.trim();
    if (!q) {
      setLoading(false);
      return;
    }

    setLoading(true);
    searchSkillsshWithMeta(q, 20)
      .then(data => {
        if (cancelled) return;
        setResults(data.skills.map(searchResultToExtension));
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [debouncedQuery, reloadKey]);

  const reload = useCallback(() => setReloadKey(k => k + 1), []);

  return {
    results,
    query,
    loading,
    error,
    setQuery,
    reload,
  };
}
