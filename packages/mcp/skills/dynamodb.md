---
description: DynamoDB runtime package, key design, entity operations, and queries
related: apikey, aws, cdk, models, vocabulary
---

# DynamoDB Patterns

Jaypie provides `@jaypie/dynamodb` for single-table DynamoDB with entity operations, GSI-based queries, hierarchical scoping, and soft delete. Access through the main `jaypie` package or directly.

## Key Design

### Primary Key: `id` Only

`JaypieDynamoDb` creates tables with `id` as the sole partition key (no sort key). `model` and `scope` are regular attributes used in GSI partition keys:

```typescript
const table = new JaypieDynamoDb(this, "myApp");
// Creates table with: id (HASH) — no sort key
```

Items look like:

```typescript
{ id: "u_abc123", model: "user", name: "John", scope: "@" }
{ id: "a1b2c3d4", model: "apikey", scope: "user#u_abc123" }
```

## @jaypie/dynamodb Package

The runtime package provides entity operations, GSI-based queries, key builders, and client management.

```typescript
import {
  APEX,
  initClient,
  createEntity,
  getEntity,
  deleteEntity,
  queryByScope,
  queryByCategory,
} from "@jaypie/dynamodb";
```

Or through the main package:

```typescript
import { APEX, initClient, createEntity, queryByScope } from "jaypie";
```

### Client Initialization

Call `initClient()` once at startup. In Lambda, use the handler's `setup` option:

```typescript
import { initClient } from "@jaypie/dynamodb";

// Production: uses DYNAMODB_TABLE_NAME and AWS_REGION env vars
initClient();

// Local development: explicit config
initClient({
  endpoint: "http://127.0.0.1:8000",
  tableName: "jaypie-local",
  credentials: { accessKeyId: "local", secretAccessKey: "local" },
});
```

| Function | Description |
|----------|-------------|
| `initClient(config?)` | Initialize the DynamoDB client (call once) |
| `getDocClient()` | Get the initialized Document Client |
| `getTableName()` | Get the configured table name |
| `isInitialized()` | Check if client is initialized |
| `resetClient()` | Reset client state (for testing) |

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `APEX` | `"@"` | Root-level scope marker (DynamoDB prohibits empty strings) |
| `SEPARATOR` | `"#"` | Composite key separator |
| `ARCHIVED_SUFFIX` | `"#archived"` | Suffix for archived entity GSI keys |
| `DELETED_SUFFIX` | `"#deleted"` | Suffix for soft-deleted entity GSI keys |

### StorableEntity Type

All entities follow this shape:

```typescript
interface StorableEntity {
  // Primary Key
  id: string;                 // Partition key (UUID)

  // Required
  model: string;              // Entity model name (e.g., "record", "message")
  scope: string;              // APEX ("@") or "{parent.model}#{parent.id}"

  // Optional identity
  name?: string;
  alias?: string;             // Human-friendly slug
  category?: string;          // Category for filtering
  type?: string;              // Type for filtering
  xid?: string;               // External ID for cross-system lookup

  // GSI Keys (auto-populated by indexEntity on every write)
  // indexModel, indexModelAlias, indexModelCategory, etc.
  // indexModelSk, indexModelAliasSk, etc. (composite sort keys)

  // Timestamps (ISO 8601) — managed by indexEntity
  createdAt?: string;         // Backfilled on first write
  updatedAt?: string;         // Bumped on every write
  archivedAt?: string;
  deletedAt?: string;

  // Extensible
  state?: Record<string, unknown>;  // Application-specific state flags
  [key: string]: unknown;           // Additional properties allowed
}
```

### Entity Operations

