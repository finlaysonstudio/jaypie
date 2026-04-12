---
sidebar_position: 1
---

# @jaypie/dynamodb


**Prerequisites:** `npm install @jaypie/dynamodb`

**Status:** Experimental - APIs may change

## Overview

`@jaypie/dynamodb` provides single-table DynamoDB utilities with model-keyed GSIs, hierarchical scoping, and soft delete.

## Installation

```bash
npm install @jaypie/dynamodb
```

## Quick Reference

### Entity Operations

| Function | Purpose |
|----------|---------|
| `putEntity` | Create new entity |
| `getEntity` | Read entity by ID |
| `updateEntity` | Update entity fields |
| `deleteEntity` | Soft delete (mark deleted) |
| `archiveEntity` | Archive (exclude from queries) |
| `destroyEntity` | Hard delete (permanent) |

### Query Functions

| Function | Purpose |
|----------|---------|
| `queryByScope` | Query by model, optionally narrowed by scope |
| `queryByAlias` | Query by alias |
| `queryByCategory` | Query by category |
| `queryByType` | Query by type |
| `queryByXid` | Query by external ID |

### Seed and Export Functions

| Function | Purpose |
|----------|---------|
| `seedEntityIfNotExists` | Seed single entity if not exists |
| `seedEntities` | Bulk seed with idempotency |
| `exportEntities` | Export entities by model/scope |
| `exportEntitiesToJson` | Export as JSON string |

## StorableEntity Interface

All entities implement this interface:

```typescript
interface StorableEntity {
  id: string;           // Primary key (UUID)
  model: string;        // Entity model name (e.g., "user", "order")
  scope: string;        // APEX ("@") or "{parent.model}#{parent.id}"

  name?: string;        // Human-readable name
  alias?: string;       // Human-friendly slug
  category?: string;    // Category for filtering
  type?: string;        // Type for filtering
  xid?: string;         // External ID

  createdAt?: string;   // Backfilled by indexEntity
  updatedAt?: string;   // Managed by indexEntity on every write
  archivedAt?: string;  // Set by archiveEntity
  deletedAt?: string;   // Set by deleteEntity

  state?: Record<string, unknown>;
  [key: string]: unknown;
}
```

## Table Structure

### Primary Key

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | PK | UUID — sole primary key (no sort key) |

### GSI Pattern

GSIs are defined using `fabricIndex()` from `@jaypie/fabric`. All GSIs use a composite sort key of `scope#updatedAt`.

| GSI Name | PK Pattern | SK Attribute | Purpose |
|----------|-----------|--------------|---------|
| `indexModel` | `{model}` | `indexModelSk` = `{scope}#{updatedAt}` | List by model |
| `indexModelAlias` | `{model}#{alias}` (sparse) | `indexModelAliasSk` | Slug lookup |
| `indexModelCategory` | `{model}#{category}` (sparse) | `indexModelCategorySk` | Category filter |
| `indexModelType` | `{model}#{type}` (sparse) | `indexModelTypeSk` | Type filter |
| `indexModelXid` | `{model}#{xid}` (sparse) | `indexModelXidSk` | External ID lookup |

## Entity Operations

### Create Entity

```typescript
import { APEX, putEntity } from "@jaypie/dynamodb";

// indexEntity auto-populates GSI keys, createdAt, updatedAt
const user = await putEntity({
  entity: {
    model: "user",
    id: crypto.randomUUID(),
    scope: APEX,
    name: "Alice",
    email: "alice@example.com",
  },
});
```

### Read Entity

```typescript
import { getEntity } from "@jaypie/dynamodb";

// Primary key is id only
const user = await getEntity({ id: "user-123" });
```

### Update Entity

```typescript
import { updateEntity } from "@jaypie/dynamodb";

const updated = await updateEntity({
  entity: { ...user, name: "Alice Smith" },
});
```

### Soft Delete

```typescript
import { deleteEntity } from "@jaypie/dynamodb";

await deleteEntity({ id: "user-123" });
// Sets deletedAt, re-indexes with #deleted suffix on GSI pk
```

