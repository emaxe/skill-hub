---
name: your-command-name        # required, must match directory name, kebab-case
description: "Use when..."     # required, describe what this command does (min 10 chars)
tags: []                        # optional, see docs/TAG-TAXONOMY.md for allowed values
author: your-github-username   # optional, your GitHub username
version: "1.0.0"              # optional, semantic version (major.minor.patch)
scope: project                 # optional, project | both (default: project)
platforms: [claude-code]       # optional, claude-code | cursor | gemini | codex
dependencies: []               # optional, other extensions this depends on (type:name)
---

# /your-command-name

## Overview

Briefly describe what this command does. Commands are user-invocable slash commands in Claude Code.

## Process

1. First step the command executes
2. Second step
3. Third step

## Arguments

- `arg1` — Description of the first argument
- `--flag` — Description of a flag

## Examples

```
/your-command-name arg1
/your-command-name --flag value
```

## Rules

- Always do X
- Never do Y
