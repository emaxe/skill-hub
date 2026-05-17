// --- Реестр установленных расширений (installed.json) ---

import fs from 'fs';
import path from 'path';
import { AgentName, ExtensionType } from './catalog';

/** Запись об установленном расширении — хранится в installed.json */
export interface InstallRecord {
  type: ExtensionType;
  name: string;
  version: string;
  agent: AgentName;
  scope: 'global' | 'project' | 'parent';
  installed_at?: string;
  path: string;
  /** Привязка к проектам (копируется из каталога при установке) */
  projects?: string[];
  /** Теги расширения (копируются из каталога при установке) */
  tags?: string[];
  /** Источник установки (например, 'skillssh:owner/repo@slug') */
  source?: string;
}

/** CRUD-интерфейс для работы с реестром установленных расширений */
export interface Registry {
  add(record: InstallRecord): void;
  remove(name: string, type: ExtensionType, agent: AgentName): void;
  isInstalled(name: string, type: ExtensionType, agent: AgentName): boolean;
  list(agent?: AgentName, type?: ExtensionType): InstallRecord[];
  get(name: string, type: ExtensionType, agent: AgentName): InstallRecord | undefined;
}

/** Фабрика для работы с реестром — читает/пишет installed.json в указанной директории */
export function createRegistry(registryDir: string): Registry {
  const registryPath = path.join(registryDir, 'installed.json');

  function load(): { version: number; installations: InstallRecord[] } {
    if (!fs.existsSync(registryPath)) {
      return { version: 3, installations: [] };
    }
    try {
      const raw = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
      const installations = (raw.installations || []).map((r: InstallRecord) => ({
        ...r,
        agent: r.agent || 'claude-code',
      }));
      return { version: 3, installations };
    } catch (err) {
      // Backup повреждённого файла, чтобы пользователь мог восстановить данные вручную
      const backupPath = registryPath + '.backup.' + Date.now();
      try { fs.copyFileSync(registryPath, backupPath); } catch {}
      console.warn(`⚠️ Реестр повреждён, создан backup: ${backupPath}`);
      return { version: 3, installations: [] };
    }
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
