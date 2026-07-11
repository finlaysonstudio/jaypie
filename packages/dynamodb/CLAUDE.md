# @jaypie/dynamodb

DynamoDB single-table storage utilities for Jaypie applications.

## Overview

This package provides utilities for:
- **Single-Table Design**: Model-keyed GSIs with composite sort keys for hierarchical data
- **Key Builders**: Composite key construction via `buildCompositeKey` (delegates to `@jaypie/fabric`)
- **Entity Operations**: CRUD operations with soft delete and archive support
- **Query Utilities**: Named query functions (not gsi1, gsi2, etc.)
- **Auto Timestamps**: `indexEntity` bumps `updatedAt` on every write and backfills `createdAt`
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
├── query.ts             # Unified query function with auto-detect
├── seedExport.ts        # Seed and export utilities
└── types.ts             # TypeScript interfaces
```

## Exports

### Constants

| Export | Value | Description |
|--------|-------|-------------|
| `APEX` | `"@"` | Root-level marker (DynamoDB prohibits empty strings) |
| `ARCHIVED_SUFFIX` | `"#archived"` | Suffix appended to GSI pk keys on archive |
| `DELETED_SUFFIX` | `"#deleted"` | Suffix appended to GSI pk keys on delete |
| `SEPARATOR` | `"#"` | Composite key separator |

### Key Builders

| Export | Description |
|--------|-------------|
| `buildCompositeKey(entity, fields, suffix?)` | Build a composite key from entity fields joined by `SEPARATOR` |
| `calculateScope(parent?)` | Returns `APEX` if no parent, else `"{parent.model}#{parent.id}"` |
| `indexEntity(entity, suffix?)` | Auto-populate GSI keys, bump `updatedAt`, backfill `createdAt` |

### Entity Operations

| Export | Description |
|--------|-------------|
| `getEntity({ id })` | Get a single entity by primary key (id only) |
| `createEntity({ entity })` | Create entity; returns `null` if `id` already exists (conditional write on `attribute_not_exists(id)`) |
| `updateEntity({ entity, condition?, names?, values? })` | Create or replace entity (auto-indexes, auto-timestamps). Optional `condition` (a ConditionExpression with `names`/`values` bindings) guards the write; throws `ConflictError` (409) and leaves the item unchanged when the condition fails |
| `transitionEntity({ id, from?, set })` | Conditionally update by status: reads the entity, merges `set`, writes guarded by `#status = from`; throws `ConflictError` (409) on a race and `NotFoundError` (404) when absent. Validates `from`/`set.status` against the model's `status` vocabulary |
| `deleteEntity({ id })` | Soft delete (sets `deletedAt`, re-indexes with `#deleted` suffix) |
| `archiveEntity({ id })` | Archive (sets `archivedAt`, re-indexes with `#archived` suffix) |
| `destroyEntity({ id })` | Hard delete (permanently removes) |
| `transactWriteEntities({ entities, conditionalCreate?, condition? })` | Write multiple entities atomically; `conditionalCreate: true` guards every `Put` with `attribute_not_exists(id)` (or pass `condition` for a custom ConditionExpression), throwing `ConflictError` (409) when a conditional check fails |

### Client Functions

| Export | Description |
|--------|-------------|
| `initClient(config)` | Initialize the DynamoDB client (call once at startup) |
| `getClient()` | Get the raw DynamoDB client (control-plane: CreateTable/DeleteTable) |
| `getDocClient()` | Get the initialized Document Client |
| `getTableName()` | Get the configured table name |
| `isInitialized()` | Check if client is initialized |
| `resetClient()` | Reset client state (for testing) |

### Scan and Table Administration