```typescript
import { APEX, createEntity, getEntity, updateEntity, deleteEntity, archiveEntity, destroyEntity } from "@jaypie/dynamodb";

// Create entity — indexEntity auto-populates GSI keys, createdAt, updatedAt
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
// indexModel: "record" (auto-populated)
// indexModelAlias: "record#2026-01-07" (auto-populated)
// indexModelCategory: "record#memory" (auto-populated)
// indexModelSk: "@#2026-01-07T..." (auto-populated)

// Get by primary key (id only)
const item = await getEntity({ id: "abc-123" });

// Update — sets updatedAt, re-indexes
await updateEntity({ entity: { ...item, name: "Updated Name" } });

// Soft delete — sets deletedAt, re-indexes with #deleted suffix on pk
await deleteEntity({ id: "abc-123" });

// Archive — sets archivedAt, re-indexes with #archived suffix on pk
await archiveEntity({ id: "abc-123" });

// Hard delete — permanently removes
await destroyEntity({ id: "abc-123" });
```

| Function | Description |
|----------|-------------|
| `createEntity({ entity })` | Create entity; returns `null` if `id` exists (conditional `attribute_not_exists(id)`) |
| `getEntity({ id })` | Get by primary key (id only) |
| `updateEntity({ entity })` | Update (sets `updatedAt`, re-indexes) |
| `deleteEntity({ id })` | Soft delete (`deletedAt`, `#deleted` suffix on GSI pk) |
| `archiveEntity({ id })` | Archive (`archivedAt`, `#archived` suffix on GSI pk) |
| `destroyEntity({ id })` | Hard delete (permanent) |

### Scope and Hierarchy

The `scope` field enables parent-child relationships:

```typescript
import { APEX, calculateScope, createEntity, queryByScope } from "@jaypie/dynamodb";

// Root-level entity: scope = APEX ("@")
await createEntity({ entity: { model: "chat", scope: APEX, ... } });

// Child entity: scope = "{parent.model}#{parent.id}"
const chat = { model: "chat", id: "abc-123" };
const messageScope = calculateScope(chat); // "chat#abc-123"

await createEntity({
  entity: { model: "message", scope: messageScope, ... },
});

// Query all messages in a chat
const { items } = await queryByScope({ model: "message", scope: messageScope });

// Query all root-level chats
const { items: chats } = await queryByScope({ model: "chat", scope: APEX });
```

### GSI Schema

GSIs are defined using `fabricIndex()` from `@jaypie/fabric`. **Do not create all GSIs upfront** — start with zero and add only what your access patterns require. The most common first GSI is `indexModel` for listing entities by model.

**Important:** DynamoDB allows only **one GSI to be added per deployment**. If you need multiple GSIs, add them sequentially across separate deploys. For production tables, the AWS CLI is often better suited for adding GSIs than CDK (which may try to replace the table).

All GSIs use a composite sort key of `scope#updatedAt` (stored as `{indexName}Sk`). Queries use `begins_with` on the sk to filter by scope; omitting scope lists across all scopes.

| GSI Name | Partition Key Pattern | Sort Key | Purpose | Add When |
|----------|----------------------|----------|---------|----------|
| `indexModel` | `{model}` | `indexModelSk` = `{scope}#{updatedAt}` | List entities by model | You need to list/query by model |
| `indexModelAlias` | `{model}#{alias}` (sparse) | `indexModelAliasSk` = `{scope}#{updatedAt}` | Human-friendly slug lookup | You need slug-based lookups |
| `indexModelCategory` | `{model}#{category}` (sparse) | `indexModelCategorySk` = `{scope}#{updatedAt}` | Category filtering | You need to filter by category |
| `indexModelType` | `{model}#{type}` (sparse) | `indexModelTypeSk` = `{scope}#{updatedAt}` | Type filtering | You need to filter by type |
| `indexModelXid` | `{model}#{xid}` (sparse) | `indexModelXidSk` = `{scope}#{updatedAt}` | External ID lookup | You need cross-system ID lookups |

