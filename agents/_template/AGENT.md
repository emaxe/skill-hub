---
name: your-agent-name          # required, must match directory name, kebab-case
description: "Use when..."     # required, describe when to invoke this agent (min 10 chars)
model: claude-sonnet-4-6       # optional, preferred model for the agent
color: "#00AA00"               # optional, hex color for status line indicator
tags: []                        # optional, see docs/TAG-TAXONOMY.md for allowed values
author: your-github-username   # optional, your GitHub username
version: "1.0.0"              # optional, semantic version (major.minor.patch)
scope: global                  # optional, global | project | both (default: global)
platforms: [claude-code]       # optional, claude-code | cursor | gemini | codex
dependencies: []               # optional, other extensions this depends on (type:name)
---

# Your Agent Name

## Overview

Briefly describe what this agent does and why it exists. Agents are specialized AI assistants that can be spawned to handle specific tasks autonomously.

## Instructions

Describe the agent's behavior, goals, and approach. Be specific about:
- What the agent should do when invoked
- What tools it should use
- What constraints it must follow

## Rules

- Always do X
- Never do Y
- If Z happens, then do W
