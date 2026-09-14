---
description: Skill/vocabulary storage with pluggable backends (pre-1.0)
related: dynamodb, fabric, mcp
---

# @jaypie/tildeskill

Skill/vocabulary management with pluggable storage backends for AI assistants and documentation systems.

## Overview

This package provides a storage abstraction for skill/vocabulary documents with markdown frontmatter support. It enables:

- Loading skills from markdown files with YAML frontmatter
- In-memory storage for testing
- Layered composition of multiple stores with namespace prefixes
- DynamoDB storage through the `@jaypie/tildeskill/dynamodb` subpath
- Store-to-store sync with `syncSkills`
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
  delete(alias: string): Promise<boolean>;
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

## DynamoDB Store

```typescript
import { initClient } from "@jaypie/dynamodb";
import { createSkillService } from "@jaypie/tildeskill";
import { createDynamoDbStore } from "@jaypie/tildeskill/dynamodb";

initClient();
const store = createDynamoDbStore({ category: "jaypie" });
const skillService = createSkillService(store);
```

`@jaypie/dynamodb` is an optional peer dependency. Only the
`@jaypie/tildeskill/dynamodb` subpath imports it, so markdown-only consumers
never load it. Call `initClient()` before using the store.

- Records are `skill` entities at APEX scope. `category` is the store
  namespace; `alias` is unqualified.
- Ids are deterministic: `uuidv5("<category>:<alias>", SKILL_NAMESPACE)`.
  `SKILL_NAMESPACE` is exported from the subpath and never changes.
- `metadata.hash` holds `hashSkill(record)` (sha256) for change detection.
- `includes`, `nicknames`, and `related` are stored in `metadata`, since
  `related` is reserved for entity references.
- `list`, `getByNickname`, and `search` query `indexModelCategory`.
  `createDynamoDbStore` calls `registerSkillModel()`; declare the index in CDK
  by calling `registerSkillModel()` before `getAllRegisteredIndexes()`.
- `find` keeps the plural/singular fallback.
- `delete` soft deletes with `deleteEntity`. Reads skip archived and deleted
  entities, and a later `put` restores the same id.

## Syncing Stores

```typescript
import { createMarkdownStore, syncSkills } from "@jaypie/tildeskill";

const result = await syncSkills({
  from: createMarkdownStore({ path: "./skills" }),
  to: store,
});
// { added: ["aws"], removed: ["retired"], unchanged: ["tests"], updated: [] }
```

`syncSkills` makes `to` match `from`. It puts records missing from `to`
(`added`) or whose `hashSkill` differs (`updated`), skips records whose hash
matches (`unchanged`), and deletes records missing from `from` (`removed`).
Each list holds aliases sorted alphabetically. An empty `from` removes every
record in `to`; a markdown store pointed at a missing directory lists nothing.

## Deleting Records

Every store implements `delete(alias)`. It matches the exact alias (no
plural/singular fallback) and returns `true` when a record was removed and
`false` when none existed.

| Store | `delete` behavior |
|-------|-------------------|
| memory | Removes the record from the map |
| markdown | Removes `<alias>.md`; throws `BadRequestError` for an invalid alias |
| layered | Requires a namespace-qualified alias and delegates to that layer; throws `ConfigurationError` when unqualified |
| dynamodb | Soft deletes the entity; reads skip it and `put` restores it |

## Skill Service Factory

```typescript
import { createSkillService, createMemoryStore } from "@jaypie/tildeskill";

const store = createMemoryStore([
  { alias: "aws", content: "# AWS docs", description: "AWS guide" },
]);

// Returns a fabricService — works with MCP, Llm.operate, or direct calls
const skillService = createSkillService(store);

await skillService({ alias: "aws" }); // → skill content (with expandIncludes)
await skillService({ alias: "index" }); // → formatted listing
await skillService(); // → same as "index"
await skillService({ alias: "missing" }); // throws NotFoundError
await skillService({ alias: "../bad" }); // throws BadRequestError

// Use with fabricTool for Llm.operate toolkits
import { fabricTool } from "@jaypie/fabric/llm";
const { tool } = fabricTool({ service: skillService });
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
await layered.find("skills"); // exact alias in any layer, then fallback
await layered.list(); // prefixed aliases from every layer
await layered.put({ alias: "local:new", content: "# New" }); // must be qualified
```

`find` checks every layer for an exact alias before it tries plural/singular
fallback in any layer. With `local:test` and `jaypie:tests`, `find("tests")`
returns `jaypie:tests`, so a local skill cannot shadow a Jaypie skill under a
different spelling. Namespace-qualified aliases search only their own layer.

The MCP server itself uses `createLayeredStore` to place `MCP_SKILLS_PATH`
(the client's local library, namespace `local`) over the bundled Jaypie
skills (namespace `jaypie`). A bundled build finds the Jaypie base layer in
`skills/` beside the bundle, or at `MCP_BUILTIN_SKILLS_PATH`; see
`skill("mcp")` for the copy step.

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
