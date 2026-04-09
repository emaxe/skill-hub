# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Skill-Hub is an open-source extension manager for AI coding agents (Claude Code, Cursor, Copilot). It provides a CLI tool and MCP server for searching, installing, and managing reusable extensions — **skills**, **agents**, and **commands**.

- **This repo** (`skill-hub`) — CLI tool (`cli/`)
- **Catalog repo** (`skill-hub-catalog`) — all published extensions (skills, agents, commands), schemas, and docs

## Key Commands

```bash
# Local CLI development — build, link globally, test without npm publish
cd cli && npm run build          # rebuild
npm link                         # link globally (or use dev-link.sh equivalent)
skill-hub search git             # test any command
npm unlink -g @emaxe/skill-hub  # remove global link

# Run tests
cd cli && npm test
```

## Architecture

### Repository Split

| Repo | Contents |
|------|----------|
| `skill-hub` (this repo) | `cli/` — TypeScript CLI + MCP server; `cli/base-skills/` — bootstrap skills per agent |
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

### Agent Adapters

Four agents supported via `AgentAdapter` interface (`cli/src/adapters/`):
- **Claude Code** — `~/.claude/` / `.claude/` (skills, agents, commands)
- **Cursor** — `~/.cursor/` / `.cursor/` (skills in `skills/`, rules in `.mdc` format)
- **Copilot** — `~/.config/Code/User/` / `.github/` (merges into `copilot-instructions.md` via HTML markers)
- **agents-conventions** — `.agents/` (project-only scope, unified directory with symlinks to agent dirs)

Auto-detection in `detect-agent.ts`: checks env vars (`CURSOR_TRACE`, `GITHUB_COPILOT`), then `.cursor/` dir, defaults to `claude-code`.

### Scope Directories (Claude Code example)

- **Global:** `~/.claude/skills/{name}/SKILL.md`, `~/.claude/agents/{name}.md`
- **Project:** `./.claude/skills/{name}/SKILL.md`, `.claude/agents/{name}.md`, `.claude/commands/{name}.md`

### Project Config

Two-tier configuration system:
- **Global config:** `~/.skill-hub/config.json`
- **Project config:** `.skill-hub.json` at project root (auto-detected by walking up from CWD looking for `.skill-hub.json` or `.git`)

Project config overrides global. Structure of `.skill-hub.json`:
```json
{
  "settings": { "agent": "...", "defaultScope": "...", ... },
  "extensions": [{ "type": "skill", "name": "...", "version": "...", "scope": "project" }]
}
```

The `extensions` array tracks which extensions should be installed for the project — enables team sync.

### Extension Sync

On TUI startup, `sync.ts` checks if extensions listed in `.skill-hub.json` are actually installed. Missing extensions trigger `ExtensionSyncDialog` offering to install them. Can also be triggered from Settings.

### Conventions Mode (agents-conventions)

Unified `.agents/` directory for multi-agent projects:
- `skill-hub agents-conventions enable` — creates `.agents/`, sets up symlinks from agent dirs, creates thin pointer files
- `skill-hub agents-conventions disable` — migrates extensions back, removes symlinks
- Init/exit flows can spawn AI agent subprocesses to execute migration skills (`init-agents`, `exit-agents`)
- Implementation: `cli/src/conventions.ts`, TUI modals: `InitConventionsModal`, `ExitConventionsModal`

### CLI Package

`cli/` contains the TypeScript source for the `@emaxe/skill-hub` npm package. Provides:
- CLI commands: `search`, `install`, `remove`, `move`, `list`, `info`, `update`, `setup-mcp`, `config`, `agents-conventions`, `launch`
- Interactive TUI: `skill-hub` with no arguments launches fullscreen UI (Ink/React)
- MCP server (7 tools): `search_extensions`, `install_extension`, `remove_extension`, `move_extension`, `list_extensions`, `suggest_extensions`, `get_extension_info`
- Agent adapters for Claude Code, Cursor, Copilot, and agents-conventions
- Config: `~/.skill-hub/config.json` — fields: `agent`, `defaultScope`, `registryUrl`, `aiAgents` (proxy + per-agent settings), `history` (recent URLs/proxies)

### TUI Architecture

Built with **Ink** (React for terminals). Key structure:
- **Entry:** `tui/index.ts` → `App.tsx` (root component, 400+ lines)
- **Navigation:** tab-based (Catalog / Installed / Settings) + screen stack for detail views
- **Hooks:** `useRegistry` (central extension state), `useCatalog` (search), `useSettings`, `useBaseSetup`, `useNavigation`, `useConventionsInit/Exit`, `useTerminalSize`
- **Screens:** `CatalogScreen`, `InstalledScreen`, `SettingsScreen` (tabs), `DetailScreen`, `InstalledDetailScreen`, `MoveScreen`, `ContentScreen` (pushed)
- **State:** pure React hooks + single `StatusContext` for global status bar
- **Keymap:** `keymap.ts` normalizes Russian keyboard layout to Latin for hotkeys

## Contributing Extensions

Extensions (skills, agents, commands) live in the catalog repo: **github.com/emaxe/skill-hub-catalog**. See its `docs/` directory for authoring guides.

## Language

Documentation and extension content are written in Russian. Code identifiers, file paths, and technical terms remain in English.

## Coding Conventions

When modifying code in this project, follow these rules:

1. **Keep documentation in sync with code.** When adding/removing CLI commands, MCP tools, config fields, or adapters — update the corresponding lists in this file (CLAUDE.md) and `cli/README.md`.
2. **Add JSDoc to exported interfaces and functions.** Use Russian for comment text. Follow existing patterns: `config.ts` (section headers), `keymap.ts` (JSDoc), `conventions.ts` (numbered steps).
3. **Comment non-obvious logic.** Complex algorithms, multi-step flows, deduplication, and scoring logic should have brief inline comments explaining "why", not "what".
4. **Don't over-comment.** Simple getters, trivial one-liners, and self-documenting code don't need comments.
5. **Version sync.** When bumping `package.json` version, also update version strings in `index.ts` and `mcp.ts`.
