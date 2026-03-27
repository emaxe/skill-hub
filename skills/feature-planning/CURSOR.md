---
description: Plan new features with structured discovery, specification, and task breakdown workflow
alwaysApply: false
---

# Feature Planning

When the user wants to plan a new feature:

## Process

**Phase 0: Init**
- Ask for feature name (slug, kebab-case) and target git branch
- Create directory structure: `docs/features/{slug}/` with files: README.md, spec.md, plan.md

**Phase 1: Discovery**
- Explore the codebase to understand existing patterns relevant to this feature
- Identify components, APIs, and utilities that can be reused
- Note technical constraints

**Phase 2: Specification**
- Document functional requirements
- Document non-functional requirements (performance, security, etc.)
- Note design decisions and constraints
- Save to `docs/features/{slug}/spec.md`

**Phase 3: Planning**
- Break the feature into concrete, testable tasks
- Use TDD approach: write failing test → implement → pass test
- Group tasks by component/layer
- Save to `docs/features/{slug}/plan.md`

**Phase 4: Starter Prompt**
- Write a ready-to-use implementation prompt
- Include: feature context, spec summary, first task to implement
- Save to `docs/features/{slug}/README.md`

All artifacts go into `docs/features/{slug}/` directory.
