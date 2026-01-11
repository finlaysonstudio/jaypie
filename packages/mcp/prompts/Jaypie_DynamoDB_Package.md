---
description: Complete guide to @jaypie/dynamodb single-table design utilities including GSI patterns, key builders, entity operations, and query functions
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

## FabricEntity Interface

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
  archivedAt?: string; // Set by archiveEntity
  deletedAt?: string;  // Set by deleteEntity

  // Optional - trigger GSI population
  alias?: string;     // Human-friendly slug
  class?: string;     // Category
  type?: string;      // Type classification
  xid?: string;       // External ID
}
```

## Entity Operations

### Creating Entities

Use `putEntity` to create or replace entities. GSI keys are auto-populated:

```typescript
import { APEX, putEntity } from "@jaypie/dynamodb";

const now = new Date().toISOString();

const record = await putEntity({
  entity: {
    model: "record",
    id: crypto.randomUUID(),
    name: "Daily Log",
    ou: APEX,
    sequence: Date.now(),
    alias: "2026-01-07",    // Optional
    class: "memory",        // Optional
    createdAt: now,
    updatedAt: now,
  },
});

// Result includes auto-populated indexes:
// indexOu: "@#record"
// indexAlias: "@#record#2026-01-07"
// indexClass: "@#record#memory"
```

### Getting Entities

```typescript
import { getEntity } from "@jaypie/dynamodb";

const record = await getEntity({ id: "123", model: "record" });
// Returns entity or null
```

### Updating Entities

Use `updateEntity` to update. Automatically sets `updatedAt` and re-indexes:

```typescript
import { updateEntity } from "@jaypie/dynamodb";

const updated = await updateEntity({
  entity: {
    ...existingRecord,
    name: "Updated Name",
    alias: "new-alias",
  },
});
// updatedAt is set automatically
// indexAlias is re-calculated
```

### Soft Delete

Use `deleteEntity` for soft delete (sets `deletedAt`):

```typescript
import { deleteEntity } from "@jaypie/dynamodb";

await deleteEntity({ id: "123", model: "record" });
// Sets deletedAt and updatedAt timestamps
// Entity excluded from queries by default
```

### Archive

Use `archiveEntity` for archiving (sets `archivedAt`):

```typescript
import { archiveEntity } from "@jaypie/dynamodb";

await archiveEntity({ id: "123", model: "record" });
// Sets archivedAt and updatedAt timestamps
// Entity excluded from queries by default
```

### Hard Delete

Use `destroyEntity` to permanently remove:

```typescript
import { destroyEntity } from "@jaypie/dynamodb";

await destroyEntity({ id: "123", model: "record" });
// Permanently removes from table
```

### Hierarchical Entities

Use `calculateOu` to derive OU from parent:

```typescript
import { calculateOu, putEntity, queryByOu } from "@jaypie/dynamodb";

// Parent reference
const chat = { model: "chat", id: "abc-123" };

// Calculate child OU
const messageOu = calculateOu(chat); // "chat#abc-123"

// Create child entity
const message = await putEntity({
  entity: {
    model: "message",
    id: crypto.randomUUID(),
    name: "First message",
    ou: messageOu,
    sequence: Date.now(),
    createdAt: now,
    updatedAt: now,
  },
});
// indexOu: "chat#abc-123#message"

// Query all messages in chat
const { items } = await queryByOu({ model: "message", ou: messageOu });
```

## Query Functions

All queries use object parameters and filter soft-deleted and archived records by default.

### queryByOu - List by Parent

List all entities of a model under a parent:

```typescript
import { APEX, queryByOu } from "@jaypie/dynamodb";

// Root-level records
const { items, lastEvaluatedKey } = await queryByOu({
  model: "record",
  ou: APEX,
});

// Messages under a chat
const { items: messages } = await queryByOu({
  model: "message",
  ou: "chat#abc-123",
});
```

### queryByAlias - Human-Friendly Lookup

Single entity lookup by slug:

```typescript
import { APEX, queryByAlias } from "@jaypie/dynamodb";

const record = await queryByAlias({
  alias: "2026-01-07",
  model: "record",
  ou: APEX,
});
// Returns entity or null
```

### queryByClass / queryByType - Category Filtering

```typescript
import { APEX, queryByClass, queryByType } from "@jaypie/dynamodb";

// All memory records
const { items } = await queryByClass({
  model: "record",
  ou: APEX,
  recordClass: "memory",
});

// All note-type records
const { items: notes } = await queryByType({
  model: "record",
  ou: APEX,
  type: "note",
});
```

### queryByXid - External ID Lookup

Single entity lookup by external system ID:

```typescript
import { APEX, queryByXid } from "@jaypie/dynamodb";

const record = await queryByXid({
  model: "record",
  ou: APEX,
  xid: "ext-12345",
});
// Returns entity or null
```

### Query Options

```typescript
import type { BaseQueryOptions } from "@jaypie/dynamodb";

const result = await queryByOu({
  model: "record",
  ou: APEX,
  // BaseQueryOptions:
  limit: 25,                // Max items to return
  ascending: true,          // Oldest first (default: false = newest first)
  includeDeleted: true,     // Include soft-deleted records
  includeArchived: true,    // Include archived records
  startKey: lastEvaluatedKey, // Pagination cursor
});
```

### Pagination

```typescript
import { APEX, queryByOu } from "@jaypie/dynamodb";

let startKey: Record<string, unknown> | undefined;
const allItems: FabricEntity[] = [];

