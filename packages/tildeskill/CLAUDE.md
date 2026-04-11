# @jaypie/tildeskill

Skill/vocabulary management with pluggable storage backends for AI assistants and documentation systems.

## Package Overview

This package provides a storage abstraction for skill/vocabulary documents with markdown frontmatter support. It enables:

- Loading skills from markdown files with YAML frontmatter
- In-memory storage for testing
- Layered composition of multiple stores with namespace prefixes
- Consistent alias normalization and validation
- Filtering by namespace and tags
- Searching across alias, name, description, content, and tags
- Include expansion for composable skills
- Plural/singular fallback lookup via `find()` and `getAlternativeSpellings()`

## Directory Structure

```
packages/tildeskill/
├── src/
│   ├── __tests__/           # Unit tests
│   │   ├── stores/          # Store-specific tests
│   │   │   ├── markdown.spec.ts
│   │   │   └── memory.spec.ts
│   │   ├── expandIncludes.spec.ts
│   │   ├── normalize.spec.ts
│   │   ├── validate.spec.ts
│   │   └── index.spec.ts
│   ├── core/                # Core utilities
│   │   ├── expandIncludes.ts  # Include expansion utility
│   │   ├── normalize.ts       # normalizeAlias, parseList
│   │   └── validate.ts        # isValidAlias, validateAlias
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
  alias: string; // Lookup key (normalized lowercase)
  content: string; // Markdown body
  description?: string; // Brief description from frontmatter
  includes?: string[]; // Auto-expand these skill aliases on lookup
  name?: string; // Display title for the skill
  nicknames?: string[]; // Alternate lookup keys for getByNickname
  related?: string[]; // Related skill aliases
  tags?: string[]; // Categorization tags
}

interface ListFilter {
  namespace?: string; // Namespace prefix matching (e.g., "kit:*")
  tag?: string; // Filter by tag
}

interface SkillStore {
  find(alias: string): Promise<SkillRecord | null>;
  get(alias: string): Promise<SkillRecord | null>;
  getByNickname(nickname: string): Promise<SkillRecord[]>;
  list(filter?: ListFilter): Promise<SkillRecord[]>;
  put(record: SkillRecord): Promise<SkillRecord>;
  search(term: string): Promise<SkillRecord[]>;
}
```

### Store Factories

```typescript
import {
  createLayeredStore,
  createMarkdownStore,
  createMemoryStore,
} from "@jaypie/tildeskill";

// File-based store (reads .md files from directory)
const store = createMarkdownStore({ path: "./skills" });

// In-memory store (for testing)
const testStore = createMemoryStore([
  { alias: "test", content: "# Test\n\nContent" },
]);

// Layered store — compose multiple child stores with namespace prefixes.
// Earlier layers win for single-result lookups; aggregate methods merge
// every layer. Records come back namespaced (e.g., "local:aws").
const layered = createLayeredStore({
  layers: [
    { namespace: "local", store: createMarkdownStore({ path: "./my-skills" }) },
    {
      namespace: "jaypie",
      store: createMarkdownStore({ path: "./jaypie-skills" }),
    },
  ],
});
```

### Include Expansion

```typescript
import { expandIncludes, createMemoryStore } from "@jaypie/tildeskill";

const store = createMemoryStore([
  { alias: "base", content: "Base content" },
  { alias: "main", content: "Main content", includes: ["base"] },
]);

const record = await store.get("main");
const expanded = await expandIncludes(store, record);
// expanded = "Base content\n\nMain content"
```

### Validation Utilities

```typescript
import {
  isValidAlias,
  validateAlias,
  normalizeAlias,
} from "@jaypie/tildeskill";

isValidAlias("my-skill"); // true
isValidAlias("../../etc"); // false

normalizeAlias("MY-Skill"); // "my-skill"

validateAlias("valid"); // returns "valid" (normalized)
validateAlias("../bad"); // throws BadRequestError
```

## Skill File Format

Skill files use YAML frontmatter:

```yaml
---
description: Brief description shown in listings
includes: base-skill, common-utils
name: Display Title
nicknames: alt-name, another-alias
related: alias1, alias2, alias3
tags: category1, category2
---
# Skill Title

Markdown content...
```

All frontmatter fields accept either comma-separated strings or YAML arrays.

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
skills.forEach((s) => console.log(`${s.alias}: ${s.description}`));
```

### Layered Store Semantics

```typescript
const layered = createLayeredStore({
  layers: [
    { namespace: "local", store: localStore },
    { namespace: "jaypie", store: jaypieStore },
  ],
});

// Bare alias walks layers; first match wins. Returned alias is namespaced.
const hit = await layered.get("aws"); // { alias: "local:aws", ... }

// Namespace-qualified alias targets a specific layer directly.
const jaypieAws = await layered.get("jaypie:aws");

// find() uses per-layer plural/singular fallback.
const skill = await layered.find("skills"); // resolves "local:skill" etc.

// list() merges every layer with namespaced aliases.
await layered.list(); // [{ alias: "jaypie:aws", ... }, { alias: "local:aws", ... }]

// put() requires a namespace-qualified alias; routes to that layer.
await layered.put({ alias: "local:new", content: "# New" });
```

### Plural/Singular Fallback Lookup

```typescript
// find() tries an exact match, then plural/singular alternatives
const skill = await store.find("skills"); // resolves skill.md
if (skill && skill.alias !== "skills") {
  console.log(`Resolved via fallback to ${skill.alias}`);
}

// getAlternativeSpellings() returns the candidate list directly
import { getAlternativeSpellings } from "@jaypie/tildeskill";
getAlternativeSpellings("skills"); // ["skill"]
getAlternativeSpellings("indexes"); // ["indexe", "index"]
getAlternativeSpellings("fish"); // ["fishs", "fishes"]
```

### Lookup by Nickname

```typescript
// Skills can have alternate lookup keys. getByNickname() returns every
// record whose nicknames list contains the query — useful when several
// layers, or several records, share the same nickname (e.g., "sparticus").
const matches = await store.getByNickname("amazon");
matches.forEach((record) => console.log(record.alias));
```

### Filtering

```typescript
// Filter by namespace prefix
const kitSkills = await store.list({ namespace: "kit:" });
// Returns skills like kit:utils, kit:helpers

// Filter by tag
const cloudSkills = await store.list({ tag: "cloud" });

// Combined filters
const kitCloudSkills = await store.list({ namespace: "kit:", tag: "cloud" });
```

### Searching

```typescript
// Search across alias, name, description, content, and tags
const results = await store.search("lambda");
```

### Include Expansion

```typescript
import { expandIncludes } from "@jaypie/tildeskill";

// Expand includes for composable skills
const skill = await store.get("aws-guide");
const fullContent = await expandIncludes(store, skill);
// Returns skill content with all included skills prepended
```

Features:

- Recursively expands nested includes
- Prevents circular references
- Skips missing includes silently

### Testing with Memory Store

```typescript
import { createMemoryStore } from "@jaypie/tildeskill";

const store = createMemoryStore([
  { alias: "test", content: "# Test", description: "Test skill" },
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
