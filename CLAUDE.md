# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Skill-Hub is an open-source package manager for Claude Code skills. It provides a central repository of reusable `SKILL.md` files that extend AI coding assistant capabilities. Users install the client skill (`client/SKILL.md`) and use `/skill-hub` commands to search, install, and manage skills.

## Key Commands

```bash
# Generate catalog.json from skills/*/SKILL.md frontmatter
bash scripts/generate-catalog.sh

# Test a skill locally (copy to global scope)
mkdir -p ~/.claude/skills/<skill-name>
cp skills/<skill-name>/SKILL.md ~/.claude/skills/<skill-name>/SKILL.md
```

There are no build tools, linters, test suites, or package managers — this is a pure Markdown + shell scripts repository.

## Architecture

### Delivery Flow

1. User clones repo to `~/.claude/skill-hub/` (local cache)
2. Install = copy `SKILL.md` from cache to target scope directory
3. Update = `git pull` in cache, re-copy installed skills

### Scope Directories

- **Global:** `~/.claude/skills/<skill-name>/SKILL.md`
- **Project:** `./.claude/skills/<skill-name>/SKILL.md`

### Skill Structure

Each skill lives in `skills/<name>/SKILL.md` with YAML frontmatter (between `---` delimiters):

- **Required fields:** `name` (kebab-case, must match directory name), `description` (min 10 chars, starts with "Use when...")
- **Optional fields:** `tags`, `author`, `version` (semver), `scope` (global/project/both), `platforms`, `dependencies`, `language`
- Schema: `schema/frontmatter.schema.json`

### catalog.json

Auto-generated index of all skills. Rebuilt by `scripts/generate-catalog.sh` (bash script that parses frontmatter from all `skills/*/SKILL.md` files). On GitHub, this is automated via `.github/workflows/catalog.yml` on push to main when `skills/**` changes.

### CI Validation

`.github/workflows/validate.yml` runs on PRs touching `skills/**`:
- Checks frontmatter conforms to schema
- Validates `name` matches directory name
- Checks required fields, file size (<100KB), secret detection
- Warns on unknown tags (known tags listed in `docs/TAG-TAXONOMY.md`)

### Client Skill

`client/SKILL.md` is the package manager itself — installed by users to their global skills. It handles `/skill-hub search|install|remove|list|update|init` commands, manages `~/.claude/skill-hub/installed.json` registry, and supports dependency resolution.

## Contributing a New Skill

1. Create `skills/<kebab-case-name>/SKILL.md`
2. Use `skills/_template/SKILL.md` as starting point
3. Fill frontmatter per schema, write content per `docs/SKILL-AUTHORING.md`
4. Tags must come from `docs/TAG-TAXONOMY.md`
5. Regenerate catalog locally: `bash scripts/generate-catalog.sh`

## Language

Documentation and skill content are written in Russian. Code identifiers, file paths, and technical terms remain in English.
