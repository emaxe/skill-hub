# skillHub

Open-source package manager for Claude Code skills. Search, install, and manage reusable AI coding skills from a central repository.

## What is a Skill?

A skill is a `SKILL.md` file containing instructions that extend your AI coding assistant's capabilities. Skills can define workflows, enforce conventions, add domain expertise, and more.

## Quick Start

### 1. Install the skillHub client

```bash
# Copy the client skill to your global skills directory
mkdir -p ~/.claude/skills/skillhub
cp client/SKILL.md ~/.claude/skills/skillhub/SKILL.md
```

### 2. Start using skills

Once installed, you can use the following commands in Claude Code:

```
/skillhub search <query>     Search for skills by name, tag, or keyword
/skillhub install <name>     Install a skill to the current scope
/skillhub remove <name>      Remove an installed skill
/skillhub list               List all installed skills
/skillhub update             Update all installed skills to latest versions
/skillhub init               Initialize skillHub in the current project
```

## Commands

### search

Search the catalog for skills matching a query. Supports skill names, tags, and keywords.

```
/skillhub search git
/skillhub search testing typescript
```

### install

Install a skill by name. By default installs to the scope defined in the skill's metadata.

```
/skillhub install git-commit-and-push
/skillhub install feature-planning
```

### remove

Remove a previously installed skill.

```
/skillhub remove git-commit-and-push
```

### list

Show all currently installed skills with their versions and scope.

```
/skillhub list
```

### update

Update all installed skills to the latest versions from the repository.

```
/skillhub update
```

### init

Initialize skillHub configuration in the current project directory. Creates a `.claude/skills/` directory and optionally installs recommended skills.

```
/skillhub init
```

## Architecture

```
skillHub (GitHub repo)
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
1. git clone --depth 1 => ~/.claude/skillhub/   (local cache)
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
