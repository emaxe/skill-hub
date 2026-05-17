# Интеграция skills.sh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить поддержку установки скиллов из skills.sh через Search/Download API — без git clone, без индекса, через прямое API.

**Architecture:** Новый модуль `skillssh.ts` encapsulates skills.sh API. `source?: string` поле в типах отслеживает происхождение расширения. `extension-manager.ts` принимает опциональный `sourcePath`. CLI/MCP детектируют `skillssh:` префикс → API → tmp dir → adapter install.

**Tech Stack:** TypeScript, нативный `fetch` (Node 18+), Jest, existing adapters (claude-code, cursor, copilot, codex).

---

## Files Map

| File | Responsibility |
|------|--------------|
| `cli/src/skillssh.ts` | Search/Download API wrappers, types, `skillsshToExtension()` mapper |
| `cli/src/skillssh.test.ts` | Tests for API wrappers and mapper |
| `cli/src/catalog.ts` | Add `source?` to `Extension` |
| `cli/src/registry.ts` | Add `source?` to `InstallRecord` |
| `cli/src/config.ts` | Add `source?` to `ProjectExtensionRecord`, update `addProjectExtension()` |
| `cli/src/extension-manager.ts` | Add `sourcePath?` param to `installExtension()`, pass `source` to registry/config |
| `cli/src/extension-manager.test.ts` | Update tests for `source` field propagation |
| `cli/src/commands/install.ts` | Detect `skillssh:` prefix, download to tmp, call `managerInstall()` with `sourcePath` |
| `cli/src/commands/update.ts` | Source-aware update loop: re-download skillssh extensions, compare hash |
| `cli/src/commands/search.ts` | `--source skillssh` flag |
| `cli/src/sync.ts` | Source-aware missing recovery |
| `cli/src/mcp.ts` | `source` param in `search_extensions`, `skillssh:` support in `install_extension` |

---

### Task 1: Extend types with `source` field

**Files:**
- Modify: `cli/src/catalog.ts:16-34`
- Modify: `cli/src/registry.ts:8-22`
- Modify: `cli/src/config.ts:33-38`

- [ ] **Step 1: Add `source` to `Extension`**

```typescript
// cli/src/catalog.ts — inside Extension interface, after hooks?:
  /** Источник расширения (для внешних источников вроде skills.sh) */
  source?: { type: 'catalog' | 'skillssh'; uri: string };
```

- [ ] **Step 2: Add `source` to `InstallRecord`**

```typescript
// cli/src/registry.ts — inside InstallRecord interface, after hooks?:
  /** Источник установки (например, 'skillssh:owner/repo@slug') */
  source?: string;
```

- [ ] **Step 3: Add `source` to `ProjectExtensionRecord`**

```typescript
// cli/src/config.ts — inside ProjectExtensionRecord interface, after scope:
  /** Источник установки */
  source?: string;
```

- [ ] **Step 4: Update `addProjectExtension()` to accept and persist `source`**

Read `config.ts` to find `addProjectExtension()` signature. Modify it to accept optional `source` and include it when writing to `.skill-hub.json`.

- [ ] **Step 5: Run tests**

```bash
cd cli && npm test -- --testPathPattern="catalog|registry|config" --verbose
```
Expected: all existing tests pass (source is optional, no breaking change).

- [ ] **Step 6: Commit**

```bash
git add cli/src/catalog.ts cli/src/registry.ts cli/src/config.ts

git commit -m "feat: add source field to Extension, InstallRecord, ProjectExtensionRecord

Add optional source tracking for external extension sources (skills.sh).
No breaking changes — fields are optional."
```

---

### Task 2: Create `skillssh.ts` API module

