import { useState, useCallback } from 'react';
import { loadConfig, saveConfig, SkillHubConfig } from '../../config';

export function useSettings() {
  const [config, setConfig] = useState<SkillHubConfig>(() => loadConfig());

  const updateConfig = useCallback((updates: Partial<SkillHubConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...updates };
      saveConfig(next);
      return next;
    });
  }, []);

  return { config, updateConfig };
}
