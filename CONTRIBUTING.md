# Contributing to Skill-Hub

Thank you for your interest in contributing to Skill-Hub! This guide walks you through the process of adding skills, agents, and commands.

## Extension Types

Skill-Hub manages three types of Claude Code extensions:

| Type | File | Directory | Description |
|------|------|-----------|-------------|
| **Skill** | `SKILL.md` | `skills/{name}/` | AI behavior instructions, activated by context |
| **Agent** | `AGENT.md` | `agents/{name}/` | Specialized AI assistants, spawned as subprocesses |
| **Command** | `COMMAND.md` | `commands/{name}/` | User-invocable slash commands |

## How to Add a Skill

### 1. Fork the repository

Fork `Skill-Hub` on GitHub and clone your fork locally.

```bash
git clone https://github.com/<your-username>/skill-hub.git
cd skill-hub
```

### 2. Create a skill directory

Create a new directory under `skills/` using kebab-case for the name.

```bash
mkdir skills/your-skill-name
```

### 3. Copy the template

Use the provided template as a starting point.

```bash
cp skills/_template/SKILL.md skills/your-skill-name/SKILL.md
```

### 4. Fill in frontmatter

Edit the YAML frontmatter at the top of your `SKILL.md`. Required fields:

| Field         | Required | Description                                    |
|---------------|----------|------------------------------------------------|
| `name`        | Yes      | Must match the directory name, kebab-case      |
| `description` | Yes      | Describe when to trigger this skill (min 10 chars) |
| `tags`        | No       | Categorization tags (see [TAG-TAXONOMY.md](docs/TAG-TAXONOMY.md)) |
| `author`      | No       | Your GitHub username                           |
| `version`     | No       | Semantic version (e.g., `1.0.0`)               |
| `scope`       | No       | `global`, `project`, or `both` (default: `global`) |
| `platforms`   | No       | Target platforms: `claude-code`, `cursor`, `gemini`, `codex` |
| `dependencies`| No       | Other extensions this depends on (format: `type:name`) |
| `language`    | No       | Target programming language (default: `any`)   |

See [schema/frontmatter.schema.json](schema/frontmatter.schema.json) for the full validation schema.

### 5. Write the skill content

Write the body of your `SKILL.md` with clear instructions for the AI assistant. See [docs/SKILL-AUTHORING.md](docs/SKILL-AUTHORING.md) for best practices.

### 6. Test locally

Test your skill by copying it to your local skills directory:

```bash
mkdir -p ~/.claude/skills/your-skill-name
cp skills/your-skill-name/SKILL.md ~/.claude/skills/your-skill-name/SKILL.md
```

Then open Claude Code and verify the skill works as expected.

### 7. Submit a pull request

Commit your changes, push to your fork, and open a PR against the `main` branch.

```bash
git add skills/your-skill-name/SKILL.md
git commit -m "Add your-skill-name skill"
git push origin main
```

## How to Add an Agent

### 1. Create an agent directory

```bash
mkdir agents/your-agent-name
```

### 2. Copy the template

```bash
cp agents/_template/AGENT.md agents/your-agent-name/AGENT.md
```

### 3. Fill in frontmatter

Agent-specific fields include `model` (preferred Claude model) and `color` (status line color). See [docs/AGENT-AUTHORING.md](docs/AGENT-AUTHORING.md) for details.

### 4. Test locally

```bash
cp agents/your-agent-name/AGENT.md ~/.claude/agents/your-agent-name.md
```

Note: the file is renamed to `{name}.md` when installed — this is how Claude Code discovers agents.

### 5. Submit a pull request

```bash
git add agents/your-agent-name/AGENT.md
git commit -m "Add your-agent-name agent"
git push origin main
```

## How to Add a Command

### 1. Create a command directory

```bash
mkdir commands/your-command-name
```

### 2. Copy the template

```bash
cp commands/_template/COMMAND.md commands/your-command-name/COMMAND.md
```

### 3. Fill in frontmatter

Commands have scope `project` by default (or `both`). See [docs/COMMAND-AUTHORING.md](docs/COMMAND-AUTHORING.md) for details.

### 4. Test locally

```bash
mkdir -p .claude/commands
cp commands/your-command-name/COMMAND.md .claude/commands/your-command-name.md
```

Then invoke `/your-command-name` in Claude Code.

### 5. Submit a pull request

```bash
git add commands/your-command-name/COMMAND.md
git commit -m "Add your-command-name command"
git push origin main
```

## Automated Validation

When you open a PR, automated checks will run to validate:

- Frontmatter conforms to the schema for the extension type
- The `name` field matches the directory name
- Required fields are present
- File size is under 100KB
- No secrets in frontmatter
- Tags are from the allowed taxonomy

Fix any issues flagged by the validation before requesting review.

## After Merge

Once your PR is merged, `catalog.json` is automatically regenerated to include your extension. Users can then discover and install it via `/skill-hub search` and `/skill-hub install`.

## Multi-Platform Support

Extensions can include platform-specific variants alongside the primary file. This is optional — the primary file (`SKILL.md`, `AGENT.md`, or `COMMAND.md`) is always required.

| File | Platform | Required |
|------|----------|----------|
| `SKILL.md` / `AGENT.md` / `COMMAND.md` | Claude Code | Yes |
| `CURSOR.md` | Cursor IDE | No |
| `COPILOT.md` | GitHub Copilot | No |

Place platform-specific files in the same directory as the primary file:

```
skills/your-skill-name/
├── SKILL.md      # Primary (Claude Code)
├── CURSOR.md     # Cursor variant (optional)
└── COPILOT.md    # Copilot variant (optional)
```

The catalog generator auto-detects these files and includes them in `catalog.json`.

## Guidelines

- **One extension per directory** — each lives in `{type}/{name}/{TYPE}.md`
- **Keep extensions focused** — each should do one thing well
- **Write clear descriptions** — the `description` field determines when the AI activates the extension
- **Use existing tags** — check [docs/TAG-TAXONOMY.md](docs/TAG-TAXONOMY.md) before inventing new ones
- **Test before submitting** — make sure your extension works in a real Claude Code session
- **Dependencies use `type:name` format** — e.g., `skill:feature-planning`, `agent:code-reviewer`. Without prefix, `skill` is assumed

## Questions?

Open an issue on GitHub if you need help or have questions about contributing.