These power table rebuilds (see [Rebuilding a table](#rebuilding-a-table-04--06)). All honor the `initClient` config, so they target real AWS or local alike.

| Export | Description |
|--------|-------------|
| `scanTable({ tableName?, pageSize? })` | Async generator yielding every raw item via a schema-agnostic `Scan` (paginates internally). `tableName` defaults to the initialized table -- pass the **old** table to read it. |
| `countTable({ tableName? })` | Total item count via a paginated `COUNT` scan (validation) |
| `createTable({ tableName?, billingMode?, wait? })` | Create a table with the current registered-model GSI schema; waits until `ACTIVE` by default. Returns `{ created, message, tableName }` |
| `destroyTable({ tableName })` | Delete a table. `tableName` is **required** (no default) -- destroying is intentional |

### Query Functions

All query functions use object parameters. `scope` is always optional -- when omitted, queries span all scopes. When provided, queries use `begins_with` on the composite sk to narrow to that scope.

| Export | Parameters | Description |
|--------|------------|-------------|
| `queryByScope({ model, scope?, ...options })` | Required: model | List entities by model, optionally narrowed to a scope |
| `queryByAlias({ alias, model, scope? })` | Required: alias, model | Lookup by human-friendly slug (returns single or null) |
| `queryByCategory({ model, category, scope?, ...options })` | Required: model, category | Filter by category (throws ConfigurationError if model hasn't registered `fabricIndex("category")`) |
| `queryByType({ model, type, scope?, ...options })` | Required: model, type | Filter by type (throws ConfigurationError if model hasn't registered `fabricIndex("type")`) |
| `queryByXid({ model, xid, scope? })` | Required: model, xid | Lookup by external ID (returns single or null) |
| `query({ model, ...params })` | Unified auto-detect | Routes to the correct query function based on which fields are provided |

### Seed and Export Functions

| Export | Description |
|--------|-------------|
| `seedEntityIfNotExists(entity)` | Seed a single entity if it doesn't already exist by alias |
| `seedEntities(entities, options?)` | Seed multiple entities (idempotent) with optional replace/dryRun |
| `exportEntities(model, scope, limit?)` | Export entities by model + scope, sorted by `updatedAt` descending |
| `exportEntitiesToJson(model, scope, pretty?)` | Export as JSON string (default: pretty printed) |

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
  ascending?: boolean;        // Default: false (most recent first by updatedAt)
  deleted?: boolean;          // Query deleted entities instead of active
  limit?: number;
  scope?: string;             // Optional scope narrower (begins_with on composite sk)
  startKey?: Record<string, unknown>;  // Pagination cursor
}

interface QueryResult<T = StorableEntity> {
  items: T[];
  lastEvaluatedKey?: Record<string, unknown>;
}

/**
 * Primary key is `id` only (no sort key). `model` and `scope` are regular
 * attributes. GSI attribute values (e.g., `indexModel`, `indexModelAlias`,
 * `indexModelSk`) are auto-populated by `indexEntity` on every write.
 *
 * `updatedAt` is managed by `indexEntity` -- callers never set it.
 * `createdAt` is backfilled by `indexEntity` if missing.
 */
interface StorableEntity {
  // Primary Key
  id: string;                 // Partition key (UUID)

  // Required
  model: string;              // Entity model name
  scope: string;              // APEX or "{parent.model}#{parent.id}"

  // Optional identity
  name?: string;
  alias?: string;
  category?: string;
  type?: string;
  xid?: string;

  // Timestamps (ISO 8601) -- managed by indexEntity
  createdAt?: string;         // Backfilled on first write
  updatedAt?: string;         // Bumped on every write
  archivedAt?: string;        // Set by archiveEntity
  deletedAt?: string;         // Set by deleteEntity

  // Extensible
  state?: Record<string, unknown>;
  [key: string]: unknown;     // Additional properties + GSI attributes
}

interface SeedResult {
  created: string[];
  skipped: string[];
  errors: Array<{ alias: string; error: string }>;
}

interface SeedOptions {
  replace?: boolean;          // Overwrite existing entities (default: false)
  dryRun?: boolean;           // Preview without writing (default: false)
}

interface ExportResult<T extends StorableEntity = StorableEntity> {
  entities: T[];
  count: number;
}
```

## Single-Table Design

### Primary Key

- **Partition Key**: `id` (UUID)
- No sort key on the base table

### GSI Schema

All GSIs use a composite sort key of `scope#updatedAt` (stored as the `{indexName}Sk` attribute). Ordering is by `updatedAt` within a scope. Queries use `begins_with` on the sk to filter by scope; omitting scope lists across all scopes.

| GSI Name | Partition Key Pattern | Sort Key Attribute | Purpose |
|----------|----------------------|-------------------|---------|
| `indexModel` | `{model}` | `indexModelSk` = `{scope}#{updatedAt}` | List by model |
| `indexModelAlias` | `{model}#{alias}` (sparse) | `indexModelAliasSk` = `{scope}#{updatedAt}` | Human-friendly lookup |
| `indexModelCategory` | `{model}#{category}` (sparse) | `indexModelCategorySk` = `{scope}#{updatedAt}` | Category filter |
| `indexModelType` | `{model}#{type}` (sparse) | `indexModelTypeSk` = `{scope}#{updatedAt}` | Type filter |
| `indexModelXid` | `{model}#{xid}` (sparse) | `indexModelXidSk` = `{scope}#{updatedAt}` | External ID lookup |

GSIs are defined using `fabricIndex()` from `@jaypie/fabric`:

```typescript
import { fabricIndex, registerModel } from "@jaypie/fabric";

registerModel({
  model: "record",
  indexes: [
    fabricIndex(),           // indexModel: pk=["model"], sk=["scope","updatedAt"]
    fabricIndex("alias"),    // indexModelAlias: pk=["model","alias"], sparse
    fabricIndex("category"), // indexModelCategory: pk=["model","category"], sparse
    fabricIndex("xid"),      // indexModelXid: pk=["model","xid"], sparse
  ],
});
```

### Scope

The `scope` field enables hierarchical queries:

- Root-level entities: `scope = APEX` ("@")
- Child entities: `scope = "{parent.model}#{parent.id}"`

Example: Messages under a chat have `scope = "chat#abc-123"`

### Suffix Behavior

Archived/deleted suffixes are appended to the GSI **partition key** (pk). This moves the entity into its own partition, excluding it from active queries automatically.

- Active: `indexModel = "record"`
- Deleted: `indexModel = "record#deleted"`
- Archived: `indexModel = "record#archived"`
- Both: `indexModel = "record#archived#deleted"`

## Usage Examples

### Register Model and Initialize Client

```typescript
import { fabricIndex, registerModel } from "@jaypie/fabric";
import { initClient, APEX, queryByScope } from "@jaypie/dynamodb";

// Register model indexes (must happen before any queries)
registerModel({
  model: "record",
  indexes: [
    fabricIndex(),           // indexModel
    fabricIndex("alias"),    // indexModelAlias
    fabricIndex("category"), // indexModelCategory
  ],
});

// Initialize once at app startup
initClient();

// Or with explicit config (for local dev)
initClient({
  endpoint: process.env.DYNAMODB_ENDPOINT,
  tableName: "my-table",
});

const { items } = await queryByScope({ model: "record", scope: APEX });
```

### Create Entity

```typescript
import { APEX, createEntity } from "@jaypie/dynamodb";

// indexEntity auto-populates: createdAt, updatedAt, and all GSI keys
const record = await createEntity({
  entity: {
    model: "record",
    id: crypto.randomUUID(),
    name: "Daily Log",
    scope: APEX,
    alias: "2026-01-07",
    category: "memory",
  },
});
// record.updatedAt -> set automatically
// record.createdAt -> set automatically
// record.indexModel -> "record"
// record.indexModelSk -> "@#2026-01-07T..."
// record.indexModelAlias -> "record#2026-01-07"
// record.indexModelCategory -> "record#memory"
```

### Hierarchical Entities

```typescript
import { calculateScope, createEntity, queryByScope } from "@jaypie/dynamodb";

const chat = { model: "chat", id: "abc-123" };
const messageScope = calculateScope(chat); // "chat#abc-123"

const message = await createEntity({
  entity: {
    model: "message",
    id: crypto.randomUUID(),
    name: "Message 1",
    scope: messageScope,
  },
});
// indexModel -> "message"
// indexModelSk -> "chat#abc-123#2026-01-07T..."

// Query all messages in chat
const { items } = await queryByScope({ model: "message", scope: messageScope });

// Query all messages across all scopes
const { items: allMessages } = await queryByScope({ model: "message" });
```

### Query with Options

```typescript
import { APEX, queryByCategory } from "@jaypie/dynamodb";

const { items, lastEvaluatedKey } = await queryByCategory({
  model: "record",
  scope: APEX,
  category: "memory",
  limit: 10,
  ascending: true,          // Oldest first (by updatedAt)
});

// Pagination
const nextPage = await queryByCategory({
  model: "record",
  scope: APEX,
  category: "memory",
  startKey: lastEvaluatedKey,
});

// Omit scope to query across all scopes
const { items: allMemories } = await queryByCategory({
  model: "record",
  category: "memory",
});
```

### Soft Delete and Archive

```typescript
import {
  APEX,
  archiveEntity,
  deleteEntity,
  destroyEntity,
  getEntity,
  queryByScope,
} from "@jaypie/dynamodb";

// Soft delete - sets deletedAt, re-indexes with #deleted suffix on pk
// indexModel changes from "record" to "record#deleted"
await deleteEntity({ id: "123" });

// Archive - sets archivedAt, re-indexes with #archived suffix on pk
await archiveEntity({ id: "456" });

// Hard delete - permanently removes from table
await destroyEntity({ id: "789" });

// Query deleted entities
const { items: deletedItems } = await queryByScope({
  deleted: true,
  model: "record",
  scope: APEX,
});

// Query archived entities
const { items: archivedItems } = await queryByScope({
  archived: true,
  model: "record",
  scope: APEX,
});

// Retrieve a specific entity by primary key (works regardless of state)
const entity = await getEntity({ id: "123" });
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
  scope: APEX,
});

// Seed multiple entities (idempotent)
const result = await seedEntities([
  { alias: "vocab-en", model: "vocabulary", name: "English", scope: APEX },
  { alias: "vocab-es", model: "vocabulary", name: "Spanish", scope: APEX },
]);

// Replace existing entities
await seedEntities(
  [{ alias: "config-main", model: "config", name: "Updated Config", scope: APEX }],
  { replace: true },
);

// Export all entities of a type
const { entities, count } = await exportEntities("vocabulary", APEX);

// Export as JSON string
const json = await exportEntitiesToJson("vocabulary", APEX);
```

## Testing

Mock implementations are provided in `@jaypie/testkit`:

```typescript
import {
  APEX,
  exportEntities,
  exportEntitiesToJson,
  indexEntity,
  createEntity,
  queryByScope,
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

## Migration Guide

### Migrating from v0.4.x to v0.5.0

Version 0.5.0 is a breaking change. **Tables must be recreated** (pre-1.0 breaking change).

#### What Changed

| Old (0.4.x) | New (0.5.0) |
|-------------|-------------|
| Primary key: pk=`model`, sk=`id` | Primary key: pk=`id` only |
| GSI sort key: `sequence` (number) | GSI sort key: composite `scope#updatedAt` |
| GSI pk: `{scope}#{model}#{field}` | GSI pk: `{model}#{field}` |
| GSI names: indexScope, indexAlias, indexCategory, indexType, indexXid | GSI names: indexModel, indexModelAlias, indexModelCategory, indexModelType, indexModelXid |
| `sequence` field on entity | Removed -- ordering by `updatedAt` |
| `getEntity({ id, model })` | `getEntity({ id })` |
| `deleteEntity({ id, model })` | `deleteEntity({ id })` |
| `archiveEntity({ id, model })` | `archiveEntity({ id })` |
| `destroyEntity({ id, model })` | `destroyEntity({ id })` |
| `queryByScope({ model, scope })` -- scope required | `queryByScope({ model })` -- scope optional |
| Callers set `createdAt`/`updatedAt` | `indexEntity` manages both automatically |
| `buildIndexScope`, `buildIndexAlias`, etc. | Removed; use `buildCompositeKey` |
| `INDEX_ALIAS`, `INDEX_CATEGORY`, `INDEX_SCOPE`, `INDEX_TYPE`, `INDEX_XID` constants | Removed |
| Implicit `DEFAULT_INDEXES` fallback | Must `registerModel()` with `fabricIndex()` before querying |

#### Steps

1. **Define indexes** using `fabricIndex()` from `@jaypie/fabric` and call `registerModel()` for each model
2. **Recreate tables** -- the GSI shape and primary key have changed
3. **Remove** `sequence` from entity creation code
4. **Remove** `model` param from `getEntity`, `deleteEntity`, `archiveEntity`, `destroyEntity`
5. **Remove** manual `createdAt`/`updatedAt` assignment -- `indexEntity` handles it
6. **Replace** `buildIndexScope`/`buildIndexAlias`/etc. with `buildCompositeKey`
7. **Update** `scope` from required to optional in query call sites (if desired)

### Rebuilding a table (0.4 → 0.6)

The 0.5.0 primary-key change means a table **cannot be migrated in place** -- DynamoDB cannot alter a primary key. The pattern is a one-off, human-in-the-loop cutover to a new physical table, validated before the old one is destroyed. (0.6 adds the `putEntity` → `createEntity`/`updateEntity` rename on top, but no further schema change.)

This is **not** a deploy-step migration. Run it once per environment (local → sandbox → production), watching each step. The package provides the verbs; you provide the transform.

#### Cutover shape (CDK-managed table name, maintenance window)

1. **Deploy the new table** alongside the old one (CDK), with its own name.
2. **Pause writes** (maintenance window) so the copy can't go stale.
3. **Run the migration script** below: scan OLD → transform → write NEW, single pass.
4. **Validate**: `countTable(NEW)` matches `countTable(OLD)`; spot-check a few records.
5. **Flip** `DYNAMODB_TABLE_NAME` (via `CDK_ENV`) to the new table in a CDK deploy, then resume.
6. **Destroy the old table** later with `destroyTable({ tableName: OLD })`, once you're confident. It sits untouched as instant rollback until then.

#### Migration script

```ts
import {
  createTable,
  countTable,
  initClient,
  scanTable,
  updateEntity,
  type StorableEntity,
} from "@jaypie/dynamodb";
import { fabricIndex, registerModel } from "@jaypie/fabric";

const OLD = process.env.OLD_TABLE_NAME!;
const NEW = process.env.DYNAMODB_TABLE_NAME!;

// Register models so createTable builds the 0.6 GSIs
registerModel({ model: "record", indexes: [fabricIndex(), fabricIndex("alias")] });

// Singleton points at the DESTINATION; scanTable reads the OLD table explicitly
initClient({ tableName: NEW });

// 0.4 → 0.6 transform: drop `sequence`, strip the old pk/sk attrs.
// `model` and `scope` survive as plain attributes; indexEntity (inside
// updateEntity) recomputes every GSI key and the timestamps on write.
function transform(item: Record<string, unknown>): StorableEntity {
  const { sequence, pk, sk, ...rest } = item;
  void sequence;
  void pk;
  void sk;
  return rest as StorableEntity;
}

await createTable({ tableName: NEW }); // waits until ACTIVE

let migrated = 0;
for await (const item of scanTable({ tableName: OLD })) {
  await updateEntity({ entity: transform(item) });
  migrated += 1;
}

const sourceCount = await countTable({ tableName: OLD });
console.log(`Migrated ${migrated} of ${sourceCount} records`);
if (migrated !== sourceCount) {
  throw new Error("Count mismatch -- do NOT destroy the old table");
}
// Validation passed. Flip CDK_ENV to NEW, deploy, then later:
//   await destroyTable({ tableName: OLD });
```

The transform is yours because field semantics are app-specific. `scanTable` issues a raw `Scan`, so it reads the old table regardless of its (now-mismatched) GSI shape; `updateEntity` re-indexes each record into the new schema.

## Dependencies

- `@jaypie/fabric` - Index utilities (`APEX`, `SEPARATOR`, `calculateScope`, `buildCompositeKey`, `populateIndexKeys`, `fabricIndex`, `registerModel`, `getModelIndexes`, `getGsiAttributeNames`)

## Peer Dependencies

- `@jaypie/errors` - Error types
- `@jaypie/kit` - Core utilities
- `@jaypie/logger` - Logging
