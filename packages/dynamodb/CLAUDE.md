# @jaypie/dynamodb

DynamoDB single-table storage utilities for Jaypie applications.

## Overview

This package provides utilities for:
- **Single-Table Design**: GSI-based access patterns for hierarchical data
- **Key Builders**: Composite key construction for five GSIs
- **Entity Operations**: CRUD operations with soft delete and archive support
- **Query Utilities**: Named query functions (not gsi1, gsi2, etc.)
- **Seed and Export**: Idempotent seeding and data export for migrations
- **Client Management**: Singleton DynamoDB Document Client

## Directory Structure

```
src/
├── __tests__/           # Test files
├── client.ts            # Client initialization and management
├── constants.ts         # Re-exports from @jaypie/fabric (APEX, SEPARATOR, etc.)
├── entities.ts          # Entity CRUD operations
├── index.ts             # Package exports
├── keyBuilders.ts       # Key builders (wraps @jaypie/fabric utilities)
├── queries.ts           # Query functions for each GSI
├── seedExport.ts        # Seed and export utilities
└── types.ts             # TypeScript interfaces
```

## Exports

### Constants

| Export | Value | Description |
|--------|-------|-------------|
| `APEX` | `"@"` | Root-level marker (DynamoDB prohibits empty strings) |
| `ARCHIVED_SUFFIX` | `"#archived"` | Suffix appended to GSI keys on archive |
| `DELETED_SUFFIX` | `"#deleted"` | Suffix appended to GSI keys on delete |
| `INDEX_ALIAS` | `"indexAlias"` | Human-friendly lookup GSI name |
| `INDEX_CLASS` | `"indexClass"` | Category filtering GSI name |
| `INDEX_OU` | `"indexOu"` | Hierarchical queries GSI name |
| `INDEX_TYPE` | `"indexType"` | Type filtering GSI name |
| `INDEX_XID` | `"indexXid"` | External ID lookup GSI name |
| `SEPARATOR` | `"#"` | Composite key separator |

### Key Builders

| Export | Description |
|--------|-------------|
| `buildIndexOu(ou, model)` | Returns `"{ou}#{model}"` |
| `buildIndexAlias(ou, model, alias)` | Returns `"{ou}#{model}#{alias}"` |
| `buildIndexClass(ou, model, recordClass)` | Returns `"{ou}#{model}#{class}"` |
| `buildIndexType(ou, model, type)` | Returns `"{ou}#{model}#{type}"` |
| `buildIndexXid(ou, model, xid)` | Returns `"{ou}#{model}#{xid}"` |

### Entity Utilities

| Export | Description |
|--------|-------------|
| `calculateOu(parent?)` | Returns `APEX` if no parent, else `"{parent.model}#{parent.id}"` |
| `indexEntity(entity, suffix?)` | Auto-populates GSI keys on entity based on present fields, with optional suffix |

### Entity Operations

| Export | Description |
|--------|-------------|
| `getEntity({ id, model })` | Get a single entity by primary key |
| `putEntity({ entity })` | Create or replace entity (auto-indexes) |
| `updateEntity({ entity })` | Update entity (sets `updatedAt`, auto-indexes) |
| `deleteEntity({ id, model })` | Soft delete (sets `deletedAt`, re-indexes with `#deleted` suffix) |
| `archiveEntity({ id, model })` | Archive (sets `archivedAt`, re-indexes with `#archived` suffix) |
| `destroyEntity({ id, model })` | Hard delete (permanently removes) |

### Client Functions

| Export | Description |
|--------|-------------|
| `initClient(config)` | Initialize the DynamoDB client (call once at startup) |
| `getDocClient()` | Get the initialized Document Client |
| `getTableName()` | Get the configured table name |
| `isInitialized()` | Check if client is initialized |
| `resetClient()` | Reset client state (for testing) |

### Query Functions

All query functions use object parameters:

| Export | Parameters | Description |
|--------|------------|-------------|
| `queryByOu({ model, ou, ...options })` | Required: model, ou | List entities by parent (hierarchical) |
| `queryByAlias({ alias, model, ou })` | Required: all | Lookup by human-friendly slug (returns single or null) |
| `queryByClass({ model, ou, recordClass, ...options })` | Required: model, ou, recordClass | Filter by category |
| `queryByType({ model, ou, type, ...options })` | Required: model, ou, type | Filter by type |
| `queryByXid({ model, ou, xid })` | Required: all | Lookup by external ID (returns single or null) |

### Seed and Export Functions

Generic utilities for bootstrapping and migrating DynamoDB data:

| Export | Description |
|--------|-------------|
| `seedEntityIfNotExists(entity)` | Seed a single entity if it doesn't already exist by alias |
| `seedEntities(entities, options?)` | Seed multiple entities (idempotent) with optional replace/dryRun |
| `exportEntities(model, ou, limit?)` | Export entities by model + ou, sorted by sequence ascending |
| `exportEntitiesToJson(model, ou, pretty?)` | Export as JSON string (default: pretty printed) |

