---
description: Version history and release notes
---

# Release Notes

How to access and write release notes for Jaypie packages.

## MCP Tools

```
release_notes("list")
release_notes("list", { package: "mcp" })
release_notes("list", { package: "jaypie", since_version: "1.0.0" })
release_notes("list", { cursor: "..." })
release_notes("read", { package: "mcp", version: "0.3.4" })
```

`list` returns 50 notes per page by default (`limit`, maximum 200). When more notes exist, the last line is a `Next page` footer with a `cursor` that continues the same listing.

## Directory Structure

```
packages/mcp/release-notes/
├── jaypie/
│   └── 1.2.3.md
├── mcp/
│   └── 0.3.4.md
└── testkit/
    └── 2.0.0.md
```

## File Format

Create `release-notes/<package>/<version>.md`:

```yaml
---
version: 0.3.4
date: 2025-01-20
summary: Brief one-line summary for listing
---

## Changes

### New Features

- Feature description

### Bug Fixes

- Fix description

### Breaking Changes

- Breaking change description
```

## When to Add

Add release notes when:
- Bumping package version (required)
- Merging significant features
- Making breaking changes
- Fixing notable bugs

## Writing Guidelines

1. **Summary** - One line, present tense, describes the release
2. **Changes** - Group by type: New Features, Bug Fixes, Breaking Changes
3. **Bullets** - Start with verb (Add, Fix, Update, Remove)
4. **Links** - Reference issues/PRs when relevant

## Example

```markdown
---
version: 1.2.0
date: 2025-01-15
summary: Add streaming support for LLM providers
---

## Changes

### New Features

- Add streaming response support for Anthropic and OpenAI
- Add `onChunk` callback for real-time token processing

### Bug Fixes

- Fix timeout handling in concurrent requests

### Breaking Changes

- Remove deprecated `legacyMode` option
```
