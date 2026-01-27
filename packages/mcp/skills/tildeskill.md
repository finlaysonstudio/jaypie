---
description: Skill/vocabulary storage with pluggable backends (pre-1.0)
related: fabric, mcp, tools
---

# @jaypie/tildeskill

Skill/vocabulary management with pluggable storage backends for AI assistants and documentation systems.

## Overview

This package provides a storage abstraction for skill/vocabulary documents with markdown frontmatter support. It enables:
- Loading skills from markdown files with YAML frontmatter
- In-memory storage for testing
- Consistent alias normalization and validation

## Installation

```bash
npm install @jaypie/tildeskill
```

## Core Types

```typescript
interface SkillRecord {
  alias: string;              // Lookup key (normalized lowercase)
  content: string;            // Markdown body
  description?: string;       // Brief description from frontmatter
  related?: string[];         // Related skill aliases
}

interface SkillStore {
  get(alias: string): Promise<SkillRecord | null>;
  list(): Promise<SkillRecord[]>;
  put(record: SkillRecord): Promise<SkillRecord>;
}
```

## Store Factories

### Markdown Store (File-based)

```typescript
import { createMarkdownStore } from "@jaypie/tildeskill";

const store = createMarkdownStore({ path: "./skills" });

// Get a specific skill
const skill = await store.get("aws");
if (skill) {
  console.log(skill.content);
}

// List all skills
const skills = await store.list();
skills.forEach(s => console.log(`${s.alias}: ${s.description}`));
```

### Memory Store (Testing)

```typescript
import { createMemoryStore } from "@jaypie/tildeskill";

const store = createMemoryStore([
  { alias: "test", content: "# Test\n\nContent", description: "Test skill" }
]);

const skill = await store.get("test");
```

## Validation Utilities

```typescript
import { isValidAlias, validateAlias, normalizeAlias } from "@jaypie/tildeskill";

// Check validity
isValidAlias("my-skill");     // true
isValidAlias("../../etc");    // false (path traversal)

// Normalize to lowercase
normalizeAlias("MY-Skill");   // "my-skill"

// Validate and normalize (throws on invalid)
validateAlias("valid");       // returns "valid"
validateAlias("../bad");      // throws BadRequestError
```

## Skill File Format

Skill files use YAML frontmatter:

```yaml
---
description: Brief description shown in listings
related: alias1, alias2, alias3
---

# Skill Title

Markdown content...
```

## Testing with Mocks

```typescript
import { mockTildeskill, restoreTildeskill } from "@jaypie/testkit";

beforeEach(() => {
  mockTildeskill();
});

afterEach(() => {
  restoreTildeskill();
});
```

## See Also

- **`skill("fabric")`** - Service patterns that use tildeskill
- **`skill("mcp")`** - MCP server that uses tildeskill for skill storage