### Hard Delete

```typescript
import { destroyEntity } from "@jaypie/dynamodb";

await destroyEntity({ id: "user-123" });
// Permanently removes entity
```

## Query Patterns

### Query by Model and Scope

```typescript
import { APEX, queryByScope } from "@jaypie/dynamodb";

// Get all entities of a model at root scope
const { items } = await queryByScope({ model: "user", scope: APEX });

// Scope is optional — omit to query across all scopes
const { items: allUsers } = await queryByScope({ model: "user" });

// Get entities under a parent
const { items: childEntities } = await queryByScope({
  model: "order",
  scope: "user#user-123",
});
```

### Hierarchical Structure

```
@                          # Root scope (APEX)
├── user#alice-123         # User's items
│   ├── order#order-1
│   └── order#order-2
└── user#bob-456           # Another user's items
    └── order#order-3
```

### Query by Type

```typescript
import { queryByType } from "@jaypie/dynamodb";

// Requires fabricIndex("type") registered for the model
const { items } = await queryByType({
  model: "user",
  type: "premium",
});
```

### Pagination

```typescript
const { items, lastEvaluatedKey } = await queryByScope({
  model: "user",
  scope: APEX,
  limit: 10,
});

// Next page
const nextPage = await queryByScope({
  model: "user",
  scope: APEX,
  limit: 10,
  startKey: lastEvaluatedKey,
});
```

## Index Entity

Auto-populate GSI attributes and timestamps:

```typescript
import { indexEntity } from "@jaypie/dynamodb";

const entity = {
  model: "user",
  id: "user-123",
  scope: "@",
  email: "alice@example.com",
  type: "premium",
};

const indexed = indexEntity(entity);
// Sets updatedAt, backfills createdAt, populates indexModel, indexModelSk, etc.
```

## CDK Integration

```typescript
import { JaypieDynamoDb } from "@jaypie/constructs";
import { fabricIndex } from "@jaypie/fabric";

// Basic table (no GSIs by default)
new JaypieDynamoDb(this, "myApp");

// With indexes
new JaypieDynamoDb(this, "myApp", {
  indexes: [
    fabricIndex(),           // indexModel
    fabricIndex("alias"),    // indexModelAlias (sparse)
  ],
});
```

## Seed and Export

Utilities for bootstrapping and migrating data.

### Seed Entities

```typescript
import { APEX, seedEntities, seedEntityIfNotExists } from "@jaypie/dynamodb";

// Seed single entity if not exists
const created = await seedEntityIfNotExists({
  alias: "config-main",
  model: "config",
  scope: APEX,
});
// Returns true if created, false if exists

// Bulk seed with idempotency
const result = await seedEntities([
  { alias: "en", model: "lang", scope: APEX },
  { alias: "es", model: "lang", scope: APEX },
]);
// result.created: ["en", "es"]
// result.skipped: [] (existing entities)
// result.errors: []

// Options
await seedEntities(entities, { dryRun: true });  // Preview
await seedEntities(entities, { replace: true }); // Overwrite
```

### Export Entities

```typescript
import { APEX, exportEntities, exportEntitiesToJson } from "@jaypie/dynamodb";

// Export entities
const { entities, count } = await exportEntities("lang", APEX);

// With limit
const { entities: limited } = await exportEntities("lang", APEX, 10);

// Export as JSON
const json = await exportEntitiesToJson("lang", APEX);        // Pretty
const compact = await exportEntitiesToJson("lang", APEX, false); // Compact
```

## MCP Tools

Local development tools via `@jaypie/mcp`:

- `dynamodb_query` - Query entities
- `dynamodb_get` - Get single entity
- `dynamodb_put` - Create entity
- `dynamodb_update` - Update entity
- `dynamodb_delete` - Delete entity

## Related

- [CDK Infrastructure](/docs/guides/cdk-infrastructure) - DynamoDB construct
- [@jaypie/constructs](/docs/packages/constructs) - JaypieDynamoDb
