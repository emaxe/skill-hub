# Skill-Hub

Open-source extension manager for AI coding agents. Search, install, and manage reusable skills, agents, and commands from a central repository.

## Supported AI Agents

| Agent | Status | Scope directories |
|-------|--------|-------------------|
| **Claude Code** | Full support | `~/.claude/` / `.claude/` |
| **Cursor** | Full support | `~/.cursor/` / `.cursor/` |
| **Copilot** (VS Code) | Full support | `~/.config/Code/User/` / `.github/` |

Skill-Hub auto-detects the active agent, but you can set it explicitly:

```bash
skill-hub config set agent cursor
```

## What are Extensions?

Skill-Hub manages three types of extensions:

| Type | Description | Example install location (Claude Code) |
|------|-------------|-----------------|
| **Skill** (`SKILL.md`) | AI behavior instructions activated by context | `~/.claude/skills/{name}/SKILL.md` |
| **Agent** (`AGENT.md`) | Specialized AI assistants spawned as subprocesses | `~/.claude/agents/{name}.md` |
| **Command** (`COMMAND.md`) | User-invocable slash commands | `.claude/commands/{name}.md` |

Each agent stores extensions in its own directory structure. Extensions can declare per-agent platform support via the `platforms` field — unsupported combinations are filtered out automatically.

## Quick Start

### Option A: CLI + MCP (recommended)

```bash
npm install -g @emaxe/skill-hub

# Set up for your agent (claude-code | cursor | copilot)
skill-hub setup-mcp --agent claude-code
```

After restarting your agent, the MCP tools are available automatically.

### Option B: Bootstrap skill (manual)

```bash
# For Claude Code:
mkdir -p ~/.claude/skills/skill-hub
cp "$(npm root -g)/@emaxe/skill-hub/base-skills/claude-code/SKILL.md" ~/.claude/skills/skill-hub/SKILL.md

# For Cursor:
mkdir -p ~/.cursor/skills/skill-hub
cp "$(npm root -g)/@emaxe/skill-hub/base-skills/cursor/SKILL.md" ~/.cursor/skills/skill-hub/SKILL.md
```

### Using extensions

Once installed, you can use the following commands in your agent:

```
/skill-hub search <query>              Search by name, tag, or keyword
/skill-hub search agent:<query>        Search only agents
/skill-hub install <name>              Install a skill
/skill-hub install agent:<name>        Install an agent
/skill-hub install command:<name>      Install a command
/skill-hub remove <name>               Remove an installed extension
/skill-hub list                        List all installed extensions
/skill-hub list --type=agent           List only agents
/skill-hub update                      Update all to latest versions
/skill-hub init                        Recommend extensions for project
```

## Interactive TUI

Run `skill-hub` without arguments to launch the fullscreen interactive UI:

```bash
skill-hub
```

| Key | Action |
|-----|--------|
| `Tab` / `1-3` | Switch tabs (Catalog / Installed / Settings) |
| `↑↓` | Navigate list |
| `Enter` | Open extension details |
| `i` | Install selected extension |
| `d` | Delete (with confirmation) |
| `m` | Move scope (global ↔ project) |
| `u` | Update extension |
| `/` | Focus search |
| `q` | Quit |

### Settings tab

The Settings tab lets you switch between agents (Claude Code, Cursor, Copilot), configure the default scope and registry URL. It also shows the setup status for the selected agent — whether the MCP server is registered and the base skill is installed. If either is missing, you can install it directly from the TUI by navigating to the corresponding field and pressing `Enter`.

## Commands

### search

Search the catalog for extensions matching a query. Supports names, tags, and keywords. Use `type:query` prefix to filter by type.

```
/skill-hub search git
/skill-hub search agent:reviewer
/skill-hub search testing typescript
```

### install

Install an extension by name. Use `type:name` prefix for agents and commands. Without prefix, defaults to skill.

```
/skill-hub install git-commit-and-push
/skill-hub install agent:code-reviewer
/skill-hub install command:deploy-check
```

### remove

Remove a previously installed extension.

```
/skill-hub remove git-commit-and-push
/skill-hub remove agent:code-reviewer
```

### list

Show all currently installed extensions with their versions and scope.

```
/skill-hub list
/skill-hub list --type=agent
```

### update

Update all installed extensions to the latest versions from the repository.

```
/skill-hub update
/skill-hub update agent:code-reviewer
```

### init

Analyze the current project and recommend relevant extensions from the catalog.

```
/skill-hub init
```

## Architecture

```
skill-hub (this repo)
+-- cli/                     # CLI tool + MCP server (npm: @emaxe/skill-hub)
    |-- src/
    |   |-- adapters/        # Agent adapters (claude-code, cursor, copilot)
    |   |-- commands/        # CLI commands
    |   +-- tui/             # Interactive TUI (Ink/React)
    +-- base-skills/         # Bundled base skills per agent — installed by setup

skill-hub-catalog (separate repo)
|-- skills/                  # Published skills
|-- agents/                  # Published agents
|-- commands/                # Published commands
|-- catalog.json             # Auto-generated extension index
|-- schema/                  # Frontmatter validation schemas
|-- scripts/                 # Build & validation scripts
+-- docs/                    # Extension authoring guides

Delivery flow:
1. git clone --depth 1 skill-hub-catalog => ~/.skill-hub/  (local cache)
2. Install = agent adapter copies extension to target scope directory
3. Update = git pull in cache, re-copy installed extensions

Agent adapter handles platform-specific paths and formats:
  Claude Code: ~/.claude/skills/{name}/SKILL.md, ~/.claude/agents/{name}.md
  Cursor:      ~/.cursor/skills/{name}/SKILL.md, ~/.cursor/rules/{name}.mdc
  Copilot:     .github/copilot-instructions.md (merged via markers)
```

## Локальная разработка CLI

Для тестирования CLI без публикации в npm:

```bash
# Собрать
cd cli && npm run build

# Залинковать глобально
npm link

# Тестировать как обычно
skill-hub search git
skill-hub install skill:feature-planning

# Удалить глобальный линк
npm unlink -g @emaxe/skill-hub
```

При изменениях в исходниках достаточно пересобрать (`cd cli && npm run build`) — линк обновится автоматически.

## Contributing

Extensions (skills, agents, commands) live in [skill-hub-catalog](https://github.com/emaxe/skill-hub-catalog). See its `docs/` directory for authoring guides.

For CLI improvements, open a PR in this repo. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

[MIT](LICENSE)
