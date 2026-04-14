import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import chalk from 'chalk';
import { resolveConfig } from './config';

const AGENT_BINARIES: Record<string, string> = {
  'claude-code': 'claude',
  'cursor':      'agent',
  'copilot':     'copilot',
};

/** Псевдонимы агентов: короткое имя → каноническое */
const AGENT_ALIASES: Record<string, string> = {
  'claude': 'claude-code',
  'agent':  'cursor',
};

export const KNOWN_AGENTS = Object.keys(AGENT_BINARIES);

export type LaunchMode = 'exec' | 'script';

/**
 * Подготовить env с настройками прокси для агента.
 * Возвращает [env, proxyUrl | null].
 */
function prepareEnv(agentName: string): [NodeJS.ProcessEnv, string | null] {
  const { config } = resolveConfig();
  const aiAgents = config.aiAgents;
  const agentCfg = aiAgents.agents[agentName as keyof typeof aiAgents.agents];

  const env = { ...process.env };
  let proxyUrl: string | null = null;

  if (agentCfg?.useProxy && aiAgents.proxy) {
    proxyUrl = aiAgents.proxy;
    env.http_proxy  = proxyUrl;
    env.https_proxy = proxyUrl;
    env.all_proxy   = proxyUrl;
  }

  return [env, proxyUrl];
}

/**
 * Запуск через shell exec — заменяет shell-процесс на бинарник агента.
 * В ps виден только агент, не node.
 */
function launchExec(binary: string, extraArgs: string[], env: NodeJS.ProcessEnv): never {
  const result = spawnSync('sh', ['-c', 'exec "$0" "$@"', binary, ...extraArgs], {
    stdio: 'inherit',
    env,
  });

  process.exit(result.status ?? 1);
}

/**
 * Запуск через временный shell-скрипт с export env + exec.
 * Скрипт самоудаляется после запуска. Полезно для отладки.
 */
function launchScript(binary: string, extraArgs: string[], env: NodeJS.ProcessEnv, proxyUrl: string | null): never {
  const scriptName = `skill-hub-launch-${process.pid}.sh`;
  const scriptPath = path.join(os.tmpdir(), scriptName);

  const lines: string[] = ['#!/bin/sh'];

  // Самоудаление скрипта при выходе
  lines.push(`trap 'rm -f "$0"' EXIT`);

  if (proxyUrl) {
    lines.push(`export http_proxy="${proxyUrl}"`);
    lines.push(`export https_proxy="${proxyUrl}"`);
    lines.push(`export all_proxy="${proxyUrl}"`);
  }

  // exec заменяет процесс shell на агент
  lines.push(`exec "${binary}" "$@"`);

  fs.writeFileSync(scriptPath, lines.join('\n') + '\n', { mode: 0o755 });

  console.log(chalk.gray(`Скрипт: ${scriptPath}`));

  const result = spawnSync('sh', [scriptPath, ...extraArgs], {
    stdio: 'inherit',
    env,
  });

  // На случай если скрипт не смог самоудалиться
  try { fs.unlinkSync(scriptPath); } catch {}

  process.exit(result.status ?? 1);
}

/**
 * Запустить AI-агент с настройками прокси.
 * @param mode 'exec' — shell exec (по умолчанию), 'script' — через temp-скрипт
 */
export function launchAgent(agentName: string, extraArgs: string[], mode: LaunchMode = 'exec'): void {
  const resolved = AGENT_ALIASES[agentName] ?? agentName;
  const binary = AGENT_BINARIES[resolved];
  if (!binary) {
    console.error(chalk.red(`Неизвестный агент: ${agentName}`));
    const aliases = Object.entries(AGENT_ALIASES).map(([a, b]) => `${a}=${b}`).join(', ');
    console.error(`Допустимые: ${KNOWN_AGENTS.join(', ')} (псевдонимы: ${aliases})`);
    process.exit(1);
  }

  const [env, proxyUrl] = prepareEnv(resolved);

  if (proxyUrl) {
    console.log(chalk.cyan(`Прокси: ${proxyUrl}`));
  }

  const cmdLine = extraArgs.length > 0
    ? `${binary} ${extraArgs.join(' ')}`
    : binary;
  console.log(chalk.gray(`Запуск: ${cmdLine}`));

  if (mode === 'script') {
    launchScript(binary, extraArgs, env, proxyUrl);
  } else {
    launchExec(binary, extraArgs, env);
  }
}
