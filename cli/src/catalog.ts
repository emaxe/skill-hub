import fs from 'fs';
import path from 'path';

export type AgentName = 'claude-code' | 'cursor' | 'copilot';
export type ExtensionType = 'skill' | 'agent' | 'command' | 'rule';

export interface Extension {
  type: ExtensionType;
  name: string;
  description: string;
  tags: string[];
  author?: string;
  version?: string;
  scope: 'global' | 'project' | 'both';
  platforms: Partial<Record<AgentName, string | null>>;
  path: string;
  dependencies: string[];
  model?: string;
  color?: string;
}

export interface Catalog {
  version: number;
  generated_at: string;
  counts: Record<string, number>;
  extensions: Extension[];
}

export function parseExtension(raw: unknown): Extension {
  const r = raw as Record<string, unknown>;
  let platforms: Partial<Record<AgentName, string | null>> = {};
  if (Array.isArray(r.platforms)) {
    const type = (r.type as string) === 'agent' ? 'AGENT.md'
      : (r.type as string) === 'command' ? 'COMMAND.md' : 'SKILL.md';
    for (const p of r.platforms as string[]) {
      platforms[p as AgentName] = type;
    }
  } else if (r.platforms && typeof r.platforms === 'object') {
    platforms = r.platforms as Partial<Record<AgentName, string | null>>;
  } else {
    const type = (r.type as string) === 'agent' ? 'AGENT.md'
      : (r.type as string) === 'command' ? 'COMMAND.md' : 'SKILL.md';
    platforms = { 'claude-code': type };
  }

  return {
    type: r.type as ExtensionType,
    name: r.name as string,
    description: r.description as string,
    tags: (r.tags as string[]) || [],
    author: r.author as string | undefined,
    version: r.version as string | undefined,
    scope: (r.scope as Extension['scope']) || 'global',
    platforms,
    path: r.path as string,
    dependencies: (r.dependencies as string[]) || [],
    model: r.model as string | undefined,
    color: r.color as string | undefined,
  };
}

export function filterByAgent(extensions: Extension[], agent: AgentName): Extension[] {
  return extensions.filter(ext => {
    const file = ext.platforms[agent];
    return file != null && file !== '';
  });
}

export function loadCatalog(cachePath: string): Catalog {
  const catalogPath = path.join(cachePath, 'catalog.json');
  if (!fs.existsSync(catalogPath)) {
    throw new Error(`Catalog not found at ${catalogPath}. Run: skill-hub update`);
  }
  const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
  return {
    ...raw,
    extensions: (raw.extensions || raw.skills || []).map(parseExtension),
  };
}

export function searchExtensions(
  catalog: Catalog,
  query: string,
  agent?: AgentName,
  type?: ExtensionType
): Extension[] {
  const q = query.toLowerCase();
  let results = catalog.extensions;
  if (agent) results = filterByAgent(results, agent);
  if (type) results = results.filter(e => e.type === type);
  if (q) results = results.filter(e =>
    e.name.includes(q) || e.description.toLowerCase().includes(q) ||
    e.tags.some(t => t.includes(q))
  );
  return results;
}

export interface ScoredExtension {
  extension: Extension;
  score: number;
  matchReasons: string[];
}

export function scoreExtensions(extensions: Extension[], context: string): ScoredExtension[] {
  const STOP_WORDS = new Set([
    'the','a','an','is','are','in','on','at','to','for','of','and','or',
    'with','this','that','it','be','as','from','by','not',
    'но','и','в','на','с','для','по','из','не','что','это','как',
  ]);

  const tokens = context.toLowerCase()
    .split(/\W+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
  const tokenSet = new Set(tokens);
  const scored: ScoredExtension[] = [];

  for (const ext of extensions) {
    let score = 0;
    const reasons: string[] = [];

    const nameTokens = ext.name.toLowerCase().split(/[-_\s]+/);
    // Имя: точное совпадение токена x3
    for (const nt of nameTokens) {
      if (tokenSet.has(nt)) {
        score += 3;
        reasons.push(`name:${nt}`);
      }
    }
    // Имя: частичное x2
    for (const token of tokenSet) {
      if (ext.name.toLowerCase().includes(token) && !reasons.some(r => r === `name:${token}`)) {
        score += 2;
        reasons.push(`name~${token}`);
      }
    }

    // Теги: точное x2, частичное x1
    for (const tag of ext.tags.map(t => t.toLowerCase())) {
      if (tokenSet.has(tag)) {
        score += 2;
        reasons.push(`tag:${tag}`);
      } else {
        for (const token of tokenSet) {
          if (tag.includes(token) && !reasons.some(r => r === `tag~${token}` || r === `tag:${token}`)) {
            score += 1;
            reasons.push(`tag~${token}`);
          }
        }
      }
    }

    // Описание: x1
    const descTokens = ext.description.toLowerCase().split(/\W+/).filter(t => t.length > 2);
    for (const dt of descTokens) {
      if (tokenSet.has(dt) && !reasons.some(r => r.endsWith(`:${dt}`))) {
        score += 1;
        reasons.push(`desc:${dt}`);
      }
    }

    if (score > 0) {
      scored.push({ extension: ext, score, matchReasons: [...new Set(reasons)] });
    }
  }

  return scored.sort(
    (a, b) => b.score - a.score || a.extension.name.localeCompare(b.extension.name)
  );
}
