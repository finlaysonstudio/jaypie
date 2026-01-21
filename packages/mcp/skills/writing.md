---
description: Documentation and writing style
---

# Writing Style

Guidelines for writing Jaypie documentation.

## Principles

1. **Concise** - Fewer words, more clarity
2. **Scannable** - Use headings, lists, tables
3. **Actionable** - Show, don't tell
4. **Current** - Keep examples up to date

## Formatting

### Headings

```markdown
# Page Title (H1 - one per file)
## Major Section (H2)
### Subsection (H3)
```

### Code Blocks

Always specify language:

```typescript
import { log } from "jaypie";
log.info("Message", { context });
```

### Lists

Use bullets for unordered items:
- First item
- Second item

Use numbers for sequential steps:
1. First step
2. Second step

### Tables

Use for structured comparisons:

| Option | Description |
|--------|-------------|
| `verbose` | Enable verbose logging |
| `timeout` | Request timeout in ms |

## Voice

- **Active voice**: "Run the command" not "The command should be run"
- **Present tense**: "Returns a string" not "Will return a string"
- **Second person**: "You can configure" not "Users can configure"
- **Imperative mood**: "Create a file" not "You should create a file"

## Code Examples

### Good Example

```typescript
// Clear purpose
import { NotFoundError } from "jaypie";

throw new NotFoundError("User not found");
```

### Bad Example

```typescript
// Avoid: no explanation, poor naming
import { NotFoundError } from "jaypie";
const e = new NotFoundError("err");
throw e;
```

## Structure

### Skill Files

```markdown
---
description: Brief description for index listing
related: alias1, alias2
---

# Skill Title

One sentence overview.

## Quick Start

Minimal working example.

## Details

Deeper explanation with examples.

## Reference

Tables, options, API details.
```

### README Files

```markdown
# Package Name

One-line description.

## Installation

\`\`\`bash
npm install package-name
\`\`\`

## Usage

\`\`\`typescript
import { feature } from "package-name";
feature();
\`\`\`

## API

Document exports.

## License

MIT
```

## Anti-Patterns

Avoid:
- Long paragraphs (use lists)
- Vague language ("various", "etc.")
- Redundant words ("in order to" → "to")
- Future promises ("will be added")
- Passive voice ("is used by" → "uses")

## Checklist

Before publishing:
- [ ] Code examples run without errors
- [ ] All links work
- [ ] No placeholder text
- [ ] Spelling and grammar checked
- [ ] Frontmatter complete
