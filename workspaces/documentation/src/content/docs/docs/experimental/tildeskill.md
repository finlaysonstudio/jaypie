---
title: "@jaypie/tildeskill"
---


**Prerequisites:** `npm install @jaypie/tildeskill`

**Status:** Experimental - APIs may change

## Overview

`@jaypie/tildeskill` provides a storage abstraction for skill/vocabulary documents with markdown frontmatter support. It's used internally by `@jaypie/mcp` for serving skill documentation to AI assistants.

## Installation

```bash
npm install @jaypie/tildeskill
```

## Quick Reference

### Core Exports

| Export | Purpose |
|--------|---------|
| `createSkillService` | Fabric service factory for skill lookup |
| `createDynamoDbStore` | DynamoDB store (import from `@jaypie/tildeskill/dynamodb`) |
| `createLayeredStore` | Compose multiple stores with namespace prefixes |
| `createMarkdownStore` | File-based store (reads .md files) |
| `createMemoryStore` | In-memory store (for testing) |
| `expandIncludes` | Expand included skills into content |
| `hashSkill` | sha256 hash of a skill record for change detection |
| `isValidAlias` | Check if alias is valid |
| `validateAlias` | Validate and normalize alias (throws on invalid) |
| `normalizeAlias` | Normalize alias to lowercase |
| `registerSkillModel` | Register the `skill` model and its category index |
| `syncSkills` | Copy one store into another |

### Types

| Type | Description |
|------|-------------|
| `SkillRecord` | Skill document with alias, content, description, includes, name, nicknames, related, tags |
| `SkillStore` | Store interface with delete, find, get, getByNickname, list, put, search methods |
| `DynamoDbStoreOptions` | Options for createDynamoDbStore (category) |
| `SyncSkillsResult` | Aliases added, removed, unchanged, and updated by syncSkills |
| `ListFilter` | Filter options for list (namespace, tag) |
| `LayeredStoreLayer` | Layer definition with namespace and store |
| `LayeredStoreOptions` | Options for createLayeredStore |

## Store Factories

### Markdown Store

Reads skill documents from a directory of markdown files:

```typescript
import { createMarkdownStore } from "@jaypie/tildeskill";

const store = createMarkdownStore({ path: "./skills" });

// Get a specific skill
const skill = await store.get("aws");
if (skill) {
  console.log(skill.alias);       // "aws"
  console.log(skill.description); // From frontmatter
  console.log(skill.content);     // Markdown body
  console.log(skill.related);     // ["errors", "lambda"]
}

// List all skills
const skills = await store.list();
skills.forEach(s => console.log(`${s.alias}: ${s.description}`));
```

### Memory Store

In-memory store for testing:

```typescript
import { createMemoryStore } from "@jaypie/tildeskill";

const store = createMemoryStore([
  { alias: "test", content: "# Test\n\nContent", description: "Test skill" },
  { alias: "another", content: "# Another", related: ["test"] },
]);

// Supports all store operations
const skill = await store.get("test");
await store.put({ alias: "new", content: "# New Skill" });
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

## Include Expansion

Compose skills by including other skills' content:

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

Features:
- Recursively expands nested includes
- Prevents circular references
- Skips missing includes silently

## Filtering and Search

```typescript
// Filter by namespace prefix
const kitSkills = await store.list({ namespace: "kit:" });

// Filter by tag
const cloudSkills = await store.list({ tag: "cloud" });

// Combined filters
const kitCloudSkills = await store.list({ namespace: "kit:", tag: "cloud" });

// Search across alias, name, description, content, and tags
const results = await store.search("lambda");

// Lookup by nickname (alternate alias)
const skill = await store.getByNickname("amazon");
```

## Skill File Format

Skill files use YAML frontmatter followed by markdown content:

```yaml
---
description: Brief description shown in skill listings
includes: base-skill, common-utils
name: Display Title
nicknames: alt-name, another-alias
related: alias1, alias2, alias3
tags: category1, category2
---

# Skill Title