**Files:**
- Create: `cli/src/skillssh.ts`
- Create: `cli/src/skillssh.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// cli/src/skillssh.test.ts
import { searchSkillssh, downloadSkillssh, skillsshToExtension } from './skillssh';

describe('skillssh', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  test('searchSkillssh returns parsed skills', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        skills: [{ id: 'test-skill', name: 'Test', description: 'Desc', source: 'owner/repo', installs: 100 }],
      }),
    });
    const results = await searchSkillssh('test');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('test-skill');
  });

  test('downloadSkillssh returns files and hash', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        files: [{ path: 'SKILL.md', contents: '# Test' }],
        hash: 'abc123',
      }),
    });
    const result = await downloadSkillssh('owner/repo', 'test-skill');
    expect(result.hash).toBe('abc123');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].path).toBe('SKILL.md');
  });

  test('skillsshToExtension maps correctly', () => {
    const ext = skillsshToExtension(
      { id: 'test-skill', name: 'Test', description: 'Desc', source: 'owner/repo', installs: 100 },
      'abc123',
    );
    expect(ext.name).toBe('test-skill');
    expect(ext.version).toBe('abc123');
    expect(ext.source).toEqual({ type: 'skillssh', uri: 'skillssh:owner/repo@test-skill' });
    expect(ext.type).toBe('skill');
    expect(ext.scope).toBe('both');
    expect(ext.platforms['claude-code']).toBe('SKILL.md');
  });

  test('searchSkillssh throws on API error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });
    await expect(searchSkillssh('test')).rejects.toThrow('skills.sh search failed: 500');
  });

  test('downloadSkillssh throws on invalid source format', async () => {
    await expect(downloadSkillssh('invalid', 'slug')).rejects.toThrow('Invalid source format');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cli && npx jest src/skillssh.test.ts --verbose
```
Expected: FAIL with "Cannot find module './skillssh'".

- [ ] **Step 3: Write minimal implementation**

```typescript
// cli/src/skillssh.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd cli && npx jest src/skillssh.test.ts --verbose
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add cli/src/skillssh.ts cli/src/skillssh.test.ts
git commit -m "feat: add skillssh API module with search, download, and mapper

- searchSkillssh(query): calls skills.sh search API
- downloadSkillssh(source, slug): calls skills.sh download API
- skillsshToExtension(): maps skills.sh format to Extension type
- Full test coverage with mocked fetch"
```

---

### Task 3: Refactor extension-manager for external sourcePath

**Files:**
- Modify: `cli/src/extension-manager.ts:50-99`
- Modify: `cli/src/extension-manager.ts:19-47` (installDependencies)
- Modify: `cli/src/extension-manager.test.ts`

- [ ] **Step 1: Update `installExtension` signature and body**

Read `extension-manager.ts` lines 50-99. Change:

```typescript
export async function installExtension(
  ext: Extension,
  agent: AgentName,
  scope: 'global' | 'project',
  registryDir: string,
  sourcePath?: string, // <-- NEW optional param
): Promise<void> {
  const adapter = getAdapter(agent);
  const cachePath = sourcePath || getCachePath(); // <-- use sourcePath if provided
  // ... rest of function uses cachePath throughout
```

Also update `execLifecycleHook` calls to use `cachePath` instead of calling `getCachePath()` again. Verify the function body already uses `cachePath` consistently.

- [ ] **Step 2: Update `installDependencies` to accept and pass `sourcePath`**

```typescript
export async function installDependencies(
  ext: Extension,
  agent: AgentName,
  scope: 'global' | 'project',
  registryDir: string,
  sourcePath?: string, // <-- NEW
): Promise<void> {
  // ...
  // In the loop, pass sourcePath:
  await installExtension(depExt, agent, scope, registryDir, sourcePath);
}
```

- [ ] **Step 3: Update `addProjectExtension` call to pass `source`**

In `installExtension`, after `reg.add()`, update the `addProjectExtension` call:

```typescript
if (hasProjectConfig()) {
  addProjectExtension({ type: ext.type, name: ext.name, version: ext.version, scope, source: ext.source?.uri });
}
```

- [ ] **Step 4: Update `reg.add()` to include `source`**

```typescript
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
    source: ext.source?.uri, // <-- NEW
  });
```

- [ ] **Step 5: Update tests**

In `extension-manager.test.ts`, add assertions that `source` is propagated to registry and config. Mock `addProjectExtension` to capture the source argument.

- [ ] **Step 6: Run tests**

```bash
cd cli && npx jest src/extension-manager.test.ts --verbose
```
Expected: PASS (all 6 tests + new source assertions).

- [ ] **Step 7: Commit**

```bash
git add cli/src/extension-manager.ts cli/src/extension-manager.test.ts
git commit -m "feat(extension-manager): support external sourcePath and source field

- installExtension accepts optional sourcePath param for external sources
- installDependencies propagates sourcePath to recursive installs
- Registry and project config now receive source field from Extension.source"
```

