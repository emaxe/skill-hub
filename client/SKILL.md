---
name: skillhub
description: "Use when the user invokes /skillhub or asks to search, install, remove, update, list skills, or initialize project with recommended skills. Triggers: '/skillhub', 'skillhub search', 'skillhub install', 'найди скилл', 'установи скилл', 'удали скилл', 'обнови скиллы', 'skillhub init'."
tags: [package-manager, skills, workflow]
author: maksimklisin
version: "1.0.0"
scope: global
platforms: [claude-code]
dependencies: []
language: any
---

# skillHub — Skill Package Manager

You are the skillHub client — a package manager for AI coding skills. You manage skills from the skillHub registry: search, install, remove, update, list, and recommend skills for projects.

**Cache repository:** `https://github.com/maksimklisin/skillHub.git`
**Cache location:** `~/.claude/skillhub/`
**Global skills:** `~/.claude/skills/{name}/`
**Project skills:** `.claude/skills/{name}/`
**Installation registry:** `~/.claude/skillhub/installed.json`

---

## Ensure Cache

Before any operation that reads the catalog, ensure the local cache exists:

```
if [ ! -d ~/.claude/skillhub ]; then
  git clone --depth 1 https://github.com/maksimklisin/skillHub.git ~/.claude/skillhub/
fi
```

Use Bash tool for this check. If the directory exists but is corrupted (no catalog.json), remove it and re-clone.

---

## Operations

### 1. `/skillhub search <query>`

Search the skill registry for skills matching a query.

**Steps:**

1. Ensure cache (see above).
2. Read `~/.claude/skillhub/catalog.json` using Read tool.
3. Apply search strategy in priority order:
   - **Exact tag match:** Check `tags_index` object — if `query` matches a tag key exactly, return all skills listed under that tag.
   - **Name contains:** Filter `skills` array where `name` contains the query (case-insensitive).
   - **Description contains:** Filter `skills` array where `description` contains the query (case-insensitive).
   - **Fuzzy match:** If no results from above, try partial/substring matches across name, description, and tags.
4. Display results as a formatted list:

```
Found N skill(s) for "<query>":

1. **skill-name** (v1.0.0) by author
   Description text here
   Tags: tag1, tag2, tag3 | Scope: global

2. ...
```

5. Ask the user: "Install any of these? Specify the name or number."

### 2. `/skillhub install <skill-name> [--global|--project]`

Install a skill from the registry.

**Steps:**

1. Ensure cache.
2. Read `~/.claude/skillhub/catalog.json`. Find the skill by `name` in the `skills` array. If not found, suggest running `/skillhub search`.
3. **Check dependencies:** Read the skill's `dependencies` array. For each dependency:
   - Check if it is already installed (exists in `~/.claude/skillhub/installed.json` or in the skill directories).
   - If missing, list all missing dependencies and ask the user: "This skill requires: dep1, dep2. Install them first?"
   - If user confirms, install each dependency recursively before proceeding.
4. **Determine scope:**
   - If `--global` flag is provided → global scope.
   - If `--project` flag is provided → project scope.
   - Otherwise, use the skill's `scope` field from catalog metadata.
   - If scope is `"both"`, ask the user which they prefer.
5. **Copy skill files:** The skill source is at `~/.claude/skillhub/skills/{name}/`. Copy the entire directory to the target:
   - **Global:** `~/.claude/skills/{name}/`
   - **Project:** `.claude/skills/{name}/` (relative to current working directory)

   Use Bash tool: `cp -r ~/.claude/skillhub/skills/{name}/ {target_path}`

   Create the target parent directory if it does not exist: `mkdir -p {target_parent}`
6. **Record installation:** Read or create `~/.claude/skillhub/installed.json`. Add an entry:

```json
{
  "installations": [
    {
      "name": "skill-name",
      "version": "1.0.0",
      "scope": "global",
      "installed_at": "2026-03-26T12:00:00Z",
      "path": "/absolute/path/to/installed/skill/"
    }
  ]
}
```

