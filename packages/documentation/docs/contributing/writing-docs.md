---
sidebar_position: 3
---

# Writing Documentation

**Use this page when:** contributing documentation to Jaypie, writing prompt guides, or maintaining README files.

**Prerequisites:** Familiarity with Markdown

## Overview

Jaypie documentation is written for coding agents as the primary audience. Documentation must be self-contained, explicit, and directly usable.

## Documentation Types

| Type | Location | Audience |
|------|----------|----------|
| Package README | `packages/*/README.md` | Developers, npm |
| API Docs | `docs/` (Docusaurus) | Agents, developers |
| Prompt Guides | `packages/mcp/prompts/` | AI agents |
| CLAUDE.md | Project root | AI agents |

## Page Template

```markdown
---
sidebar_position: N
---

# Page Title

**Use this page when:** [1-2 sentence trigger for when to read this]

**Prerequisites:** [packages to install, files that must exist]

## Overview

[2-3 sentences explaining what this covers]

## Quick Reference

[Table or bulleted list of key concepts]

## Usage

[Complete, copy-pasteable code examples]

## API Reference

[Types, parameters, return values in tables]

## Related

- [Link](/docs/path) - brief description
```

## Writing Style

### Crisp and Declarative

```markdown
<!-- Good -->
Use `expressHandler` to wrap route handlers.

<!-- Bad -->
You should probably use the expressHandler function when you want to wrap your route handlers.
```

### Tables Over Prose

```markdown
<!-- Good -->
| Error | Status | Use Case |
|-------|--------|----------|
| `BadRequestError` | 400 | Invalid input |

<!-- Bad -->
The BadRequestError is used when input is invalid and returns a 400 status code.
```

### Complete Examples

```markdown
<!-- Good - complete and runnable -->
```typescript
import { expressHandler, NotFoundError } from "jaypie";

export default expressHandler(async (req, res) => {
  const user = await db.users.findById(req.params.id);
  if (!user) throw NotFoundError();
  return { data: user };
});
```

<!-- Bad - incomplete snippet -->
```typescript
throw NotFoundError();
```
```

## Code Blocks

### Language Tags

Always include language:

```markdown
```typescript
const x = 1;
```
```

### Comments Sparingly

```typescript
// Only comment non-obvious code
const GOLDEN_RATIO = 0.618; // Jaypie uses this for "partial" defaults
```

## README Structure

```markdown
# Package Name

Brief description.

## Installation

## Quick Start

## Usage

[Main usage patterns]

## API

[Function signatures and types]

## Related

[Links to related packages]
```

## Prompt Guide Structure

```markdown
# Guide Title

## Purpose
[When to use this guide]

## Prerequisites
[What must exist]

## Steps
[Numbered steps with code blocks]

## Verification
[How to verify success]

## Troubleshooting
[Common issues and solutions]
```

## Formatting Rules

### One Sentence Per Line

For version control diffs:

```markdown
<!-- Good -->
Jaypie provides error handling.
Errors format as JSON:API.
Use NotFoundError for 404 responses.

<!-- Bad -->
Jaypie provides error handling. Errors format as JSON:API. Use NotFoundError for 404 responses.
```

### Headings

- `#` for page title only
- `##` for major sections
- `###` for subsections
- Don't skip levels

### Lists

Use `-` for unordered lists:

```markdown
- First item
- Second item
- Third item
```

Use numbers for ordered lists:

```markdown
1. First step
2. Second step
3. Third step
```

## Links

### Internal Links

```markdown
[Error Handling](/docs/core/error-handling)
```

### External Links

```markdown
[GitHub](https://github.com/finlaysonstudio/jaypie)
```

## Tables

Align columns for readability:

```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Value 1  | Value 2  | Value 3  |
```

## Agent-Specific Patterns

### Explicit Prerequisites

```markdown
**Prerequisites:**
- `npm install jaypie`
- Express app configured
- AWS credentials set
```

### Self-Contained Examples

Don't assume context. Include imports:

```typescript
// Good - complete
import { expressHandler, log, NotFoundError } from "jaypie";

export default expressHandler(async (req, res) => {
  log.trace("[getUser] fetching");
  const user = await db.users.findById(req.params.id);
  if (!user) throw NotFoundError();
  return { data: user };
});
```

### Cross-References

Link related pages:

```markdown
## Related

- [Handler Lifecycle](/docs/core/handler-lifecycle) - Lifecycle phases
- [Testing](/docs/guides/testing) - Testing handlers
```

## Related

- [Project Structure](/docs/architecture/project-structure) - Documentation location
- [Development Process](/docs/contributing/development-process) - Contribution workflow