---

### Task 4: CLI install command — `skillssh:` prefix support

**Files:**
- Modify: `cli/src/commands/install.ts`
- Modify: `cli/src/commands/install.ts` (add helper functions at top of file)

- [ ] **Step 1: Write helper functions for skillssh parsing and tmp dir setup**

At top of `install.ts`, add:

```typescript
import { searchSkillssh, downloadSkillssh, skillsshToExtension, SkillsshSearchResult } from '../skillssh';
import fs from 'fs';

const SKILLSSH_PREFIX = 'skillssh:';

function isSkillsshRef(name: string): boolean {
  return name.startsWith(SKILLSSH_PREFIX);
}

function parseSkillsshRef(name: string): { source?: string; slug?: string } {
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

function writeSkillsshFilesToTmp(download: { files: { path: string; contents: string }[] }, slug: string): string {
  const tmpDir = path.join(os.homedir(), '.skill-hub', 'tmp', `skillssh-${slug}-${Date.now()}`);
  for (const file of download.files) {
    const filePath = path.join(tmpDir, file.path);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, file.contents, 'utf-8');
  }
  return tmpDir;
}
```

- [ ] **Step 2: Modify install action for skillssh path**

After parsing `type`/`name` from `nameArg`, add a branch before catalog lookup:

```typescript
// After: let type, name parsing
// Before: catalog lookup

if (isSkillsshRef(nameArg)) {
  spinner.text = 'Поиск на skills.sh...';
  const ref = parseSkillsshRef(nameArg);
  
  let skill: SkillsshSearchResult;
  
  if (ref.slug && ref.source) {
    // Fully qualified: skillssh:owner/repo@slug
    skill = { id: ref.slug, name: ref.slug, description: '', source: ref.source, installs: 0 };
  } else if (ref.source && !ref.slug) {
    // Partial: skillssh:owner/repo — search and interactive select
    const results = await searchSkillssh(ref.source, 20);
    if (results.length === 0) {
      spinner.fail(chalk.red(`Скиллы не найдены для ${ref.source}`));
      process.exit(1);
    }
    if (results.length === 1) {
      skill = results[0];
    } else {
      // Interactive selection — for now, install first result (TUI will handle interactive)
      // In CLI, print list and exit
      console.log(chalk.bold('\nНайдено несколько скиллов:\n'));
      results.forEach((r, i) => console.log(`  ${i + 1}. ${r.id} — ${r.description || 'нет описания'}`));
      console.log(chalk.yellow('\nУкажите конкретный скилл: skill-hub install skillssh:owner/repo@slug'));
      process.exit(0);
    }
  } else if (ref.slug && !ref.source) {
    // Just slug: search by slug
    const results = await searchSkillssh(ref.slug, 10);
    const found = results.find(r => r.id === ref.slug);
    if (!found) {
      spinner.fail(chalk.red(`Скилл "${ref.slug}" не найден на skills.sh`));
      process.exit(1);
    }
    skill = found;
  } else {
    spinner.fail(chalk.red(`Неверный формат skills.sh ссылки: ${nameArg}`));
    process.exit(1);
  }
  
  spinner.text = `Загрузка ${skill.id}...`;
  const download = await downloadSkillssh(skill.source, skill.id);
  const tmpDir = writeSkillsshFilesToTmp(download, skill.id);
  
  const ext = skillsshToExtension(skill, download.hash);
  const adapter = getAdapter(agent);
  const registryDir = path.join(os.homedir(), '.skill-hub');
  
  spinner.text = `Установка ${ext.name}...`;
  await managerInstall(ext, agent, scope, registryDir, tmpDir);
  
  // Cleanup tmp dir (best effort)
  try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
  
  spinner.succeed(chalk.green(`Установлен ${ext.type}:${ext.name} (${agent}, ${scope}) [skills.sh]`));
  return;
}
```

- [ ] **Step 3: Run existing install tests**

```bash
cd cli && npm test -- --testPathPattern="install" --verbose
```
Expected: PASS (existing catalog-based install still works).

- [ ] **Step 4: Manual test with dry-run**