If the file does not exist, create it with the structure above. If it exists, append to the `installations` array. Use the current ISO-8601 timestamp. Use the absolute path to the installed skill directory.

7. Confirm to the user: "Installed **skill-name** v1.0.0 (global/project)."

### 3. `/skillhub remove <skill-name>`

Remove an installed skill.

**Steps:**

1. **Find the skill:** Read `~/.claude/skillhub/installed.json`. Find the entry by `name`. If not found there, scan `~/.claude/skills/*/SKILL.md` and `.claude/skills/*/SKILL.md` for a matching skill name in frontmatter.
2. **Check dependents:** Read `installed.json` and cross-reference — are any other installed skills listing this skill as a dependency? If yes, warn the user: "Warning: **other-skill** depends on **skill-name**. Removing it may break that skill. Continue?"
3. **Ask confirmation:** "Remove **skill-name** (scope)? This will delete the directory at {path}."
4. **Delete:** Use Bash tool: `rm -rf {path}`
5. **Update registry:** Remove the entry from `installed.json` and write the file back.
6. Confirm: "Removed **skill-name**."

### 4. `/skillhub list`

List all installed skills.

**Steps:**

1. **Scan directories:** Use Glob tool to find:
   - `~/.claude/skills/*/SKILL.md` (global skills)
   - `.claude/skills/*/SKILL.md` (project skills)
2. **Read frontmatter** from each found SKILL.md using Read tool. Extract: name, version, description, scope.
3. **Determine source:** If the skill name appears in `~/.claude/skillhub/installed.json`, source is `skillhub`. Otherwise, source is `manual`.
4. **Check for updates:** If cache exists (`~/.claude/skillhub/catalog.json`), compare installed version with catalog version. Mark skills that have available updates.
5. **Display as table:**

```
Installed skills:

| Name          | Version | Description              | Scope   | Source   | Update    |
|---------------|---------|--------------------------|---------|----------|-----------|
| git-commit    | 1.0.0   | Smart git commits        | global  | skillhub | 1.1.0 available |
| my-custom     | 0.1.0   | Custom workflow          | project | manual   | —         |
```

If no skills are found, suggest: "No skills installed. Try `/skillhub search` or `/skillhub init`."

### 5. `/skillhub update [skill-name]`

Update installed skills to latest versions.

**Steps:**

1. **Update cache:**
   ```bash
   cd ~/.claude/skillhub && git pull origin main --depth 1
   ```
   If pull fails (detached HEAD, conflicts, etc.), fall back to re-clone:
   ```bash
   rm -rf ~/.claude/skillhub && git clone --depth 1 https://github.com/maksimklisin/skillHub.git ~/.claude/skillhub/
   ```
2. **Compare versions:** Read `~/.claude/skillhub/catalog.json` and `~/.claude/skillhub/installed.json`. For each installed skill (or just the specified one), compare version strings.
3. **Show available updates:**

```
Available updates:

| Name       | Installed | Latest |
|------------|-----------|--------|
| skill-a    | 1.0.0     | 1.2.0  |
| skill-b    | 0.5.0     | 1.0.0  |
```

If a specific `skill-name` was provided, show only that skill.

4. **Apply updates:** Ask the user which skills to update (or confirm all). For each selected skill:
   - Check if local files at the installed path differ from the cache version (use `diff` command). If modified, warn: "Local modifications detected in **skill-name**. Overwrite?"
   - Copy updated files: `cp -r ~/.claude/skillhub/skills/{name}/ {installed_path}`
   - Update version in `installed.json`.
5. **Self-update check:** Compare `~/.claude/skillhub/client/SKILL.md` frontmatter version with the current skill version (1.0.0). If a newer version is available, offer: "A new version of the skillhub client is available (current: X, latest: Y). Update? This will overwrite the skillhub skill file."
   - If user confirms, copy `~/.claude/skillhub/client/SKILL.md` to where this skill is currently installed (global skills path).

