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
│   ├── adapters/        # Agent adapters (claude-code, cursor, copilot, codex, agents-conventions)
│   │   ├── types.ts     # AgentAdapter interface
│   │   ├── get-adapter.ts # Adapter factory
│   │   ├── claude-code.ts
│   │   ├── cursor.ts
│   │   ├── copilot.ts
│   │   ├── codex.ts
│   │   └── agents-conventions.ts
│   ├── tui/             # Interactive TUI (Ink/React)
│   ├── base-setup.ts    # MCP + base skill setup logic
│   ├── catalog.ts       # Catalog types, platform filtering
│   ├── config.ts        # Config file management (~/.skill-hub/config.json)
│   ├── conventions.ts   # Agents-conventions mode (init/exit/health/bootstrap)
│   ├── detect-agent.ts  # Auto-detection of active agent
│   ├── registry.ts      # Per-agent installation tracking
│   ├── git.ts           # Cache (git clone/pull) management
│   ├── mcp.ts           # MCP server
│   ├── platform.ts      # Platform helpers (isWindows, isMac, getAppData)
│   └── index.ts         # CLI entry point
└── base-skills/         # Bundled base skills shipped with the npm package
    ├── claude-code/SKILL.md
    ├── cursor/SKILL.md
    ├── copilot/SKILL.md
    ├── codex/SKILL.md
    └── agents-conventions/SKILL.md
```

### Agent Adapters

Each supported agent (Claude Code, Cursor, Copilot, Codex) has its own adapter implementing the `AgentAdapter` interface. Additionally, `agents-conventions` mode has its own adapter for the unified `.agents/` directory. Adapters handle platform-specific logic: file paths, extension format conversion (e.g., `.mdc` for Cursor rules), and scope directory resolution. When adding a new agent, create a new adapter in `cli/src/adapters/` and register it in `get-adapter.ts`.

## Questions?

Open an issue on GitHub if you need help or have questions about contributing.
