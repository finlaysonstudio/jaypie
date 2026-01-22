---
description: Minimal agent instructions
---

# Agent Instructions

Add to CLAUDE.md or AGENTS.md:

```markdown
## Jaypie

Query `mcp__jaypie__skill(alias: String)` for development guidance:

Contents: index, releasenotes
Development: documentation, errors, logs, mocks, style, tests
Infrastructure: aws, cdk, cicd, datadog, dns, dynamodb, secrets, variables
Patterns: fabric, models, services, tools
Meta: agents, issues, jaypie
```

Or, for one line,

```markdown
`mcp__jaypie__skill(index)` describes Jaypie development skills for this repository.
```