```typescript
import { fabricIndex, registerModel } from "@jaypie/fabric";

// Register model indexes (must happen before any queries)
registerModel({
  model: "record",
  indexes: [
    fabricIndex(),           // indexModel: pk=["model"], sk=["scope","updatedAt"]
    fabricIndex("alias"),    // indexModelAlias: pk=["model","alias"], sparse
    fabricIndex("category"), // indexModelCategory: pk=["model","category"], sparse
  ],
});
```

### Query Functions

All queries return `{ items, lastEvaluatedKey }` and support pagination. `scope` is always optional — when omitted, queries span all scopes. `queryByCategory` and `queryByType` throw `ConfigurationError` if the model has not registered the corresponding `fabricIndex()`.

```typescript
import { APEX, queryByScope, queryByAlias, queryByCategory, queryByType, queryByXid } from "@jaypie/dynamodb";

// List by model (scope optional)
const { items } = await queryByScope({ model: "record", scope: APEX });

// List across all scopes
const { items: allRecords } = await queryByScope({ model: "record" });

// Filter by category (requires fabricIndex("category") registered)
const { items: memories } = await queryByCategory({
  model: "record", scope: APEX, category: "memory",
});

// Lookup by alias (returns single or null)
const item = await queryByAlias({ model: "record", scope: APEX, alias: "2026-01-07" });

// Filter by type (requires fabricIndex("type") registered)
const { items: drafts } = await queryByType({
  model: "record", scope: APEX, type: "draft",
});

// Lookup by external ID (returns single or null)
const item = await queryByXid({ model: "user", scope: APEX, xid: "github:12345" });
```

#### Query Options

```typescript
const { items, lastEvaluatedKey } = await queryByScope({
  model: "record",
  scope: APEX,
  limit: 10,              // Max items
  ascending: true,        // Oldest first (default: false, newest first)
  deleted: true,          // Query soft-deleted entities
  archived: true,         // Query archived entities
});

// Pagination
const nextPage = await queryByScope({
  model: "record",
  scope: APEX,
  startKey: lastEvaluatedKey,
});
```

### Seed and Export

Idempotent seeding for bootstrapping data and export for migrations:

```typescript
import { APEX, seedEntities, seedEntityIfNotExists, exportEntities } from "@jaypie/dynamodb";

// Seed a single entity if it doesn't exist (checks by alias)
const created = await seedEntityIfNotExists({
  alias: "config-main", model: "config", name: "Main Config", scope: APEX,
});

// Seed multiple entities (idempotent)
const result = await seedEntities([
  { alias: "vocab-en", model: "vocabulary", name: "English", scope: APEX },
  { alias: "vocab-es", model: "vocabulary", name: "Spanish", scope: APEX },
]);
// result.created: ["vocab-en"] — aliases that were created
// result.skipped: ["vocab-es"] — aliases that already existed
// result.errors: [] — any failures

// Dry run
await seedEntities(entities, { dryRun: true });

// Replace existing
await seedEntities(entities, { replace: true });

// Export entities
const { entities, count } = await exportEntities("vocabulary", APEX);

// Export as JSON
const json = await exportEntitiesToJson("vocabulary", APEX);
```

### Key Builders

Build composite keys manually when needed:

```typescript
import { buildCompositeKey, calculateScope } from "@jaypie/dynamodb";

buildCompositeKey({ model: "record" }, ["model"]);                    // "record"
buildCompositeKey({ model: "record", alias: "daily-log" }, ["model", "alias"]); // "record#daily-log"
calculateScope({ model: "chat", id: "abc-123" });   // "chat#abc-123"
```

## CDK Table Definition

`JaypieDynamoDb` provides these defaults:

| Setting | Default | Source |
|---------|---------|--------|
| Partition key | `id` (String) | Jaypie construct |
| Sort key | None | Jaypie construct |
| Billing mode | PAY_PER_REQUEST | Jaypie construct |
| Removal policy | DESTROY (non-production), RETAIN (production) | Jaypie construct |
| Point-in-time recovery | Enabled | Jaypie construct |
| Encryption | AWS-owned key | CDK default |