### Types

```typescript
interface DynamoClientConfig {
  credentials?: { accessKeyId: string; secretAccessKey: string };  // For local dev
  endpoint?: string;   // For local dev
  region?: string;     // Falls back to AWS_REGION, then "us-east-1"
  tableName?: string;  // Falls back to DYNAMODB_TABLE_NAME env var
}

interface ParentReference {
  id: string;
  model: string;
}

interface BaseQueryOptions {
  archived?: boolean;         // Query archived entities instead of active
  ascending?: boolean;        // Default: false (most recent first)
  deleted?: boolean;          // Query deleted entities instead of active
  limit?: number;
  startKey?: Record<string, unknown>;  // Pagination cursor
}

interface QueryResult<T = StorableEntity> {
  items: T[];
  lastEvaluatedKey?: Record<string, unknown>;
}

interface StorableEntity {
  // Primary Key
  model: string;              // Partition key
  id: string;                 // Sort key (UUID)

  // Required
  name: string;
  ou: string;                 // APEX or "{parent.model}#{parent.id}"
  sequence: number;           // Date.now() for chronological ordering

  // GSI Keys (auto-populated by indexEntity)
  indexAlias?: string;
  indexClass?: string;
  indexOu?: string;
  indexType?: string;
  indexXid?: string;

  // Optional (trigger index population when present)
  alias?: string;
  class?: string;
  type?: string;
  xid?: string;

  // Timestamps (ISO 8601)
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;        // Set by archiveEntity
  deletedAt?: string;         // Set by deleteEntity
}

interface SeedResult {
  created: string[];          // Aliases of entities that were created
  skipped: string[];          // Aliases of entities that were skipped (already exist)
  errors: Array<{ alias: string; error: string }>;  // Error details
}

interface SeedOptions {
  replace?: boolean;          // Overwrite existing entities (default: false)
  dryRun?: boolean;           // Preview without writing (default: false)
}

interface ExportResult<T extends StorableEntity = StorableEntity> {
  entities: T[];              // Exported entities
  count: number;              // Number of entities exported
}
```

## Single-Table Design

### GSI Schema

All GSIs use `sequence` (number) as the sort key for chronological ordering.

| GSI Name | Partition Key Pattern | Purpose |
|----------|----------------------|---------|
| `indexOu` | `{ou}#{model}` | List by parent |
| `indexAlias` | `{ou}#{model}#{alias}` | Human-friendly lookup |
| `indexClass` | `{ou}#{model}#{class}` | Category filter |
| `indexType` | `{ou}#{model}#{type}` | Type filter |
| `indexXid` | `{ou}#{model}#{xid}` | External ID lookup |

### Primary Key

- **Partition Key**: `model` (e.g., "record", "message", "chat")
- **Sort Key**: `id` (UUID)

### OU (Organizational Unit)

The `ou` field enables hierarchical queries:

- Root-level entities: `ou = APEX` ("@")
- Child entities: `ou = "{parent.model}#{parent.id}"`

Example: Messages under a chat have `ou = "chat#abc-123"`

## Usage Examples

### Initialize Client

```typescript
import { initClient, APEX, queryByOu } from "@jaypie/dynamodb";

// Initialize once at app startup
// In production: uses DYNAMODB_TABLE_NAME and AWS_REGION env vars
initClient();

// Or with explicit config (for local dev)
initClient({
  endpoint: process.env.DYNAMODB_ENDPOINT,  // For local dev only
  tableName: "my-table",                    // Overrides DYNAMODB_TABLE_NAME
});

// Use anywhere
const { items } = await queryByOu({ model: "record", ou: APEX });
```

### Create Entity

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
    alias: "2026-01-07",
    class: "memory",
    createdAt: now,
    updatedAt: now,
  },
});
// indexOu: "@#record" (auto-populated)
// indexAlias: "@#record#2026-01-07" (auto-populated)
// indexClass: "@#record#memory" (auto-populated)
```

### Hierarchical Entities

```typescript
import { calculateOu, putEntity, queryByOu } from "@jaypie/dynamodb";

// Create child entity
const chat = { model: "chat", id: "abc-123" };
const messageOu = calculateOu(chat); // "chat#abc-123"