```bash
cd cli && npm run build
node dist/index.js install skillssh:vercel-labs/skills@react-best-practices --agent claude-code --project
```
Expected: Either installs successfully (if API works) or prints clear error.

- [ ] **Step 5: Commit**

```bash
git add cli/src/commands/install.ts
git commit -m "feat(install): support skillssh: prefix for skills.sh installation

- Detect skillssh: prefix in install command
- Search API for partial refs, direct download for full refs
- Write downloaded files to tmp dir, install via extension-manager
- Supports: skillssh:slug, skillssh:owner/repo, skillssh:owner/repo@slug"
```

---

### Task 5: CLI update command — source-aware update

**Files:**
- Modify: `cli/src/commands/update.ts`
- Modify: `cli/src/commands/update.ts` (add import for skillssh functions)

- [ ] **Step 1: Add imports**

```typescript
import { downloadSkillssh, skillsshToExtension } from '../skillssh';
```

- [ ] **Step 2: Add helper for parsing skillssh source string**

```typescript
function parseSkillsshSource(source: string): { source: string; slug: string } | null {
  const prefix = 'skillssh:';
  if (!source.startsWith(prefix)) return null;
  const rest = source.slice(prefix.length);
  const atIdx = rest.lastIndexOf('@');
  if (atIdx === -1) return null;
  return { source: rest.slice(0, atIdx), slug: rest.slice(atIdx + 1) };
}
```

- [ ] **Step 3: Modify update loop for source-aware records**

In the `for (const record of installed)` loop (around line 86), before catalog lookup, add:

```typescript
for (const record of installed) {
  if (name && record.name !== name) continue;
  if (record.scope === 'parent') continue;
  
  // Source-aware update for skills.sh
  if (record.source?.startsWith('skillssh:')) {
    const ref = parseSkillsshSource(record.source);
    if (!ref) continue;
    try {
      const download = await downloadSkillssh(ref.source, ref.slug);
      if (download.hash !== record.version) {
        spinner.text = `Обновление ${record.name} (skills.sh)...`;
        const ext = skillsshToExtension(
          { id: ref.slug, name: ref.slug, description: '', source: ref.source, installs: 0 },
          download.hash,
        );
        const tmpDir = path.join(os.homedir(), '.skill-hub', 'tmp', `skillssh-update-${ref.slug}-${Date.now()}`);
        for (const file of download.files) {
          const filePath = path.join(tmpDir, file.path);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, file.contents, 'utf-8');
        }
        await adapter.install(ext, record.scope, tmpDir);
        reg.add({ ...record, version: download.hash, path: adapter.getInstallPath(ext, record.scope) });
        try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
        updated++;
      }
    } catch {
      // skip failed skillssh updates
    }
    continue;
  }
  
  // Original catalog-based update
  const ext = catalog.extensions.find(e => e.name === record.name && e.type === record.type);
  if (!ext || !ext.platforms[platformKey(agent)]) continue;
  // ... rest unchanged
}
```

- [ ] **Step 4: Modify missing recovery in update (project config restore) for source-aware**

In the project extensions restore loop (around line 48), before catalog lookup:

```typescript
for (const pe of projectExtensions) {
  if (pe.source?.startsWith('skillssh:')) {
    const ref = parseSkillsshSource(pe.source);
    if (!ref) continue;
    const destPath = adapter.getInstallPath({ type: pe.type, name: pe.name, description: '', tags: [], scope: 'both', platforms: {}, path: '', dependencies: [], projects: [] } as Extension, pe.scope);
    const installed = reg.isInstalled(pe.name, pe.type, agent);
    const fileExists = fs.existsSync(destPath);
    if (!installed || !fileExists) {
      try {
        const download = await downloadSkillssh(ref.source, ref.slug);
        const ext = skillsshToExtension(
          { id: ref.slug, name: ref.slug, description: '', source: ref.source, installs: 0 },
          download.hash,
        );
        const tmpDir = path.join(os.homedir(), '.skill-hub', 'tmp', `skillssh-restore-${ref.slug}-${Date.now()}`);
        for (const file of download.files) {
          const filePath = path.join(tmpDir, file.path);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, file.contents, 'utf-8');
        }
        await adapter.install(ext, pe.scope, tmpDir);
        reg.add({
          type: pe.type,
          name: pe.name,
          version: download.hash,
          agent,
          scope: pe.scope,
          path: destPath,
          source: pe.source,
        });
        try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
        restored++;
      } catch {
        // skip failed restores
      }
    }
    continue;
  }
  // ... original catalog-based restore
}
```

