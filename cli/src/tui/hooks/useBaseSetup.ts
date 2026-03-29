import { useState, useEffect, useCallback, useRef } from 'react';
import { AgentName } from '../../catalog';
import {
  SetupStatus,
  checkSetupStatus,
  installMcp,
  installBaseSkill,
  updateSelf,
} from '../../base-setup';

export type InstallState = 'idle' | 'loading' | 'success' | 'error';

export interface UseBaseSetupResult {
  status: SetupStatus | null;
  checking: boolean;
  mcpInstallState: InstallState;
  baseSkillInstallState: InstallState;
  updateSelfState: InstallState;
  doInstallMcp: () => Promise<void>;
  doInstallBaseSkill: () => Promise<void>;
  doUpdateSelf: () => Promise<void>;
}

export function useBaseSetup(agent: AgentName): UseBaseSetupResult {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [mcpInstallState, setMcpInstallState] = useState<InstallState>('idle');
  const [baseSkillInstallState, setBaseSkillInstallState] = useState<InstallState>('idle');
  const [updateSelfState, setUpdateSelfState] = useState<InstallState>('idle');
  const [recheckKey, setRecheckKey] = useState(0);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    setStatus(null);
    setMcpInstallState('idle');
    setBaseSkillInstallState('idle');
    setUpdateSelfState('idle');
    checkSetupStatus(agent).then(result => {
      if (cancelled || !mountedRef.current) return;
      setStatus(result);
      setChecking(false);
    });
    return () => { cancelled = true; };
  }, [agent, recheckKey]);

  const recheck = useCallback(() => setRecheckKey(k => k + 1), []);

  const doInstallMcp = useCallback(async () => {
    setMcpInstallState('loading');
    try {
      await installMcp(agent);
      if (!mountedRef.current) return;
      setMcpInstallState('success');
      recheck();
    } catch {
      if (!mountedRef.current) return;
      setMcpInstallState('error');
    }
  }, [agent, recheck]);

  const doInstallBaseSkill = useCallback(async () => {
    setBaseSkillInstallState('loading');
    try {
      await installBaseSkill(agent);
      if (!mountedRef.current) return;
      setBaseSkillInstallState('success');
      recheck();
    } catch {
      if (!mountedRef.current) return;
      setBaseSkillInstallState('error');
    }
  }, [agent, recheck]);

  const doUpdateSelf = useCallback(async () => {
    setUpdateSelfState('loading');
    try {
      await updateSelf(agent);
      if (!mountedRef.current) return;
      setUpdateSelfState('success');
      recheck();
    } catch {
      if (!mountedRef.current) return;
      setUpdateSelfState('error');
    }
  }, [agent, recheck]);

  return {
    status,
    checking,
    mcpInstallState,
    baseSkillInstallState,
    updateSelfState,
    doInstallMcp,
    doInstallBaseSkill,
    doUpdateSelf,
  };
}
