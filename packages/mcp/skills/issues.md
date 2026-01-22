---
description: Submitting issues to Jaypie repositories
related: jaypie, agents
---

# Jaypie Issues

## Repository

Submit issues to: **github.com/finlaysonstudio/jaypie**

## Agent Guidelines

**CRITICAL: Never submit issues without explicit user approval.**

Before creating an issue:
1. Draft the issue title and body
2. Present the draft to the user
3. Wait for explicit approval ("yes", "submit it", etc.)
4. Only then use `mcp__github__issue_write` to create the issue

## Issue Format

```markdown
**Title**: [Brief, descriptive title]

**Description**:
[What is the issue or feature request]

**Context**:
- Package: [affected package, e.g., `jaypie`, `@jaypie/express`]
- Version: [if known]
- Environment: [if relevant]

**Steps to Reproduce** (for bugs):
1. ...
2. ...

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happens]
```

## Labels

Common labels: `bug`, `enhancement`, `documentation`, `question`

## When to Suggest Issues

- Bugs in Jaypie packages discovered during development
- Missing features that would benefit multiple projects
- Documentation gaps or errors
- API inconsistencies
