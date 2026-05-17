/**
 * Выполнение lifecycle hooks (pre-install, post-install, pre-remove, post-remove)
 * для всех агентов.
 *
 * Hook-скрипт всегда ищется в srcDir (кеш), fallback в destDir (установленная копия).
 * Переменные окружения SKILL_HUB_HOOK_PHASE, SKILL_HUB_EXTENSION_NAME,
 * SKILL_HUB_INSTALL_DIR доступны скрипту.
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Extension, ExtensionHooks } from './catalog';
import { isWindows } from './platform';
import { getExtensionDirRel } from './multi-file';

export type HookPhase = 'pre-install' | 'post-install' | 'pre-remove' | 'post-remove';

export interface LifecycleHookContext {
  ext: Extension;
  scope: 'global' | 'project';
  cachePath: string;
  installPath: string;
  phase: HookPhase;
}

/** Возвращает имя hook-файла для фазы */
function getHookFile(hooks: ExtensionHooks | undefined, phase: HookPhase): string | undefined {
  if (!hooks) return undefined;
  switch (phase) {
    case 'pre-install': return hooks.preInstall;
    case 'post-install': return hooks.postInstall;
    case 'pre-remove': return hooks.preRemove;
    case 'post-remove': return hooks.postRemove;
  }
}

/** Выполняет lifecycle hook. Pre-hooks бросают ошибку при fail. Post-hooks — warning. */
export function execLifecycleHook(ctx: LifecycleHookContext): void {
  const hookFile = getHookFile(ctx.ext.hooks, ctx.phase);
  if (!hookFile) return;

  const srcDir = path.join(ctx.cachePath, getExtensionDirRel(ctx.ext.path));
  const destDir = path.dirname(ctx.installPath);

  // Ищем скрипт: сначала в destDir, fallback в srcDir
  let cwd = destDir;
  let scriptPath = path.resolve(cwd, hookFile);
  if (!fs.existsSync(scriptPath)) {
    cwd = srcDir;
    scriptPath = path.resolve(cwd, hookFile);
  }

  if (!fs.existsSync(scriptPath)) {
    const msg = `Hook script not found: ${hookFile} (looked in ${destDir} and ${srcDir})`;
    if (ctx.phase.startsWith('pre-')) {
      throw new Error(msg);
    }
    console.warn(`⚠️ ${msg}`);
    return;
  }

  const result = isWindows
    ? spawnSync(scriptPath, [], {
        cwd,
        stdio: 'pipe',
        shell: true,
        env: {
          ...process.env,
          SKILL_HUB_HOOK_PHASE: ctx.phase,
          SKILL_HUB_EXTENSION_NAME: ctx.ext.name,
          SKILL_HUB_INSTALL_DIR: destDir,
        },
      })
    : spawnSync('sh', [scriptPath], {
        cwd,
        stdio: 'pipe',
        env: {
          ...process.env,
          SKILL_HUB_HOOK_PHASE: ctx.phase,
          SKILL_HUB_EXTENSION_NAME: ctx.ext.name,
          SKILL_HUB_INSTALL_DIR: destDir,
        },
      });

  if (result.status !== 0) {
    const stderr = result.stderr?.toString() || '';
    const msg = `Hook ${ctx.phase} failed for ${ctx.ext.name}: exit ${result.status}${stderr ? '\n' + stderr : ''}`;
    if (ctx.phase.startsWith('pre-')) {
      throw new Error(msg);
    }
    console.warn(`⚠️ ${msg}`);
  }
}
