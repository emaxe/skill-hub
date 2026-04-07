import { AgentName, Extension, ExtensionType } from '../catalog';

export interface ScanResult {
  type: ExtensionType;
  name: string;
  scope: 'global' | 'project' | 'parent';
  path: string;
}

export interface AgentAdapter {
  agentName: AgentName;
  supportsType(type: ExtensionType): boolean;
  getSourceFile(ext: Extension): string;
  getInstallPath(ext: Extension, scope: 'global' | 'project'): string;
  install(ext: Extension, scope: 'global' | 'project', cachePath: string): Promise<void>;
  remove(ext: Extension, scope: 'global' | 'project'): Promise<void>;
  isInstalled(ext: Extension, scope: 'global' | 'project'): boolean;
  scanInstalled(): ScanResult[];
}
