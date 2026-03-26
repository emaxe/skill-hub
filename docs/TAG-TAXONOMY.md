# Tag Taxonomy

Standardized tags for categorizing skills in skillHub. When creating a skill, use tags from this list in your frontmatter. If you need a new tag, propose it in your PR.

## Workflow

Tags related to development workflows and processes.

| Tag        | Description                                    |
|------------|------------------------------------------------|
| `git`      | Git operations, branching, commit conventions  |
| `workflow` | General development workflow automation        |
| `safety`   | Safety checks, validation, guardrails          |
| `ci-cd`    | Continuous integration and deployment          |
| `planning` | Feature planning, task breakdown, estimation   |

## Language

Tags for programming language-specific skills.

| Tag          | Description          |
|--------------|----------------------|
| `javascript` | JavaScript           |
| `typescript` | TypeScript           |
| `python`     | Python               |
| `go`         | Go                   |
| `rust`       | Rust                 |
| `java`       | Java                 |

## Framework

Tags for framework-specific skills.

| Tag       | Description             |
|-----------|-------------------------|
| `react`   | React                   |
| `vue`     | Vue.js                  |
| `nextjs`  | Next.js                 |
| `express` | Express.js              |
| `django`  | Django                  |
| `flask`   | Flask                   |
| `fastapi` | FastAPI                 |
| `svelte`  | Svelte                  |

## Tool

Tags for tool and utility-related skills.

| Tag         | Description                          |
|-------------|--------------------------------------|
| `docker`    | Docker, containers, Compose          |
| `eslint`    | Linting, code style enforcement      |
| `testing`   | Testing frameworks and practices     |
| `debugging` | Debugging techniques and tools       |
| `logging`   | Logging, observability, tracing      |

## Domain

Tags for domain-specific knowledge and practices.

| Tag              | Description                              |
|------------------|------------------------------------------|
| `architecture`   | Software architecture, design patterns   |
| `security`       | Security best practices, vulnerability prevention |
| `performance`    | Performance optimization, profiling      |
| `accessibility`  | Accessibility (a11y) standards           |
| `documentation`  | Documentation generation and standards   |

## Platform

Tags for target AI coding platforms.

| Tag          | Description              |
|--------------|--------------------------|
| `claude-code`| Anthropic Claude Code    |
| `cursor`     | Cursor IDE               |
| `gemini`     | Google Gemini            |
| `codex`      | OpenAI Codex             |

## Using Tags

In your skill's frontmatter, specify tags as a YAML array:

```yaml
tags: [git, workflow, safety]
```

Choose tags that accurately describe what your skill does. Use 1-5 tags per skill. Prefer existing tags over creating new ones.
