import fs from 'fs';
import os from 'os';
import path from 'path';
import { Extension } from './catalog';

const API_BASE = 'https://skills.sh/api';
const SKILLSSH_PREFIX = 'skillssh:';

export function isSkillsshRef(name: string): boolean {
  return name.startsWith(SKILLSSH_PREFIX);
}

export function parseSkillsshRef(name: string): { source?: string; slug?: string } {
  const rest = name.slice(SKILLSSH_PREFIX.length);
  if (rest.includes('@')) {
    const [source, slug] = rest.split('@');
    return { source, slug };
  }
  if (rest.includes('/')) {
    return { source: rest };
  }
  return { slug: rest };
}

export function writeSkillsshFilesToTmp(
  download: { files: { path: string; contents: string }[] },
  slug: string
): string {
  const tmpDir = path.join(os.homedir(), '.skill-hub', 'tmp', `skillssh-${slug}-${Date.now()}`);
  for (const file of download.files) {
    const filePath = path.join(tmpDir, file.path);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, file.contents, 'utf-8');
  }
  return tmpDir;
}

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

export interface SkillsshSearchResponse {
  skills: SkillsshSearchResult[];
  count: number;
}

function normalizeSkillsshResult(skill: SkillsshSearchResult): SkillsshSearchResult {
  const prefix = `${skill.source}/`;
  const id = skill.id.startsWith(prefix) ? skill.id.slice(prefix.length) : skill.id;
  return { ...skill, id };
}

export async function searchSkillsshWithMeta(query: string, limit = 10): Promise<SkillsshSearchResponse> {
  const url = `${API_BASE}/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`skills.sh search failed: ${res.status}`);
  const data = (await res.json()) as { skills?: SkillsshSearchResult[]; count?: number };
  const skills = (data.skills || []).map(normalizeSkillsshResult);
  return { skills, count: typeof data.count === 'number' ? data.count : skills.length };
}

export async function searchSkillssh(query: string, limit = 10): Promise<SkillsshSearchResult[]> {
  const data = await searchSkillsshWithMeta(query, limit);
  return data.skills;
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
    path: 'SKILL.md',
    dependencies: [],
    projects: [],
    source: { type: 'skillssh', uri: `skillssh:${skill.source}@${skill.id}` },
  };
}