do {
  const { items, lastEvaluatedKey } = await queryByOu({
    model: "record",
    ou: APEX,
    limit: 100,
    startKey,
  });
  allItems.push(...items);
  startKey = lastEvaluatedKey;
} while (startKey);
```

## Key Builder Functions

Use `indexEntity` to auto-populate GSI keys on an entity:

```typescript
import { indexEntity } from "@jaypie/dynamodb";

const indexed = indexEntity({
  model: "record",
  id: "123",
  ou: "@",
  alias: "my-alias",
  // ...
});
// indexOu: "@#record"
// indexAlias: "@#record#my-alias"
```

Use individual key builders for manual key construction:

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

// Key builders and indexEntity work correctly (delegate to real implementations)
// Query functions return empty results by default
// Entity operations return sensible defaults

// Customize mock behavior:
import { queryByOu, getEntity, putEntity } from "@jaypie/testkit/mock";

queryByOu.mockResolvedValue({
  items: [{ id: "123", name: "Test" }],
  lastEvaluatedKey: undefined,
});

getEntity.mockResolvedValue({ id: "123", model: "record", name: "Test" });
```

## Best Practices

### Use putEntity, Not Direct Writes

Always use `putEntity` or `updateEntity` to ensure GSI keys are auto-populated:

```typescript
// CORRECT - uses putEntity which calls indexEntity internally
const entity = await putEntity({
  entity: {
    model: "record",
    alias: "my-alias",
    // ...
  },
});

// WRONG - bypasses index population
const entity = {
  model: "record",
  alias: "my-alias",
  indexAlias: "@#record#my-alias", // Don't manually set index keys
};
```

### Use indexEntity for Raw Entities

If you need to prepare an entity before a batch write:

```typescript
import { indexEntity } from "@jaypie/dynamodb";

// Use indexEntity to prepare entities for batch operations
const indexed = indexEntity(myEntity);
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
const entity = await putEntity({
  entity: {
    // ...
    sequence: Date.now(),  // Required for proper ordering
  },
});
```

### Soft Delete and Archive Patterns

Use `deleteEntity` for logical deletion and `archiveEntity` for archival:

```typescript
// Soft delete - user action, can be recovered
await deleteEntity({ id: "123", model: "record" });

// Archive - system action, long-term storage
await archiveEntity({ id: "123", model: "record" });

// Queries exclude both by default
const { items } = await queryByOu({ model: "record", ou: APEX });

// Include if needed
const { items: all } = await queryByOu({
  model: "record",
  ou: APEX,
  includeDeleted: true,
  includeArchived: true,
});

// Permanent deletion (use sparingly)
await destroyEntity({ id: "123", model: "record" });
```

## MCP Integration

The package provides MCP (Model Context Protocol) tools via `@jaypie/dynamodb/mcp` subpath export.

### Installation

```bash
npm install @jaypie/dynamodb @modelcontextprotocol/sdk
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DYNAMODB_TABLE_NAME` | Yes | - | Table name for operations |
| `DYNAMODB_ENDPOINT` | No | - | Local endpoint (e.g., `http://127.0.0.1:8000`) |
| `AWS_REGION` | No | `us-east-1` | AWS region |
| `PROJECT_NAME` | No | `jaypie` | Container name prefix for docker-compose |

### Register MCP Tools

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDynamoDbTools } from "@jaypie/dynamodb/mcp";

const server = new McpServer({ name: "my-server", version: "1.0.0" });

const { tools } = registerDynamoDbTools({ server });
// tools: ["dynamodb_get", "dynamodb_put", "dynamodb_update", ...]
```

### Available MCP Tools

#### Entity Operations
| Tool | Description |
|------|-------------|
| `dynamodb_get` | Get entity by id and model |
| `dynamodb_put` | Create or replace an entity |
| `dynamodb_update` | Update entity fields |
| `dynamodb_delete` | Soft delete (sets deletedAt) |
| `dynamodb_archive` | Archive entity (sets archivedAt) |
| `dynamodb_destroy` | Hard delete (permanent) |

#### Query Operations
| Tool | Description |
|------|-------------|
| `dynamodb_query_ou` | Query by organizational unit |
| `dynamodb_query_alias` | Query by human-friendly alias |
| `dynamodb_query_class` | Query by category classification |
| `dynamodb_query_type` | Query by type classification |
| `dynamodb_query_xid` | Query by external ID |

#### Admin Operations (Enabled by Default)
| Tool | Description |
|------|-------------|
| `dynamodb_status` | Check DynamoDB connection status |
| `dynamodb_create_table` | Create table with Jaypie GSI schema |
| `dynamodb_generate_docker_compose` | Generate docker-compose.yml for local dev |

### Disable Admin Tools

```typescript
const { tools } = registerDynamoDbTools({
  server,
  includeAdmin: false,  // Exclude admin tools
});
```

### Auto-Initialization

MCP tools auto-initialize the DynamoDB client from environment variables. Manual `initClient()` is not required when using MCP tools.

### Local Development with MCP

Generate docker-compose and create table:

```typescript
// Use dynamodb_generate_docker_compose tool to get:
// - docker-compose.yml content
// - Environment variables (.env format)

// Start local DynamoDB
// docker compose up -d

// Use dynamodb_create_table tool to create table with full GSI schema
```

### Example MCP Tool Usage

```json
// dynamodb_put
{
  "id": "abc-123",
  "model": "record",
  "name": "My Record",
  "ou": "@",
  "alias": "my-record",
  "class": "memory"
}

// dynamodb_query_ou
{
  "model": "record",
  "ou": "@",
  "limit": 10
}

// dynamodb_update
{
  "id": "abc-123",
  "model": "record",
  "name": "Updated Name"
}
```