```typescript
import { JaypieDynamoDb } from "@jaypie/constructs";
import { fabricIndex } from "@jaypie/fabric";

// Recommended: start with no indexes
const table = new JaypieDynamoDb(this, "myApp");

// Add indexes when driven by real access patterns
const table = new JaypieDynamoDb(this, "myApp", {
  indexes: [
    fabricIndex(),           // indexModel
    fabricIndex("alias"),    // indexModelAlias (sparse)
  ],
});
```

Wire tables to Lambda using the `tables` prop — see `skill("cdk")` for details.

## Local Development

Use docker-compose for local DynamoDB. The `@jaypie/dynamodb` MCP tool can generate a `docker-compose.yml` with custom ports.

### Suggested package.json Scripts

```json
{
  "scripts": {
    "dynamo:init": "docker compose up -d && npm run dynamo:create-table",
    "dynamo:create-table": "AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local aws dynamodb create-table --table-name jaypie-local --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --billing-mode PAY_PER_REQUEST --endpoint-url http://127.0.0.1:9060 2>/dev/null || true",
    "dynamo:remove": "docker compose down -v",
    "dynamo:start": "docker compose up -d",
    "dynamo:stop": "docker compose down"
  }
}
```

## Raw SDK Patterns

For cases where you need direct SDK access instead of `@jaypie/dynamodb`:

```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});

const result = await client.send(new QueryCommand({
  TableName: process.env.CDK_ENV_TABLE,
  KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
  ExpressionAttributeValues: {
    ":pk": "USER#123",
    ":prefix": "ORDER#",
  },
  ScanIndexForward: false,
  Limit: 10,
}));
```

## Testing

Mock `@jaypie/dynamodb` via testkit. Key builders and `indexEntity` work correctly in tests:

```typescript
import {
  APEX,
  indexEntity,
  createEntity,
  queryByScope,
  seedEntities,
} from "@jaypie/testkit/mock";
```

For raw SDK mocking:

```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { vi } from "vitest";

vi.mock("@aws-sdk/client-dynamodb");

describe("OrderService", () => {
  it("queries user orders", async () => {
    vi.mocked(DynamoDBClient.prototype.send).mockResolvedValue({
      Items: [{ model: "order", id: "order-abc" }],
    });

    const orders = await getOrders("123");
    expect(orders).toHaveLength(1);
  });
});
```

## Migration: v0.4.x to v0.5.0

Version 0.5.0 is a breaking change. **Tables must be recreated** (pre-1.0 breaking change).

| Old (0.4.x) | New (0.5.0) |
|-------------|-------------|
| Primary key: pk=`model`, sk=`id` | Primary key: pk=`id` only |
| GSI sort key: `sequence` (number) | GSI sort key: composite `scope#updatedAt` |
| GSI pk: `{scope}#{model}#{field}` | GSI pk: `{model}#{field}` |
| GSI names: indexScope, indexAlias, indexCategory, indexType, indexXid | GSI names: indexModel, indexModelAlias, indexModelCategory, indexModelType, indexModelXid |
| `sequence` field on entity | Removed — ordering by `updatedAt` |
| `getEntity({ id, model })` | `getEntity({ id })` |
| `deleteEntity({ id, model })` | `deleteEntity({ id })` |
| `archiveEntity({ id, model })` | `archiveEntity({ id })` |
| `destroyEntity({ id, model })` | `destroyEntity({ id })` |
| `buildIndexScope`, `buildIndexAlias`, etc. | Removed; use `buildCompositeKey` |
| `DEFAULT_INDEXES` implicit fallback | Must `registerModel()` with `fabricIndex()` before querying |
| Callers set `createdAt`/`updatedAt` | `indexEntity` manages both automatically |

## See Also

- **`skill("apikey")`** - API key hash storage in DynamoDB
- **`skill("cdk")`** - JaypieDynamoDb construct and Lambda table wiring
- **`skill("models")`** - Data model and type definition patterns
