# Skill-Hub

Open-source package manager for Claude Code skills. Search, install, and manage reusable AI coding skills from a central repository.

## What is a Skill?

A skill is a `SKILL.md` file containing instructions that extend your AI coding assistant's capabilities. Skills can define workflows, enforce conventions, add domain expertise, and more.

## Quick Start

### 1. Install the Skill-Hub client

```bash
# Copy the client skill to your global skills directory
mkdir -p ~/.claude/skills/skill-hub
cp client/SKILL.md ~/.claude/skills/skill-hub/SKILL.md
```

### 2. Start using skills

Once installed, you can use the following commands in Claude Code:

```
/skill-hub search <query>     Search for skills by name, tag, or keyword
/skill-hub install <name>     Install a skill to the current scope
/skill-hub remove <name>      Remove an installed skill
/skill-hub list               List all installed skills
/skill-hub update             Update all installed skills to latest versions
/skill-hub init               Initialize Skill-Hub in the current project
```

## Commands

### search

Search the catalog for skills matching a query. Supports skill names, tags, and keywords.

```
/skill-hub search git
/skill-hub search testing typescript
```

### install

Install a skill by name. By default installs to the scope defined in the skill's metadata.

```
/skill-hub install git-commit-and-push
/skill-hub install feature-planning
```

### remove

Remove a previously installed skill.

```
/skill-hub remove git-commit-and-push
```

### list

Show all currently installed skills with their versions and scope.

```
/skill-hub list
```

### update

Update all installed skills to the latest versions from the repository.

```
/skill-hub update
```

### init

Initialize Skill-Hub configuration in the current project directory. Creates a `.claude/skills/` directory and optionally installs recommended skills.

```
/skill-hub init
```

## Architecture

```
Skill-Hub (GitHub repo)
|
|-- client/SKILL.md          # Client skill (the package manager itself)
|-- skills/                   # All published skills
|   |-- _template/SKILL.md   # Template for new skills
|   |-- git-commit-and-push/
|   |-- feature-planning/
|   |-- feature-accept/
|   +-- ...
|-- catalog.json              # Auto-generated skill index
|-- schema/                   # Frontmatter validation schema
|-- scripts/                  # Build & validation scripts
+-- docs/                     # Documentation

Delivery flow:
1. git clone --depth 1 => ~/.claude/skill-hub/   (local cache)
2. Install = copy skill SKILL.md to target scope directory
3. Update = git pull in cache, re-copy installed skills

Scope directories:
  Global:  ~/.claude/skills/<skill-name>/SKILL.md
  Project: ./.claude/skills/<skill-name>/SKILL.md
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide on how to create and submit your own skills.

## License

[MIT](LICENSE)
