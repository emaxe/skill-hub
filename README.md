# Skill-Hub

Open-source extension manager for Claude Code. Search, install, and manage reusable skills, agents, and commands from a central repository.

## What are Extensions?

Skill-Hub manages three types of Claude Code extensions:

| Type | Description | Install location |
|------|-------------|-----------------|
| **Skill** (`SKILL.md`) | AI behavior instructions activated by context | `~/.claude/skills/{name}/` or `.claude/skills/{name}/` |
| **Agent** (`AGENT.md`) | Specialized AI assistants spawned as subprocesses | `~/.claude/agents/{name}.md` or `.claude/agents/{name}.md` |
| **Command** (`COMMAND.md`) | User-invocable slash commands | `.claude/commands/{name}.md` |

## Quick Start

### Option A: CLI + MCP (recommended)

```bash
npm install -g @emaxe/skill-hub
skill-hub setup-mcp --agent claude-code
```

After restarting Claude Code, the MCP tools are available automatically.

### Option B: Bootstrap skill (manual)

```bash
mkdir -p ~/.claude/skills/skill-hub
cp client/SKILL.md ~/.claude/skills/skill-hub/SKILL.md
```

### Using extensions

Once installed, you can use the following commands in Claude Code:

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
|-- client/SKILL.md          # Bootstrap client skill
+-- cli/                     # CLI tool + MCP server (npm: @emaxe/skill-hub)

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
2. Install = copy extension to target scope directory
3. Update = git pull in cache, re-copy installed extensions

Install paths by type:
  Skill:   ~/.claude/skills/{name}/    or .claude/skills/{name}/
  Agent:   ~/.claude/agents/{name}.md  or .claude/agents/{name}.md
  Command: .claude/commands/{name}.md
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