const message = await putEntity({
  entity: {
    model: "message",
    id: crypto.randomUUID(),
    name: "Message 1",
    ou: messageOu,
    sequence: Date.now(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
});
// indexOu: "chat#abc-123#message" (auto-populated)

// Query all messages in chat
const { items } = await queryByOu({ model: "message", ou: messageOu });
```

### Query with Options

```typescript
import { APEX, queryByClass } from "@jaypie/dynamodb";

const { items, lastEvaluatedKey } = await queryByClass({
  model: "record",
  ou: APEX,
  recordClass: "memory",
  limit: 10,
  ascending: true,          // Oldest first
});

// Pagination
const nextPage = await queryByClass({
  model: "record",
  ou: APEX,
  recordClass: "memory",
  startKey: lastEvaluatedKey,
});
```

### Soft Delete and Archive

Deleted and archived entities use GSI-level filtering via index key suffixes. When an entity is soft-deleted or archived, all its GSI keys are re-indexed with a suffix (`#deleted` or `#archived`), removing them from standard queries automatically.

```typescript
import {
  APEX,
  DELETED_SUFFIX,
  archiveEntity,
  deleteEntity,
  destroyEntity,
  getEntity,
  indexEntity,
  queryByOu
} from "@jaypie/dynamodb";

// Soft delete - sets deletedAt, re-indexes with #deleted suffix
// indexOu changes from "@#record" to "@#record#deleted"
await deleteEntity({ id: "123", model: "record" });

// Archive - sets archivedAt, re-indexes with #archived suffix
// indexOu changes from "@#record" to "@#record#archived"
await archiveEntity({ id: "456", model: "record" });

// Hard delete - permanently removes from table
await destroyEntity({ id: "789", model: "record" });

// Query deleted entities using the deleted flag
const { items: deletedItems } = await queryByOu({
  deleted: true,
  model: "record",
  ou: APEX,
});

// Query archived entities using the archived flag
const { items: archivedItems } = await queryByOu({
  archived: true,
  model: "record",
  ou: APEX,
});

// Query entities that are both archived AND deleted
const { items: archivedAndDeleted } = await queryByOu({
  archived: true,
  deleted: true,
  model: "record",
  ou: APEX,
});
// Uses combined suffix: #archived#deleted

// Retrieve a specific deleted/archived entity by primary key
const deletedEntity = await getEntity({ id: "123", model: "record" });

// The indexEntity function accepts an optional suffix parameter for manual indexing
const entity = { model: "record", ou: "@", id: "123", ... };
const indexed = indexEntity(entity, DELETED_SUFFIX);
// indexed.indexOu === "@#record#deleted"
```

### Seed and Export

```typescript
import {
  APEX,
  exportEntities,
  exportEntitiesToJson,
  seedEntities,
  seedEntityIfNotExists,
} from "@jaypie/dynamodb";

// Seed a single entity if it doesn't exist
const created = await seedEntityIfNotExists({
  alias: "config-main",
  model: "config",
  name: "Main Configuration",
  ou: APEX,
});
// Returns true if created, false if already exists

// Seed multiple entities (idempotent)
const result = await seedEntities([
  { alias: "vocab-en", model: "vocabulary", name: "English", ou: APEX },
  { alias: "vocab-es", model: "vocabulary", name: "Spanish", ou: APEX },
]);
// result.created: ["vocab-en", "vocab-es"] or []
// result.skipped: entities that already existed
// result.errors: any entities that failed to seed

// Dry run to preview what would be seeded
const preview = await seedEntities(
  [{ alias: "new-item", model: "item", ou: APEX }],
  { dryRun: true }
);
// No entities written, but created/skipped arrays populated

// Replace existing entities
await seedEntities(
  [{ alias: "config-main", model: "config", name: "Updated Config", ou: APEX }],
  { replace: true }
);

// Export all entities of a type
const { entities, count } = await exportEntities("vocabulary", APEX);
// entities: array of StorableEntity sorted by sequence ascending
// count: number of entities

// Export with limit
const { entities: limited } = await exportEntities("vocabulary", APEX, 10);

// Export as JSON string
const json = await exportEntitiesToJson("vocabulary", APEX);
// Pretty printed by default

const compact = await exportEntitiesToJson("vocabulary", APEX, false);
// Compact JSON
```

## Testing

Mock implementations are provided in `@jaypie/testkit`:

```typescript
import {
  APEX,
  exportEntities,
  exportEntitiesToJson,
  indexEntity,
  putEntity,
  queryByOu,
  seedEntities,
  seedEntityIfNotExists,
} from "@jaypie/testkit/mock";
```

All mocks delegate to real implementations where possible, so key builders and `indexEntity` work correctly in tests.

## Commands

```bash
npm run build     # Build package
npm run test      # Run tests
npm run typecheck # Type check
npm run lint      # Lint code
npm run format    # Auto-fix lint issues
```

## Dependencies

- `@jaypie/fabric` - Index utilities (`APEX`, `SEPARATOR`, `calculateOu`, `buildCompositeKey`, `populateIndexKeys`)

## Peer Dependencies

- `@jaypie/errors` - Error types
- `@jaypie/kit` - Core utilities
- `@jaypie/logger` - Logging
