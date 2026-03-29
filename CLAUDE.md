# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Skill-Hub is an open-source extension manager for Claude Code. It provides a CLI tool and MCP server for searching, installing, and managing reusable extensions — **skills**, **agents**, and **commands**.

- **This repo** (`skill-hub`) — CLI tool (`cli/`) and bootstrap client skill (`client/`)
- **Catalog repo** (`skill-hub-catalog`) — all published extensions (skills, agents, commands), schemas, and docs

## Key Commands

```bash
# Local CLI development — build, link globally, test without npm publish
cd cli && npm run build          # rebuild
npm link                         # link globally (or use dev-link.sh equivalent)
skill-hub search git             # test any command
npm unlink -g @emaxe/skill-hub  # remove global link
```

## Architecture

### Repository Split

| Repo | Contents |
|------|----------|
| `skill-hub` (this repo) | `cli/` — TypeScript CLI + MCP server; `client/` — bootstrap skill |
| `skill-hub-catalog` | `skills/`, `agents/`, `commands/`, `schema/`, `scripts/`, `docs/`, `catalog.json` |

### Delivery Flow

**Via CLI (recommended):**
1. `npm install -g @emaxe/skill-hub` — install the CLI
2. `skill-hub setup-mcp --agent claude-code` — configure MCP server
3. CLI clones `skill-hub-catalog` to `~/.skill-hub/` cache, handles install/update

**Manual:**
1. User clones catalog repo to `~/.skill-hub/`
2. Install = copy extension to target scope directory (agents/commands: single file renamed to `{name}.md`)
3. Update = `git pull` in cache, re-copy installed extensions

### Scope Directories

- **Global:** `~/.claude/skills/{name}/SKILL.md`, `~/.claude/agents/{name}.md`
- **Project:** `./.claude/skills/{name}/SKILL.md`, `.claude/agents/{name}.md`, `.claude/commands/{name}.md`

### Client Skill

`client/SKILL.md` is the bootstrap skill — installed to global skills, it guides users through CLI installation (`npm install -g @emaxe/skill-hub`) and MCP server setup. After setup, the CLI/MCP handles `/skill-hub search|install|remove|list|update|init` with `type:name` syntax, manages `~/.skill-hub/installed.json` registry, and supports dependency resolution.

### CLI Package

`cli/` contains the TypeScript source for the `@emaxe/skill-hub` npm package. Provides:
- CLI commands: `search`, `install`, `remove`, `list`, `info`, `update`, `setup-mcp`, `config`
- Interactive TUI: `skill-hub` with no arguments launches fullscreen UI (Ink/React)
- MCP server with tools: `search_extensions`, `install_extension`, `remove_extension`, `list_extensions`
- Agent adapters for Claude Code, Cursor, and Copilot
- Config file at `~/.skill-hub/config.json` — fields: `agent`, `defaultScope`, `registryUrl`

## Contributing Extensions

Extensions (skills, agents, commands) live in the catalog repo: **github.com/emaxe/skill-hub-catalog**. See its `docs/` directory for authoring guides.

## Language

Documentation and extension content are written in Russian. Code identifiers, file paths, and technical terms remain in English.
