---
sidebar_position: 1
---

# @jaypie/dynamodb


**Prerequisites:** `npm install @jaypie/dynamodb`

**Status:** Experimental - APIs may change

## Overview

`@jaypie/dynamodb` provides single-table DynamoDB utilities with a five-GSI pattern for flexible query access patterns.

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
| `queryByOu` | Query by organizational unit |
| `queryByAlias` | Query by alias |
| `queryByClass` | Query by class |
| `queryByType` | Query by type |
| `queryByXid` | Query by external ID |

## FabricEntity Interface

All entities implement this interface:

```typescript
interface FabricEntity {
  model: string;      // Entity type (e.g., "user", "order")
  id: string;         // Unique identifier
  ou: string;         // Organizational unit
  sequence: number;   // Timestamp for ordering
  alias?: string;     // Alternative identifier
  class?: string;     // Classification
  type?: string;      // Subtype
  xid?: string;       // External ID
  deleted?: boolean;  // Soft delete flag
  archived?: boolean; // Archive flag
}
```

## Table Structure

### Primary Key

| Attribute | Type | Description |
|-----------|------|-------------|
| `model` | PK | Entity type |
| `id` | SK | Unique ID |

### GSI Pattern

| GSI | PK | SK | Purpose |
|-----|----|----|---------|
| GSI-OU | `ou` | `sequence` | Hierarchical queries |
| GSI-Alias | `alias` | `model` | Lookup by alias |
| GSI-Class | `class` | `sequence` | Classification queries |
| GSI-Type | `type` | `sequence` | Type queries |
| GSI-XID | `xid` | `model` | External ID lookup |

## Entity Operations

### Create Entity

```typescript
import { putEntity } from "@jaypie/dynamodb";

const user = await putEntity({
  model: "user",
  id: uuid(),
  ou: "@",  // Root organizational unit
  name: "Alice",
  email: "alice@example.com",
});
```

### Read Entity

```typescript
import { getEntity } from "@jaypie/dynamodb";

const user = await getEntity({
  model: "user",
  id: "user-123",
});
```

### Update Entity

```typescript
import { updateEntity } from "@jaypie/dynamodb";

const updated = await updateEntity({
  model: "user",
  id: "user-123",
  updates: {
    name: "Alice Smith",
  },
});
```

### Soft Delete

```typescript
import { deleteEntity } from "@jaypie/dynamodb";

await deleteEntity({
  model: "user",
  id: "user-123",
});
// Sets deleted: true, excluded from queries
```

### Hard Delete

```typescript
import { destroyEntity } from "@jaypie/dynamodb";

await destroyEntity({
  model: "user",
  id: "user-123",
});
// Permanently removes entity
```

## Query Patterns

### Query by Organizational Unit

```typescript
import { queryByOu } from "@jaypie/dynamodb";

// Get all entities in root
const rootEntities = await queryByOu({ ou: "@" });

// Get entities under parent
const childEntities = await queryByOu({ ou: "user#user-123" });
```

### Hierarchical Structure

```
@                          # Root OU
├── user#alice-123         # User's items
│   ├── order#order-1
│   └── order#order-2
└── user#bob-456           # Another user's items
    └── order#order-3
```

### Query by Type

```typescript
import { queryByType } from "@jaypie/dynamodb";

const premiumUsers = await queryByType({
  type: "premium",
  model: "user",
});
```

### Pagination

```typescript
const { items, lastEvaluatedKey } = await queryByOu({
  ou: "@",
  limit: 10,
});

// Next page
const nextPage = await queryByOu({
  ou: "@",
  limit: 10,
  startKey: lastEvaluatedKey,
});
```

## Index Entity

Auto-populate GSI attributes:

```typescript
import { indexEntity } from "@jaypie/dynamodb";

const entity = {
  model: "user",
  id: "user-123",
  email: "alice@example.com",
  type: "premium",
};

const indexed = indexEntity(entity);
// Adds ou, sequence, and GSI keys
```

## CDK Integration

```typescript
import { JaypieDynamoDb } from "@jaypie/constructs";

new JaypieDynamoDb(this, "Table", {
  tableName: "entities",
});
// Creates table with 5 GSIs
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
