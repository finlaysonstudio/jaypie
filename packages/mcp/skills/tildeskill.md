---
description: Skill/vocabulary storage with pluggable backends (pre-1.0)
related: fabric, mcp
---

# @jaypie/tildeskill

Skill/vocabulary management with pluggable storage backends for AI assistants and documentation systems.

## Overview

This package provides a storage abstraction for skill/vocabulary documents with markdown frontmatter support. It enables:

- Loading skills from markdown files with YAML frontmatter
- In-memory storage for testing
- Layered composition of multiple stores with namespace prefixes
- Consistent alias normalization and validation
- Filtering by namespace and tags
- Searching across alias, name, description, content, and tags
- Include expansion for composable skills
- Plural/singular fallback lookup via `find()` and `getAlternativeSpellings()`

## Installation

```bash
npm install @jaypie/tildeskill
```

## Core Types

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
skills.forEach((s) => console.log(`${s.alias}: ${s.description}`));
```

### Memory Store (Testing)

```typescript
import { createMemoryStore } from "@jaypie/tildeskill";

const store = createMemoryStore([
  { alias: "test", content: "# Test\n\nContent", description: "Test skill" },
]);

const skill = await store.get("test");
```

## Include Expansion

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

## Filtering and Search

```typescript
// Filter by namespace prefix
const kitSkills = await store.list({ namespace: "kit:" });

// Filter by tag
const cloudSkills = await store.list({ tag: "cloud" });

// Search across alias, name, description, content, and tags
const results = await store.search("lambda");

// Lookup by nickname — returns every matching record, so a name like
// "sparticus" can resolve to multiple skills across layers.
const matches = await store.getByNickname("amazon");
```

## Layered Stores

```typescript
import { createLayeredStore, createMarkdownStore } from "@jaypie/tildeskill";

// Compose multiple stores with namespace prefixes. Earlier layers win
// for single-result lookups; aggregate methods merge every layer.
const layered = createLayeredStore({
  layers: [
    { namespace: "local", store: createMarkdownStore({ path: "./my-skills" }) },
    {
      namespace: "jaypie",
      store: createMarkdownStore({ path: "./jaypie-skills" }),
    },
  ],
});

await layered.get("aws"); // → { alias: "local:aws", ... }
await layered.get("jaypie:aws"); // → { alias: "jaypie:aws", ... }
await layered.find("skills"); // per-layer plural fallback
await layered.list(); // prefixed aliases from every layer
await layered.put({ alias: "local:new", content: "# New" }); // must be qualified
```

The MCP server itself uses `createLayeredStore` to place `MCP_SKILLS_PATH`
(the client's local library, namespace `local`) over the bundled Jaypie
skills (namespace `jaypie`). Set `MCP_BUILTIN_SKILLS_PATH` if a bundler
needs to relocate the Jaypie base layer.

## Plural/Singular Fallback

```typescript
// find() tries exact match then plural/singular alternatives
const skill = await store.find("skills"); // resolves skill.md
// skill.alias is the canonical filename; compare to the input to detect fallback

import { getAlternativeSpellings } from "@jaypie/tildeskill";
getAlternativeSpellings("skills"); // ["skill"]
getAlternativeSpellings("indexes"); // ["indexe", "index"]
getAlternativeSpellings("fish"); // ["fishs", "fishes"]
```

## Validation Utilities

```typescript
import {
  isValidAlias,
  validateAlias,
  normalizeAlias,
} from "@jaypie/tildeskill";

// Check validity
isValidAlias("my-skill"); // true
isValidAlias("../../etc"); // false (path traversal)

// Normalize to lowercase
normalizeAlias("MY-Skill"); // "my-skill"

// Validate and normalize (throws on invalid)
validateAlias("valid"); // returns "valid"
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
