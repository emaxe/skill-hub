import fs from 'fs';
import path from 'path';
import { AgentName, ExtensionType } from './catalog';

export interface InstallRecord {
  type: ExtensionType;
  name: string;
  version: string;
  agent: AgentName;
  scope: 'global' | 'project' | 'parent';
  installed_at?: string;
  path: string;
}

export interface Registry {
  add(record: InstallRecord): void;
  remove(name: string, type: ExtensionType, agent: AgentName): void;
  isInstalled(name: string, type: ExtensionType, agent: AgentName): boolean;
  list(agent?: AgentName, type?: ExtensionType): InstallRecord[];
  get(name: string, type: ExtensionType, agent: AgentName): InstallRecord | undefined;
}

export function createRegistry(registryDir: string): Registry {
  const registryPath = path.join(registryDir, 'installed.json');

  function load(): { version: number; installations: InstallRecord[] } {
    if (!fs.existsSync(registryPath)) {
      return { version: 3, installations: [] };
    }
    const raw = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    const installations = (raw.installations || []).map((r: InstallRecord) => ({
      ...r,
      agent: r.agent || 'claude-code',
    }));
    return { version: 3, installations };
  }

  function save(data: { version: number; installations: InstallRecord[] }): void {
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    fs.writeFileSync(registryPath, JSON.stringify(data, null, 2));
  }

  return {
    add(record: InstallRecord) {
      const data = load();
      data.installations = data.installations.filter(
        r => !(r.name === record.name && r.type === record.type && r.agent === record.agent)
      );
      data.installations.push({ ...record, installed_at: new Date().toISOString() });
      save(data);
    },
    remove(name, type, agent) {
      const data = load();
      data.installations = data.installations.filter(
        r => !(r.name === name && r.type === type && r.agent === agent)
      );
      save(data);
    },
    isInstalled(name, type, agent) {
      return load().installations.some(r => r.name === name && r.type === type && r.agent === agent);
    },
    list(agent?, type?) {
      let items = load().installations;
      if (agent) items = items.filter(r => r.agent === agent);
      if (type) items = items.filter(r => r.type === type);
      return items;
    },
    get(name, type, agent) {
      return load().installations.find(r => r.name === name && r.type === type && r.agent === agent);
    },
  };
}
