---
name: your-skill-name          # required, must match directory name, kebab-case
description: "Use when..."     # required, describe when the AI should activate this skill (min 10 chars)
tags: []                        # optional, see docs/TAG-TAXONOMY.md for allowed values
author: your-github-username   # optional, your GitHub username
version: "1.0.0"              # optional, semantic version (major.minor.patch)
scope: global                  # optional, global | project | both (default: global)
platforms: [claude-code]       # optional, claude-code | cursor | gemini | codex
dependencies: []               # optional, other Skill-Hub skills this depends on
language: any                  # optional, target language or "any" for language-agnostic
---

# Your Skill Name

## Overview

Briefly describe what this skill does and why it exists. Help users understand the value before installing.

## Process

1. First step the AI should take
2. Second step
3. Third step
4. ...

## Examples

**User says:** "example trigger phrase"

**AI does:**
- Action 1
- Action 2
- Action 3

## Rules

- Always do X
- Never do Y
- If Z happens, then do W