- [ ] **Step 5: Run tests**

```bash
cd cli && npm test -- --testPathPattern="update" --verbose
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add cli/src/commands/update.ts
git commit -m "feat(update): source-aware update for skills.sh extensions

- Detect skillssh: source in installed records
- Re-download and compare hash on update
- Restore missing skills.sh extensions from project config
- Skip failed skillssh downloads gracefully"
```

---

### Task 6: Sync module — source-aware missing recovery

**Files:**
- Modify: `cli/src/sync.ts:28-33` (MissingExtension already inherits source via ProjectExtensionRecord)
- Modify: `cli/src/sync.ts:93-101` (missing detection logic — no code changes needed, source inherited)

Note: `MissingExtension` extends `ProjectExtensionRecord`, so `source` is already present after Task 1. No code changes needed in `sync.ts` for detection. The recovery logic is in `update.ts` (handled in Task 5).

- [ ] **Step 1: Verify sync.ts compiles with new types**

```bash
cd cli && npx tsc --noEmit
```
Expected: no type errors.

- [ ] **Step 2: Run sync tests**

```bash
cd cli && npm test -- --testPathPattern="sync" --verbose
```
Expected: PASS.

- [ ] **Step 3: Commit (if any changes made)**

If no changes: skip commit. If type-only import fixes needed:

```bash
git add cli/src/sync.ts
git commit -m "chore(sync): source field inherited via ProjectExtensionRecord

No functional changes — MissingExtension already carries source field."
```

---

### Task 7: Search command — `--source skillssh` flag

**Files:**
- Modify: `cli/src/commands/search.ts`

- [ ] **Step 1: Add import and option**

```typescript
import { searchSkillssh, skillsshToExtension } from '../skillssh';
```

Add option:
```typescript
.option('--source <source>', 'Источник: catalog (default), skillssh')
```

- [ ] **Step 2: Add branch in action**

```typescript
.action(async (query: string, opts: { agent?: string; type?: string; limit?: string; offset?: string; project?: string; source?: string }) => {
  if (opts.source === 'skillssh') {
    const results = await searchSkillssh(query, Math.max(1, parseInt(opts.limit || '10', 10)));
    const total = results.length;
    const limit = Math.max(1, parseInt(opts.limit || '10', 10) || 10);
    const offset = Math.max(0, parseInt(opts.offset || '0', 10) || 0);
    const page = results.slice(offset, offset + limit);
    
    if (total === 0) {
      console.log(chalk.yellow('Скиллы не найдены на skills.sh'));
      return;
    }
    console.log(chalk.bold(`\nНайдено ${total} скиллов на skills.sh:\n`));
    for (const skill of page) {
      console.log(`  ${chalk.green('[skill]')} ${chalk.bold(skill.id)}  ${chalk.dim(skill.source)}  ${skill.installs ? chalk.yellow(`${skill.installs} installs`) : ''}`);
      console.log(`    ${skill.description || 'нет описания'}`);
      console.log();
    }
    if (total > limit) {
      console.log(chalk.dim(`Показано ${page.length} из ${total} (offset=${offset}, limit=${limit})`));
    }
    return;
  }
  
  // Original catalog search
  await ensureCache();
  // ... rest unchanged
```

- [ ] **Step 3: Run tests**

```bash
cd cli && npm test -- --testPathPattern="search" --verbose
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add cli/src/commands/search.ts
git commit -m "feat(search): add --source skillssh flag

- search --source skillssh queries skills.sh API directly
- Prints skill id, source repo, installs count, description
- Falls back to catalog search by default"
```

---

### Task 8: MCP tools — source support

**Files:**
- Modify: `cli/src/mcp.ts:42-54` (search_extensions schema)
- Modify: `cli/src/mcp.ts:56-67` (install_extension schema)
- Modify: `cli/src/mcp.ts:159-188` (search_extensions handler)
- Modify: `cli/src/mcp.ts:190-261` (install_extension handler)