### 6. `/skillhub init`

Analyze the current project and recommend skills from the registry.

**Steps:**

1. Ensure cache.
2. **Detect project stack** by scanning the current working directory for known files. Use Glob and Read tools. Detect tags from:

| File/Pattern | Check | Tags |
|---|---|---|
| `package.json` | exists; read `dependencies` + `devDependencies` for known frameworks | `javascript`, `typescript` (if has ts deps), `react`, `vue`, `nextjs`, `express`, `nestjs`, `svelte`, etc. |
| `tsconfig.json` | exists | `typescript` |
| `go.mod` | exists; read `require` block | `go`, `gin`, `echo`, etc. |
| `Cargo.toml` | exists | `rust` |
| `requirements.txt` | exists; read for `django`, `flask`, `fastapi`, etc. | `python`, `django`, `flask`, `fastapi` |
| `pyproject.toml` | exists; read dependencies | `python`, framework tags |
| `Dockerfile` or `docker-compose.yml` | exists | `docker` |
| `.github/workflows/*.yml` | exists | `ci-cd`, `github-actions` |
| `.eslintrc*` or `eslint.config.*` | exists | `eslint` |
| `jest.config.*` or `vitest.config.*` or `**/test/**` or `**/*.test.*` | exists | `testing` |
| `.prettierrc*` or `prettier.config.*` | exists | `formatting` |
| `tailwind.config.*` | exists | `tailwindcss` |
| `prisma/schema.prisma` | exists | `prisma`, `database` |
| `supabase/` | exists | `supabase` |

3. **Collect detected tags** into a list. Remove duplicates.
4. **Match against catalog:** Read `~/.claude/skillhub/catalog.json`. For each skill in the catalog, count how many of its `tags` overlap with the detected project tags.
5. **Rank and group:**
   - **Recommended (3+ tag matches):** Skills with 3 or more matching tags.
   - **Also relevant (1-2 matches):** Skills with 1-2 matching tags.
   - Exclude skills already installed.
6. **Display results:**

```
Project stack detected: javascript, typescript, react, nextjs, testing, eslint

Recommended skills (3+ matches):
  1. nextjs-dev (v1.0.0) — Next.js development patterns [matches: nextjs, react, typescript]
  2. react-testing (v1.2.0) — React testing best practices [matches: react, testing, typescript]

Also relevant:
  3. eslint-fixer (v0.5.0) — Auto-fix ESLint issues [matches: eslint]
  4. ts-strict (v1.0.0) — Strict TypeScript patterns [matches: typescript]

Already installed: git-commit
```

7. **Let user select:** "Enter numbers to install (e.g., 1, 2, 4) or 'all recommended'."
8. For each selected skill, run the install operation (step 2 above) with the scope from the skill's metadata.

---

## General Rules

- **Always use Bash tool** for git operations and file copying.
- **Always use Read tool** for reading files (catalog.json, installed.json, SKILL.md frontmatter).
- **Always use Write tool** for creating or updating files (installed.json).
- **Always use Glob tool** for scanning directories for files.
- **Format output** with markdown tables, bold skill names, and clear structure.
- **Respond in the user's language.** If the user writes in Russian, respond in Russian. If English, respond in English.
- **Be concise** but include all relevant information (name, version, description, scope).
- **Handle errors gracefully:** If network is unavailable, inform the user and suggest checking connectivity. If a skill is not found, suggest search. If catalog.json is missing, re-clone.
- **Never install without user confirmation** when dependencies are involved or when overwriting existing files.
- **Use ISO-8601 timestamps** (e.g., `2026-03-26T12:00:00Z`) when recording installation dates. Generate the current timestamp using: `date -u +"%Y-%m-%dT%H:%M:%SZ"`
