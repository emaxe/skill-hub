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
