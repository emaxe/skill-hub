# Skill Authoring Guide

A complete guide to writing high-quality skills for Skill-Hub.

## Frontmatter Reference

Every `SKILL.md` starts with YAML frontmatter between `---` delimiters. Here is the full field reference:

| Field          | Type     | Required | Default    | Description |
|----------------|----------|----------|------------|-------------|
| `name`         | string   | Yes      | --         | Unique kebab-case identifier. Must match the directory name. Pattern: `^[a-z0-9]+(-[a-z0-9]+)*$` |
| `description`  | string   | Yes      | --         | Short description of what the skill does and when to trigger it. Minimum 10 characters. |
| `tags`         | string[] | No       | `[]`       | Categorization tags. See [TAG-TAXONOMY.md](TAG-TAXONOMY.md). |
| `author`       | string   | No       | --         | Author's GitHub username. |
| `version`      | string   | No       | --         | Semantic version (e.g., `1.0.0`). Pattern: `^\d+\.\d+\.\d+$` |
| `scope`        | string   | No       | `global`   | Where the skill applies. Values: `global`, `project`, `both`. |
| `platforms`    | string[] | No       | --         | Supported platforms. Values: `claude-code`, `cursor`, `gemini`, `codex`. |
| `dependencies` | string[] | No       | `[]`       | Other Skill-Hub extensions this depends on. Format: `type:name` (e.g., `skill:git-commit-and-push`, `agent:code-reviewer`). Without prefix, `skill` is assumed. |
| `language`     | string   | No       | `any`      | Target programming language or `any` for language-agnostic skills. |

Full JSON Schema: [schema/frontmatter.schema.json](../schema/frontmatter.schema.json)

## Writing the Description

The `description` field is critical -- it tells the AI assistant **when** to activate the skill. Write it as a trigger phrase starting with "Use when...".

**Good descriptions:**

```yaml
description: "Use when the user asks to commit and push changes to git"
description: "Use when planning a new feature that requires task breakdown"
description: "Use when the user wants to accept and finalize a feature implementation"
```

**Bad descriptions:**

```yaml
description: "A git skill"           # Too vague, no trigger
description: "Helps with stuff"      # Meaningless
description: "Git"                   # Too short (min 10 chars)
```

## Content Structure

After the frontmatter, structure your skill content with clear sections:

### Overview

A brief paragraph explaining what the skill does and why it exists. This helps users understand the skill before installing it.

### Process / Instructions

Step-by-step instructions for the AI assistant. Use numbered lists for sequential steps, bullet lists for options. Be explicit and unambiguous.

### Examples

Concrete examples of input/output or before/after scenarios. These help the AI understand the expected behavior.

### Rules

Constraints, edge cases, and important things the AI must always or never do. Use imperative language.

## Scope

The `scope` field controls where a skill can be installed:

- **`global`** -- Installed to `~/.claude/skills/<name>/SKILL.md`. Available in all projects. Best for general-purpose skills (git workflows, code review, etc.).
- **`project`** -- Installed to `./.claude/skills/<name>/SKILL.md`. Available only in the current project. Best for project-specific conventions.
- **`both`** -- User chooses the scope during installation.

## Dependencies

If your skill depends on other Skill-Hub extensions, list them in the `dependencies` array using `type:name` format:

```yaml
dependencies: [skill:git-commit-and-push, agent:code-reviewer]
```

Without a type prefix, `skill` is assumed (e.g., `git-commit-and-push` = `skill:git-commit-and-push`).

When a user installs your skill, Skill-Hub will prompt to install any missing dependencies.

## Testing Locally

Before submitting, test your skill:

1. Copy it to the appropriate scope directory:
   ```bash
   # Global scope
   cp skills/your-skill/SKILL.md ~/.claude/skills/your-skill/SKILL.md

   # Project scope
   cp skills/your-skill/SKILL.md .claude/skills/your-skill/SKILL.md
   ```

2. Open Claude Code and trigger the skill by describing a scenario that matches the `description`.

3. Verify the AI follows your instructions correctly.

4. Test edge cases and make sure the `Rules` section handles them.

## Examples of Good Skills

### Focused trigger

```yaml
---
name: react-component
description: "Use when the user asks to create a new React component with TypeScript"
tags: [react, typescript]
scope: project
platforms: [claude-code]
language: typescript
---

# React Component Generator

## Overview
Creates well-structured React components following project conventions.

## Process
1. Ask for the component name if not provided
2. Create the component file in the appropriate directory
3. Use functional component with TypeScript props interface
4. Add basic unit test file alongside the component

## Rules
- Always use named exports, not default exports
- Props interface must be exported separately
- Place components in src/components/ unless specified otherwise
```

### Clear instructions with rules

```yaml
---
name: safe-git-push
description: "Use when the user asks to push changes to a remote git repository"
tags: [git, safety]
scope: global
platforms: [claude-code]
---

# Safe Git Push

## Overview
Pushes changes to remote with safety checks to prevent common mistakes.

## Process
1. Run git status to check for uncommitted changes
2. Run git log --oneline -5 to show recent commits
3. Confirm the target branch with the user
4. Never force push to main or master
5. Push to the current branch

## Rules
- NEVER use --force or --force-with-lease on main/master
- Always show the user what will be pushed before pushing
- If on main/master, warn the user and ask for confirmation
```
