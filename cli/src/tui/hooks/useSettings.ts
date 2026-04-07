import { useState, useCallback } from 'react';
import { resolveConfig, saveResolvedConfig, initProjectConfig, findProjectRoot, SkillHubConfig, ConfigSource, saveGlobalFromProject, resetProjectToGlobal } from '../../config';

export function useSettings() {
  const [resolved] = useState(() => resolveConfig());
  const [config, setConfig] = useState<SkillHubConfig>(() => resolved.config);
  const [source, setSource] = useState<ConfigSource>(() => resolved.source);
  const [projectRoot] = useState<string | null>(() => resolved.projectRoot);
  const hasProjectRoot = projectRoot !== null;

  const updateConfig = useCallback((updates: Partial<SkillHubConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...updates };
      saveResolvedConfig(next, source, projectRoot);
      return next;
    });
  }, [source, projectRoot]);

  const doSaveAsGlobal = useCallback((): boolean => {
    return saveGlobalFromProject();
  }, []);

  const doResetToGlobal = useCallback((): SkillHubConfig | null => {
    const ok = resetProjectToGlobal();
    if (ok) {
      const { config: fresh } = resolveConfig();
      setConfig(fresh);
      return fresh;
    }
    return null;
  }, []);

  const doCreateProjectConfig = useCallback((): boolean => {
    const ok = initProjectConfig();
    if (ok) {
      setSource('project');
    }
    return ok;
  }, []);

  return { config, updateConfig, source, projectRoot, hasProjectRoot, doSaveAsGlobal, doResetToGlobal, doCreateProjectConfig };
}
