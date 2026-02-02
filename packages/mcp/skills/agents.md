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

Complete stack styles, techniques, and traditions.

- Call `mcp__jaypie__skill("skills")` to discover Jaypie development skills and tools available in this repository
- A `~` before a word or surrounding a word/phrase indicates it can be looked up as in ~skills
- Check ~tools (`mcp__jaypie__skill("tools")`) for all tools or ~tools-aws, ~tools-datadog, and ~tools-dynamodb individually
- File bugs, documentation, features, and other issues with `mcp__jaypie__skill("issues")`

### Code

- `log.trace` happy path, `log.debug` things that should stand out. Avoid info. Use warn when recoverable. Use error when unrecoverable or "really bad"

### Skills

`mcp__jaypie__skill(alias: String)`

Contents: index, releasenotes
Development: documentation, errors, llm, logs, mocks, monorepo, style, subpackages, tests
Infrastructure: aws, cdk, cicd, datadog, dns, dynamodb, express, lambda, secrets, streaming, variables, websockets
Patterns: fabric, handlers, models, services, vocabulary
Meta: issues, jaypie, skills, tools
```

## Short Version

The one-line version tells the agent how to find out more about Jaypie skills.

```markdown
Call `mcp__jaypie__skill("skills")` to discover Jaypie development skills and tools available in this repository.
```