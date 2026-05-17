/**
 * Unified extension manager — install / remove / move / update с lifecycle hooks.
 * Используется из CLI, TUI и MCP для единообразного выполнения hook-фаз.
 */

import path from 'path';
import { AgentName, Extension } from './catalog';
import { getAdapter } from './adapters/get-adapter';
import { createRegistry } from './registry';
import { getCachePath } from './git';
import {
  hasProjectConfig,
  addProjectExtension,
  removeProjectExtension,
} from './config';
import { execLifecycleHook } from './hooks-engine';

/** Разрешает и устанавливает зависимости расширения */
export async function installDependencies(
  ext: Extension,
  agent: AgentName,
  scope: 'global' | 'project',
  registryDir: string,
  sourcePath?: string,
): Promise<void> {
  if (!ext.dependencies || ext.dependencies.length === 0) return;

  const { loadCatalog } = await import('./catalog');
  const catalog = loadCatalog(getCachePath());

  for (const depRaw of ext.dependencies) {
    const [depType, depName] = depRaw.includes(':')
      ? depRaw.split(':') as [string, string]
      : ['skill', depRaw];

    const depExt = catalog.extensions.find(
      e => e.name === depName && e.type === depType
    );
    if (!depExt) {
      throw new Error(`Зависимость не найдена в каталоге: ${depRaw}`);
    }

    const reg = createRegistry(registryDir);
    if (!reg.isInstalled(depExt.name, depExt.type, agent)) {
      await installExtension(depExt, agent, scope, registryDir, sourcePath);
    }
  }
}

/** Установить расширение с lifecycle hooks */
export async function installExtension(
  ext: Extension,
  agent: AgentName,
  scope: 'global' | 'project',
  registryDir: string,
  sourcePath?: string,
): Promise<void> {
  const adapter = getAdapter(agent);
  const cachePath = sourcePath || getCachePath();
  const reg = createRegistry(registryDir);

  const installPath = adapter.getInstallPath(ext, scope);

  execLifecycleHook({
    ext,
    scope,
    cachePath,
    installPath,
    phase: 'pre-install',
  });

  await adapter.install(ext, scope, cachePath);

  if (adapter.supportsRuntimeHooks) {
    await adapter.installHooks(ext, scope, cachePath);
  }

  execLifecycleHook({
    ext,
    scope,
    cachePath,
    installPath,
    phase: 'post-install',
  });

  reg.add({
    type: ext.type,
    name: ext.name,
    version: ext.version || '0.0.0',
    agent,
    scope,
    path: installPath,
    projects: ext.projects.length > 0 ? ext.projects : undefined,
    tags: ext.tags.length > 0 ? ext.tags : undefined,
    hooks: ext.hooks,
    source: ext.source?.uri,
  });

  if (hasProjectConfig()) {
    addProjectExtension({ type: ext.type, name: ext.name, version: ext.version, scope, source: ext.source?.uri });
  }
}

/** Удалить расширение с lifecycle hooks */
export async function removeExtension(
  ext: Extension,
  agent: AgentName,
  scope: 'global' | 'project',
  registryDir: string,
  deleteFromDisk: boolean = true,
): Promise<void> {
  const adapter = getAdapter(agent);
  const cachePath = getCachePath();
  const reg = createRegistry(registryDir);

  if (deleteFromDisk) {
    const installPath = adapter.getInstallPath(ext, scope);

    execLifecycleHook({
      ext,
      scope,
      cachePath,
      installPath,
      phase: 'pre-remove',
    });

    await adapter.removeHooks(ext, scope);
    await adapter.remove(ext, scope);

    execLifecycleHook({
      ext,
      scope,
      cachePath,
      installPath,
      phase: 'post-remove',
    });
  }

  reg.remove(ext.name, ext.type, agent);

  if (hasProjectConfig()) {
    removeProjectExtension(ext.name, ext.type);
  }
}

/** Переместить расширение из одного scope в другой */
export async function moveExtension(
  ext: Extension,
  agent: AgentName,
  fromScope: 'global' | 'project',
  registryDir: string,
): Promise<void> {
  const toScope = fromScope === 'global' ? 'project' : 'global';
  await installExtension(ext, agent, toScope, registryDir);
  await removeExtension(ext, agent, fromScope, registryDir, true);
}

/** Обновить расширение (переустановить файлы) */
export async function updateExtension(
  ext: Extension,
  agent: AgentName,
  scope: 'global' | 'project',
  registryDir: string,
): Promise<void> {
  await installExtension(ext, agent, scope, registryDir);
}
