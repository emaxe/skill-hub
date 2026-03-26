# Contributing to skillHub

Thank you for your interest in contributing a skill to skillHub! This guide walks you through the process.

## How to Add a Skill

### 1. Fork the repository

Fork `skillHub` on GitHub and clone your fork locally.

```bash
git clone https://github.com/<your-username>/skillHub.git
cd skillHub
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
| `dependencies`| No       | Other skillHub skills this depends on          |
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

### 8. Automated validation

When you open a PR, automated checks will run to validate:

- Frontmatter conforms to the schema
- The `name` field matches the directory name
- Required fields are present
- Tags are from the allowed taxonomy

Fix any issues flagged by the validation before requesting review.

### 9. After merge

Once your PR is merged, `catalog.json` is automatically regenerated to include your skill. Users can then discover and install it via `/skillhub search` and `/skillhub install`.

## Guidelines

- **One skill per directory** -- each skill lives in `skills/<name>/SKILL.md`
- **Keep skills focused** -- a skill should do one thing well
- **Write clear trigger descriptions** -- the `description` field determines when the AI activates the skill
- **Use existing tags** -- check [docs/TAG-TAXONOMY.md](docs/TAG-TAXONOMY.md) before inventing new ones
- **Test before submitting** -- make sure your skill works in a real Claude Code session

## Questions?

Open an issue on GitHub if you need help or have questions about contributing.