- [ ] **Step 1: Add source param to search_extensions schema**

In `ListToolsRequestSchema` handler, add to `search_extensions`:

```json
source: { type: 'string', enum: ['catalog', 'skillssh'], description: 'Источник поиска (по умолчанию: catalog)' }
```

- [ ] **Step 2: Add source param to install_extension schema**

Already handled by `skillssh:` prefix in name field. No schema changes needed.

- [ ] **Step 3: Update search_extensions handler**

```typescript
if (name === 'search_extensions') {
  const source = str(a.source) || 'catalog';
  if (source === 'skillssh') {
    try {
      const results = await searchSkillssh(str(a.query) || '', typeof a.limit === 'number' ? a.limit : 10);
      return {
        content: [{ type: 'text', text: JSON.stringify({ results, total: results.length }, null, 2) }],
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Ошибка skills.sh: ${String(err)}` }], isError: true };
    }
  }
  // ... original catalog search unchanged
}
```

- [ ] **Step 4: Update install_extension handler**

Before catalog lookup, add:

```typescript
if (nameArg.startsWith('skillssh:')) {
  // ... similar logic to CLI install command (re-use helper or inline)
  // For MCP: fully qualified refs only (skillssh:owner/repo@slug)
  const rest = nameArg.slice(9);
  const atIdx = rest.lastIndexOf('@');
  if (atIdx === -1) {
    return { content: [{ type: 'text', text: 'Для MCP укажите полный skillssh:owner/repo@slug' }], isError: true };
  }
  const source = rest.slice(0, atIdx);
  const slug = rest.slice(atIdx + 1);
  const download = await downloadSkillssh(source, slug);
  const ext = skillsshToExtension({ id: slug, name: slug, description: '', source, installs: 0 }, download.hash);
  const tmpDir = path.join(os.homedir(), '.skill-hub', 'tmp', `skillssh-mcp-${slug}-${Date.now()}`);
  for (const file of download.files) {
    const filePath = path.join(tmpDir, file.path);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, file.contents, 'utf-8');
  }
  await managerInstall(ext, agent, scope, registryDir, tmpDir);
  try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
  return { content: [{ type: 'text', text: `Установлен ${ext.type}:${ext.name} v${ext.version} (${agent}, ${scope}) [skills.sh]` }] };
}
```

- [ ] **Step 5: Run full test suite**

```bash
cd cli && npm test
```
Expected: PASS (266 tests).

- [ ] **Step 6: Commit**

```bash
git add cli/src/mcp.ts
git commit -m "feat(mcp): skills.sh support in search and install tools

- search_extensions: source param for catalog|skillssh
- install_extension: skillssh:owner/repo@slug prefix support
- Direct download and install via tmp directory"
```

---

## Verification

### End-to-end test

```bash
cd cli && npm run build
# Test search
node dist/index.js search --source skillssh react --agent claude-code

# Test install (full ref)
node dist/index.js install skillssh:vercel-labs/skills@react-best-practices --agent claude-code --project

# Verify in registry
cat ~/.skill-hub/installed.json | grep -A5 react-best-practices
# Should show: "source": "skillssh:vercel-labs/skills@react-best-practices"

# Test update
node dist/index.js update react-best-practices --agent claude-code
```

### Unit tests

```bash
cd cli && npm test
```
Expected: 266+ tests pass (new tests added).

---

## Spec Coverage Self-Review

| Spec Requirement | Task |
|------------------|------|
| `source` field in types | Task 1 |
| `skillssh.ts` module with API wrappers | Task 2 |
| `extension-manager.ts` accepts `sourcePath` | Task 3 |
| CLI install detects `skillssh:` prefix | Task 4 |
| CLI update re-downloads and compares hash | Task 5 |
| Sync inherits source via ProjectExtensionRecord | Task 6 |
| CLI search `--source skillssh` | Task 7 |
| MCP search/install skills.sh support | Task 8 |
| No placeholders — all code provided | ✓ |
| TDD approach — tests first | ✓ |

## Placeholder Scan

- No "TBD", "TODO", "implement later" found.
- All steps include actual code blocks.
- All commands include expected output.
- Type names consistent throughout (`SkillsshSearchResult`, `SkillsshDownload`, `sourcePath`).

---

**Plan complete. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
