---
description: Updates to Jaypie code, deploy, documentation, and other practices
---

# Jaypie Practice

- These are Jaypie practices
- Confirm any implementation before taking action
- Do not assume a reference to this skill means to run it all

## Workflow Dispatch Actions

- Prefer workflow dispatch actions over branch names and tagging
- Most work is agent-driven so "deploy to production" is more natural

## Scrub

### Scrub Documentation

- Use a subagent to find essential directories that do not contain a CLAUDE.md, if any
  - Use a subagent to write a CLAUDE.md for each essential directory without one
  - Parallelize this work except when one essential directory contains another
  - In that case, complete the descendant CLAUDE first
  - Whenever possible, offer a terse overview in the root or ancestor CLAUDE and reference the descendant for detail
- Find CLAUDE.md file not impacted by the above
  - Use a subagent to update each CLAUDE.md
  - Also parallelize this work except when dealing with ancestor- descendant chains
  - Resolve descendants as described
- Find all README.md
  - Use a subagent to update each
  - Optimize both CLAUDE and README for agents
  - Use terse, direct language
  - Avoid superlatives, rationalizing the technology, or anything resembling hype/sales

### Scrub Style

- Do not allow imports from subpackages that are exported from `jaypie`
  - Importing from `@jaypie/express` is not allowed because `jaypie` exports it
  - Importing from `@jaypie/