# @jaypie/tildeskill

Skill/vocabulary management with pluggable storage backends for AI assistants and documentation systems.

## Package Overview

This package provides a storage abstraction for skill/vocabulary documents with markdown frontmatter support. It enables:
- Loading skills from markdown files with YAML frontmatter
- In-memory storage for testing
- Consistent alias normalization and validation

## Directory Structure

```
packages/tildeskill/
├── src/
│   ├── __tests__/           # Unit tests
│   │   ├── stores/          # Store-specific tests
│   │   │   ├── markdown.spec.ts
│   │   │   └── memory.spec.ts
│   │   ├── normalize.spec.ts
│   │   ├── validate.spec.ts
│   │   └── index.spec.ts
│   ├── core/                # Core utilities
│   │   ├── normalize.ts     # normalizeAlias, parseList
│   │   └── validate.ts      # isValidAlias, validateAlias
│   ├── stores/              # Storage backends
│   │   ├── markdown.ts      # createMarkdownStore
│   │   └── memory.ts        # createMemoryStore
│   ├── types.ts             # TypeScript interfaces
│   └── index.ts             # Main exports
└── dist/                    # Built output
```

## Key Exports

### Types

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

### Store Factories

```typescript
import { createMarkdownStore, createMemoryStore } from "@jaypie/tildeskill";

// File-based store (reads .md files from directory)
const store = createMarkdownStore({ path: "./skills" });

// In-memory store (for testing)
const testStore = createMemoryStore([
  { alias: "test", content: "# Test\n\nContent" }
]);
```

### Validation Utilities

```typescript
import { isValidAlias, validateAlias, normalizeAlias } from "@jaypie/tildeskill";

isValidAlias("my-skill");     // true
isValidAlias("../../etc");    // false

normalizeAlias("MY-Skill");   // "my-skill"

validateAlias("valid");       // returns "valid" (normalized)
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

## Usage Patterns

### Basic Usage

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

### Testing with Memory Store

```typescript
import { createMemoryStore } from "@jaypie/tildeskill";

const store = createMemoryStore([
  { alias: "test", content: "# Test", description: "Test skill" }
]);

// Use in tests
const skill = await store.get("test");
```

## Commands

```bash
npm run build      # Build with rollup
npm run test       # vitest run
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run format     # eslint --fix
```

## Dependencies

- `@jaypie/errors` - Error types for validation failures
- `gray-matter` - YAML frontmatter parsing