Markdown content with documentation, code examples, etc.
```

### Frontmatter Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | `string` | Brief description for listings |
| `includes` | `string` | Comma-separated list of skills to auto-expand |
| `name` | `string` | Display title for the skill |
| `nicknames` | `string` | Comma-separated alternate lookup keys |
| `related` | `string` | Comma-separated list of related skill aliases |
| `tags` | `string` | Comma-separated categorization tags |

All frontmatter fields accept either comma-separated strings or YAML arrays.

## Validation Utilities

### isValidAlias

Check if an alias is valid without throwing:

```typescript
import { isValidAlias } from "@jaypie/tildeskill";

isValidAlias("my-skill");     // true
isValidAlias("my_skill");     // true
isValidAlias("skill123");     // true
isValidAlias("../../etc");    // false (path traversal)
isValidAlias("");             // false (empty)
isValidAlias("a".repeat(100)); // false (too long)
```

### validateAlias

Validate and normalize, throwing `BadRequestError` on invalid input:

```typescript
import { validateAlias } from "@jaypie/tildeskill";

validateAlias("Valid");       // returns "valid" (normalized)
validateAlias("MY-SKILL");    // returns "my-skill"
validateAlias("../bad");      // throws BadRequestError
```

### normalizeAlias

Normalize alias to lowercase (does not validate):

```typescript
import { normalizeAlias } from "@jaypie/tildeskill";

normalizeAlias("MY-Skill");   // "my-skill"
normalizeAlias("Test_123");   // "test_123"
```

## Testing

### With @jaypie/testkit

```typescript
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockTildeskill, restoreTildeskill } from "@jaypie/testkit";

describe("MyComponent", () => {
  beforeEach(() => {
    mockTildeskill();
  });

  afterEach(() => {
    restoreTildeskill();
  });

  it("works with mocked store", async () => {
    // Your tests here
  });
});
```

### Direct Memory Store

```typescript
import { createMemoryStore } from "@jaypie/tildeskill";

const testStore = createMemoryStore([
  { alias: "test", content: "# Test", description: "Test skill" },
]);

// Inject into your component/service
const service = createService({ store: testStore });
```

## Error Handling

```typescript
import { validateAlias } from "@jaypie/tildeskill";
import { BadRequestError } from "@jaypie/errors";

try {
  validateAlias("../malicious");
} catch (error) {
  if (error instanceof BadRequestError) {
    console.log("Invalid alias:", error.message);
  }
}
```

## Skill Service Factory

`createSkillService` wraps a `SkillStore` as a `fabricService`, compatible with MCP servers and `Llm.operate` toolkits:

```typescript
import { createSkillService, createMarkdownStore } from "@jaypie/tildeskill";

const store = createMarkdownStore({ path: "./skills" });
const skillService = createSkillService(store);

// Get skill content (with automatic expandIncludes)
const content = await skillService({ alias: "aws" });

// List all skills
const index = await skillService({ alias: "index" });
// or: await skillService()

// Invalid aliases throw BadRequestError; missing skills throw NotFoundError

// Use with fabricTool for Llm.operate
import { fabricTool } from "@jaypie/fabric/llm";
const { tool } = fabricTool({ service: skillService });
```

## Layered Stores

Compose multiple stores with namespace prefixes. Earlier layers win for single-result lookups:

```typescript
import { createLayeredStore, createMarkdownStore } from "@jaypie/tildeskill";

const layered = createLayeredStore({
  layers: [
    { namespace: "local", store: createMarkdownStore({ path: "./my-skills" }) },
    { namespace: "jaypie", store: createMarkdownStore({ path: "./jaypie-skills" }) },
  ],
});

await layered.get("aws");          // first layer wins → { alias: "local:aws", ... }
await layered.get("jaypie:aws");   // targets specific layer
await layered.find("skills");      // exact alias in any layer, then fallback
await layered.list();              // all layers, prefixed aliases
```

`find` checks every layer for an exact alias before it tries plural/singular fallback in any layer. With `local:test` and `jaypie:tests`, `find("tests")` returns `jaypie:tests`. Namespace-qualified aliases search only their own layer.

## Related

- [@jaypie/mcp](/docs/experimental/mcp/) - MCP server using tildeskill
- [@jaypie/fabric](/docs/experimental/fabric/) - Service patterns
- [@jaypie/testkit](/docs/packages/testkit/) - Testing utilities
