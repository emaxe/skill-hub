# Contributing to Skill-Hub

Thank you for your interest in contributing to Skill-Hub!

## Where to Contribute

Skill-Hub is split across two repositories:

| Contribution | Repository |
|---|---|
| Skills, agents, commands (extensions) | [skill-hub-catalog](https://github.com/emaxe/skill-hub-catalog) |
| CLI tool, MCP server, TUI | This repository (`skill-hub`) |

## Contributing Extensions

Extensions (skills, agents, commands) live in **[skill-hub-catalog](https://github.com/emaxe/skill-hub-catalog)**. See its `docs/` directory for authoring guides:

- `docs/SKILL-AUTHORING.md` — how to write skills
- `docs/AGENT-AUTHORING.md` — how to write agents
- `docs/COMMAND-AUTHORING.md` — how to write commands
- `docs/TAG-TAXONOMY.md` — allowed tags

The catalog repo also contains `schema/` for frontmatter validation and automated CI checks.

## Contributing to the CLI

For CLI improvements (commands, TUI, MCP server, adapters), open a PR in this repository.

### Local Development

```bash
# Build
cd cli && npm run build

# Link globally for testing
npm link

# Test any command
skill-hub search git
skill-hub install skill:feature-planning

# Remove global link
npm unlink -g @emaxe/skill-hub
```

After rebuilding (`npm run build`), the global link picks up changes automatically.

### Running Tests

```bash
cd cli && npm test
```

### Repository Layout

```
cli/
├── src/
│   ├── commands/        # CLI commands (search, install, remove, etc.)
│   ├── adapters/        # Agent adapters (claude-code, cursor, copilot)
│   ├── tui/             # Interactive TUI (Ink/React)
│   ├── base-setup.ts    # MCP + base skill setup logic
│   ├── catalog.ts       # Catalog types and loading
│   ├── config.ts        # Config file management
│   ├── git.ts           # Cache (git clone/pull) management
│   ├── mcp.ts           # MCP server
│   └── index.ts         # CLI entry point
└── base-skills/         # Bundled base skills shipped with the npm package
    ├── claude-code/SKILL.md
    └── copilot/SKILL.md
```

## Questions?

Open an issue on GitHub if you need help or have questions about contributing.
