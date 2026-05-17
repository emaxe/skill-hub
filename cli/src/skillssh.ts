import { Extension } from './catalog';

const API_BASE = 'https://skills.sh/api';

export interface SkillsshSearchResult {
  id: string;
  name: string;
  description: string;
  source: string; // owner/repo
  installs: number;
}

export interface SkillsshFile {
  path: string;
  contents: string;
}

export interface SkillsshDownload {
  files: SkillsshFile[];
  hash: string;
}

export async function searchSkillssh(query: string, limit = 10): Promise<SkillsshSearchResult[]> {
  const url = `${API_BASE}/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`skills.sh search failed: ${res.status}`);
  const data = (await res.json()) as { skills?: SkillsshSearchResult[] };
  return data.skills || [];
}

export async function downloadSkillssh(source: string, slug: string): Promise<SkillsshDownload> {
  const parts = source.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid source format: ${source}, expected owner/repo`);
  }
  const [owner, repo] = parts;
  const url = `${API_BASE}/download/${owner}/${repo}/${slug}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`skills.sh download failed: ${res.status}`);
  return (await res.json()) as SkillsshDownload;
}

export function skillsshToExtension(skill: SkillsshSearchResult, hash: string): Extension {
  return {
    type: 'skill',
    name: skill.id,
    description: skill.description || '',
    tags: [],
    author: skill.source.split('/')[0],
    version: hash,
    scope: 'both',
    platforms: {
      'claude-code': 'SKILL.md',
      cursor: 'SKILL.md',
      copilot: 'SKILL.md',
      codex: 'SKILL.md',
      'agents-conventions': 'SKILL.md',
    },
    path: `skills/${skill.id}/SKILL.md`,
    dependencies: [],
    projects: [],
    source: { type: 'skillssh', uri: `skillssh:${skill.source}@${skill.id}` },
  };
}
