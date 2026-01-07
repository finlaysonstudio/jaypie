---
description: Complete guide to @jaypie/dynamodb single-table design utilities including GSI patterns, key builders, and query functions
globs: packages/dynamodb/**
---

# Jaypie DynamoDB Package

Jaypie provides DynamoDB single-table design utilities through `@jaypie/dynamodb`. The package implements a five-GSI pattern for hierarchical data with named access patterns (not gsi1, gsi2, etc.).

## Installation

```bash
npm install @jaypie/dynamodb
```

## Core Concepts

### Single-Table Design

All entities share a single DynamoDB table with:
- **Primary Key**: `model` (partition) + `id` (sort)
- **Five GSIs**: All use `sequence` as sort key for chronological ordering

### Organizational Unit (OU)

The `ou` field creates hierarchical relationships:
- Root entities: `ou = "@"` (APEX constant)
- Child entities: `ou = "{parent.model}#{parent.id}"`

### GSI Pattern

| GSI Name | Partition Key | Use Case |
|----------|---------------|----------|
| `indexOu` | `{ou}#{model}` | List all entities under a parent |
| `indexAlias` | `{ou}#{model}#{alias}` | Human-friendly slug lookup |
| `indexClass` | `{ou}#{model}#{class}` | Category filtering |
| `indexType` | `{ou}#{model}#{type}` | Type filtering |
| `indexXid` | `{ou}#{model}#{xid}` | External system ID lookup |

## Client Initialization

Initialize once at application startup:

```typescript
import { initClient } from "@jaypie/dynamodb";

initClient({
  tableName: process.env.DYNAMODB_TABLE_NAME,
  region: process.env.AWS_REGION,           // Optional, defaults to us-east-1
  endpoint: process.env.DYNAMODB_ENDPOINT,  // Optional, for local dev
});
```

For local development with DynamoDB Local:

```typescript
initClient({
  tableName: "local-table",
  endpoint: "http://127.0.0.1:8100",
  // Credentials auto-detected for localhost endpoints
});
```

## Creating Entities

### FabricEntity Interface

All entities must implement `FabricEntity`:

```typescript
import type { FabricEntity } from "@jaypie/dynamodb";

interface MyRecord extends FabricEntity {
  // Primary Key (required)
  model: string;      // e.g., "record"
  id: string;         // UUID

  // Required fields
  name: string;
  ou: string;         // APEX or hierarchical
  sequence: number;   // Date.now()

  // Timestamps (ISO 8601)
  createdAt: string;
  updatedAt: string;
  deletedAt?: string; // Soft delete

  // Optional - trigger GSI population
  alias?: string;     // Human-friendly slug
  class?: string;     // Category
  type?: string;      // Type classification
  xid?: string;       // External ID
}
```

### Using populateIndexKeys

Always use `populateIndexKeys` before saving to auto-populate GSI keys:

```typescript
import { APEX, populateIndexKeys } from "@jaypie/dynamodb";

const now = new Date().toISOString();

const record = populateIndexKeys({
  model: "record",
  id: crypto.randomUUID(),
  name: "Daily Log",
  ou: APEX,
  sequence: Date.now(),
  alias: "2026-01-07",    // Optional
  class: "memory",        // Optional
  createdAt: now,
  updatedAt: now,
});

// Result includes:
// indexOu: "@#record"
// indexAlias: "@#record#2026-01-07"
// indexClass: "@#record#memory"
```

### Hierarchical Entities

Use `calculateOu` to derive OU from parent:

```typescript
import { calculateOu, populateIndexKeys } from "@jaypie/dynamodb";

// Parent reference
const chat = { model: "chat", id: "abc-123" };

// Calculate child OU
const messageOu = calculateOu(chat); // "chat#abc-123"

// Create child entity
const message = populateIndexKeys({
  model: "message",
  id: crypto.randomUUID(),
  name: "First message",
  ou: messageOu,
  sequence: Date.now(),
  createdAt: now,
  updatedAt: now,
});

// indexOu: "chat#abc-123#message"
```

## Query Functions

All queries filter soft-deleted records by default (`attribute_not_exists(deletedAt)`).

### queryByOu - List by Parent

List all entities of a model under a parent:

```typescript
import { APEX, queryByOu } from "@jaypie/dynamodb";

// Root-level records
const { items, lastEvaluatedKey } = await queryByOu(APEX, "record");

// Messages under a chat
const chatOu = "chat#abc-123";
const { items: messages } = await queryByOu(chatOu, "message");
```

### queryByAlias - Human-Friendly Lookup

Single entity lookup by slug:

```typescript
import { APEX, queryByAlias } from "@jaypie/dynamodb";

const record = await queryByAlias(APEX, "record", "2026-01-07");
// Returns entity or null
```

### queryByClass / queryByType - Category Filtering

```typescript
import { APEX, queryByClass, queryByType } from "@jaypie/dynamodb";

// All memory records
const { items } = await queryByClass(APEX, "record", "memory");

// All note-type records
const { items: notes } = await queryByType(APEX, "record", "note");
```

### queryByXid - External ID Lookup

Single entity lookup by external system ID:

```typescript
import { APEX, queryByXid } from "@jaypie/dynamodb";

const record = await queryByXid(APEX, "record", "ext-12345");
// Returns entity or null
```

### Query Options

```typescript
import type { QueryOptions } from "@jaypie/dynamodb";

const options: QueryOptions = {
  limit: 25,                // Max items to return
  ascending: true,          // Oldest first (default: false = newest first)
  includeDeleted: true,     // Include soft-deleted records
  startKey: lastEvaluatedKey, // Pagination cursor
};

const result = await queryByOu(APEX, "record", options);
```

### Pagination

```typescript
import { APEX, queryByOu } from "@jaypie/dynamodb";

let startKey: Record<string, unknown> | undefined;
const allItems: FabricEntity[] = [];

do {
  const { items, lastEvaluatedKey } = await queryByOu(APEX, "record", {
    limit: 100,
    startKey,
  });
  allItems.push(...items);
  startKey = lastEvaluatedKey;
} while (startKey);
```

## Key Builder Functions

Use these to construct GSI keys manually when needed:

```typescript
import {
  buildIndexOu,
  buildIndexAlias,
  buildIndexClass,
  buildIndexType,
  buildIndexXid,
} from "@jaypie/dynamodb";

buildIndexOu("@", "record");                    // "@#record"
buildIndexAlias("@", "record", "my-alias");     // "@#record#my-alias"
buildIndexClass("@", "record", "memory");       // "@#record#memory"
buildIndexType("@", "record", "note");          // "@#record#note"
buildIndexXid("@", "record", "ext-123");        // "@#record#ext-123"
```

## Constants

```typescript
import {
  APEX,           // "@" - Root-level marker
  SEPARATOR,      // "#" - Composite key separator
  INDEX_OU,       // "indexOu"
  INDEX_ALIAS,    // "indexAlias"
  INDEX_CLASS,    // "indexClass"
  INDEX_TYPE,     // "indexType"
  INDEX_XID,      // "indexXid"
} from "@jaypie/dynamodb";
```

## Table Schema (CloudFormation/CDK Reference)

```yaml
AttributeDefinitions:
  - AttributeName: model
    AttributeType: S
  - AttributeName: id
    AttributeType: S
  - AttributeName: indexOu
    AttributeType: S
  - AttributeName: indexAlias
    AttributeType: S
  - AttributeName: indexClass
    AttributeType: S
  - AttributeName: indexType
    AttributeType: S
  - AttributeName: indexXid
    AttributeType: S
  - AttributeName: sequence
    AttributeType: N

KeySchema:
  - AttributeName: model
    KeyType: HASH
  - AttributeName: id
    KeyType: RANGE

GlobalSecondaryIndexes:
  - IndexName: indexOu
    KeySchema:
      - AttributeName: indexOu
        KeyType: HASH
      - AttributeName: sequence
        KeyType: RANGE
    Projection:
      ProjectionType: ALL
  # Repeat for indexAlias, indexClass, indexType, indexXid
```

## Error Handling

Functions throw `ConfigurationError` if client is not initialized:

```typescript
import { getDocClient } from "@jaypie/dynamodb";

try {
  const client = getDocClient();
} catch (error) {
  // ConfigurationError: DynamoDB client not initialized. Call initClient() first.
}
```

## Testing

Mock implementations in `@jaypie/testkit`:

```typescript
import { vi } from "vitest";

vi.mock("@jaypie/dynamodb", async () => {
  const testkit = await import("@jaypie/testkit/mock");
  return testkit;
});

// Key builders and populateIndexKeys work correctly
// Query functions return empty results by default
// Use mockResolvedValue to customize query results

import { queryByOu } from "@jaypie/testkit/mock";
queryByOu.mockResolvedValue({
  items: [{ id: "123", name: "Test" }],
  lastEvaluatedKey: undefined,
});
```

## Best Practices

### Always Use populateIndexKeys

Never manually set `indexOu`, `indexAlias`, etc. Always use `populateIndexKeys`:

```typescript
// CORRECT
const entity = populateIndexKeys({
  model: "record",
  alias: "my-alias",
  // ...
});

// WRONG - manual index key assignment
const entity = {
  model: "record",
  alias: "my-alias",
  indexAlias: "@#record#my-alias", // Don't do this
};
```

### Use Meaningful Model Names

Model names are part of every key. Use short, descriptive names:

```typescript
// GOOD
{ model: "record" }
{ model: "message" }
{ model: "chat" }

// AVOID
{ model: "DailyLogRecord" }
{ model: "ChatMessage_v2" }
```

### Sequence for Ordering

Always set `sequence: Date.now()` for chronological ordering in GSI queries:

```typescript
const entity = populateIndexKeys({
  // ...
  sequence: Date.now(),  // Required for proper ordering
});
```

### Soft Delete Pattern

Use `deletedAt` instead of deleting records:

```typescript
// Soft delete
record.deletedAt = new Date().toISOString();
await updateRecord(record);

// Query excludes deleted by default
const { items } = await queryByOu(APEX, "record");

// Include deleted if needed
const { items: all } = await queryByOu(APEX, "record", {
  includeDeleted: true,
});
```
