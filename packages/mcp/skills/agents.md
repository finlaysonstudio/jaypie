---
description: Recommended prompts to help agents use Jaypie; to put in AGENTS.md, CLAUDE.md, etc.
related: jaypie
---

# Agent Instructions

The goal is concise introduction to Jaypie capabilities that invite agent exploration.

Add one of the following to AGENTS.md, CLAUDE.md, or similar files.

## Complete Version

The complete version references as many daily tasks as possible without listing everything.
Some tasks should not be listed to avoid suboptimal pathing.

```markdown
## Jaypie

Query `mcp__jaypie__skill(alias: String)` for development guidance:

Contents: index, releasenotes
Development: documentation, errors, logs, mocks, style, tests
Infrastructure: aws, cdk, cicd, datadog, dns, dynamodb, express, lambda, secrets, variables
Patterns: fabric, models, services, vocabulary
Meta: issues, jaypie, skills, tools
```

## Short Version

The one-line version tells the agent how to find out more about Jaypie skills.

```markdown
Call `mcp__jaypie__skill("skills")` to discover Jaypie development skills and tools available in this repository.
```