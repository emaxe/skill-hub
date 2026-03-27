# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Skill-Hub is an open-source extension manager for Claude Code. It provides a central repository of reusable extensions — **skills** (SKILL.md), **agents** (AGENT.md), and **commands** (COMMAND.md) — that extend AI coding assistant capabilities. Users install the client skill (`client/SKILL.md`) and use `/skill-hub` commands to search, install, and manage extensions.

## Key Commands

```bash
# Generate catalog.json from all extensions' frontmatter
bash scripts/generate-catalog.sh

# Test a skill locally
mkdir -p ~/.claude/skills/<skill-name>
cp skills/<skill-name>/SKILL.md ~/.claude/skills/<skill-name>/SKILL.md

# Test an agent locally
cp agents/<agent-name>/AGENT.md ~/.claude/agents/<agent-name>.md

# Test a command locally
mkdir -p .claude/commands
cp commands/<command-name>/COMMAND.md .claude/commands/<command-name>.md
```

There is also a CLI package in `cli/` (published as `skill-hub` on npm) providing CLI commands and an MCP server for AI agents.

```bash
# Local CLI development — build, link globally, test without npm publish
bash scripts/dev-link.sh            # build + npm link
skill-hub search git                # test any command
bash scripts/dev-link.sh unlink     # remove global link
```

No build tools, linters, or test suites outside of `cli/` — the repository itself is pure Markdown + shell scripts.

## Architecture

### Extension Types

| Type | Source file | Install target (global) | Install target (project) |
|------|-----------|------------------------|--------------------------|
| Skill | `skills/{name}/SKILL.md` | `~/.claude/skills/{name}/` | `.claude/skills/{name}/` |
| Agent | `agents/{name}/AGENT.md` | `~/.claude/agents/{name}.md` | `.claude/agents/{name}.md` |
| Command | `commands/{name}/COMMAND.md` | — | `.claude/commands/{name}.md` |

### Delivery Flow

**Via CLI (recommended):**
1. `npm install -g @emaxe/skill-hub` — install the CLI
2. `skill-hub setup-mcp --agent claude-code` — configure MCP server
3. CLI handles clone, install, update automatically via `~/.claude/skill-hub/` cache

**Manual:**
1. User clones repo to `~/.claude/skill-hub/` (local cache)
2. Install = copy extension to target scope directory (agents/commands: single file renamed to `{name}.md`)
3. Update = `git pull` in cache, re-copy installed extensions

### Scope Directories

- **Global:** `~/.claude/skills/{name}/SKILL.md`, `~/.claude/agents/{name}.md`
- **Project:** `./.claude/skills/{name}/SKILL.md`, `.claude/agents/{name}.md`, `.claude/commands/{name}.md`

### Extension Structure

Each extension lives in `{type}/{name}/{TYPE}.md` with YAML frontmatter (between `---` delimiters):

- **Required fields (all types):** `name` (kebab-case, must match directory name), `description` (min 10 chars)
- **Skill optional fields:** `tags`, `author`, `version`, `scope` (global/project/both), `platforms`, `dependencies` (format: `type:name`), `language`
- **Agent additional fields:** `model`, `color`
- **Command scope:** `project` or `both` only (no global)
- Schemas: `schema/frontmatter.schema.json`, `schema/agent-frontmatter.schema.json`, `schema/command-frontmatter.schema.json`

### Multi-Platform Files

Extensions can include platform-specific variants alongside the primary file:

| File | Purpose |
|------|---------|
| `SKILL.md` / `AGENT.md` / `COMMAND.md` | Primary file for Claude Code |
| `CURSOR.md` | Cursor IDE variant (optional) |
| `COPILOT.md` | GitHub Copilot variant (optional) |

`generate-catalog.sh` auto-detects these files and populates the `platforms` object in catalog.json:
```json
"platforms": {"claude-code": "SKILL.md", "cursor": "CURSOR.md", "copilot": null}
```

### catalog.json

Auto-generated index of all extensions (v3 format). Contains:
- `version`: 3
- `extensions` array with `type` field on each entry, `platforms` as object (not array), `files` listing all files in the extension directory
- `counts` object with per-type (`skill`, `agent`, `command`) and `total` counts
- `tags_index` with `type:name` references
- Backward-compatible `skills` array and `skills_count` (v2 compat)

Rebuilt by `scripts/generate-catalog.sh`. On GitHub, automated via `.github/workflows/catalog.yml` on push to main when `skills/**`, `agents/**`, or `commands/**` changes.

### CI Validation

`.github/workflows/validate.yml` runs on PRs touching `skills/**`, `agents/**`, or `commands/**`:
- Detects extension type from filename (SKILL.md, AGENT.md, COMMAND.md)
- Checks frontmatter conforms to type-specific schema
- Validates `name` matches directory name
- Checks required fields, file size (<100KB), secret detection
- Validates command scope (project/both only)
- Warns on unknown tags (known tags listed in `docs/TAG-TAXONOMY.md`)

### Client Skill

`client/SKILL.md` is the bootstrap skill — installed to global skills, it guides users through CLI installation (`npm install -g @emaxe/skill-hub`) and MCP server setup. After setup, the CLI/MCP handles `/skill-hub search|install|remove|list|update|init` with `type:name` syntax, manages `~/.claude/skill-hub/installed.json` registry, and supports dependency resolution.

### CLI Package

`cli/` contains the TypeScript source for the `skill-hub` npm package. Provides:
- CLI commands: `search`, `install`, `remove`, `list`, `info`, `update`, `setup-mcp`
- MCP server with tools: `search_extensions`, `install_extension`, `remove_extension`, `list_extensions`
- Agent adapters for Claude Code, Cursor, and Copilot

## Contributing a New Extension

### Skill
1. Create `skills/<kebab-case-name>/SKILL.md`
2. Use `skills/_template/SKILL.md` as starting point
3. Fill frontmatter per schema, write content per `docs/SKILL-AUTHORING.md`

### Agent
1. Create `agents/<kebab-case-name>/AGENT.md`
2. Use `agents/_template/AGENT.md` as starting point
3. Fill frontmatter per schema, write content per `docs/AGENT-AUTHORING.md`

### Command
1. Create `commands/<kebab-case-name>/COMMAND.md`
2. Use `commands/_template/COMMAND.md` as starting point
3. Fill frontmatter per schema, write content per `docs/COMMAND-AUTHORING.md`

Tags must come from `docs/TAG-TAXONOMY.md`. Regenerate catalog locally: `bash scripts/generate-catalog.sh`

## Language

Documentation and extension content are written in Russian. Code identifiers, file paths, and technical terms remain in English.
