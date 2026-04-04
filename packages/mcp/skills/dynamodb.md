---
description: DynamoDB runtime package, key design, entity operations, and queries
related: apikey, aws, cdk, models
---

# DynamoDB Patterns

Jaypie provides `@jaypie/dynamodb` for single-table DynamoDB with entity operations, GSI-based queries, hierarchical scoping, and soft delete. Access through the main `jaypie` package or directly.

## Key Naming Conventions

Jaypie uses two key naming patterns. Understanding when to use each avoids confusion.

### Jaypie Default: `model` / `id`

`JaypieDynamoDb` creates tables with `model` (partition key) and `id` (sort key) by default. This is the **recommended convention for new Jaypie tables** and the convention used by `@jaypie/dynamodb`:

```typescript
const table = new JaypieDynamoDb(this, "myApp");
// Creates table with: model (HASH), id (RANGE)
```

Items look like:

```typescript
{ model: "user", id: "u_abc123", name: "John", email: "john@example.com" }
{ model: "apikey", id: "a1b2c3d4...", ownerId: "u_abc123" }
```

### Generic DynamoDB: `pk` / `sk`

The `pk` / `sk` pattern is the standard DynamoDB convention used in broader DynamoDB literature. Jaypie uses it in local development scripts and educational examples. It's functionally equivalent — just different attribute names.

### Entity Prefixing (Value Pattern)

Entity prefixes like `USER#123` are a **value-level pattern** (how you structure the data stored in keys), not an attribute naming convention. You can use entity prefixes with either `model`/`id` or `pk`/`sk` attribute names.

## @jaypie/dynamodb Package

The runtime package provides entity operations, GSI-based queries, key builders, and client management.

```typescript
import {
  APEX,
  initClient,
  putEntity,
  getEntity,
  deleteEntity,
  queryByScope,
  queryByCategory,
} from "@jaypie/dynamodb";
```

Or through the main package:

```typescript
import { APEX, initClient, putEntity, queryByScope } from "jaypie";
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
  model: string;              // Partition key (e.g., "record", "message")
  id: string;                 // Sort key (UUID)

  // Required
  name: string;
  scope: string;              // APEX ("@") or "{parent.model}#{parent.id}"
  sequence: number;           // Date.now() for chronological ordering

  // Optional (trigger GSI index population when present)
  alias?: string;             // Human-friendly slug
  category?: string;          // Category for filtering
  type?: string;              // Type for filtering
  xid?: string;               // External ID for cross-system lookup

  // GSI Keys (auto-populated by putEntity/updateEntity)
  indexAlias?: string;
  indexCategory?: string;
  indexScope?: string;
  indexType?: string;
  indexXid?: string;

  // Timestamps (ISO 8601)
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  deletedAt?: string;

  // Extensible
  state?: Record<string, unknown>;  // Application-specific state flags
  [key: string]: unknown;           // Additional properties allowed
}
```

### Entity Operations

```typescript
import { APEX, putEntity, getEntity, updateEntity, deleteEntity, archiveEntity, destroyEntity } from "@jaypie/dynamodb";

const now = new Date().toISOString();

// Create entity — auto-populates GSI keys
const record = await putEntity({
  entity: {
    model: "record",
    id: crypto.randomUUID(),
    name: "Daily Log",
    scope: APEX,
    sequence: Date.now(),
    alias: "2026-01-07",
    category: "memory",
    createdAt: now,
    updatedAt: now,
  },
});
// indexScope: "@#record" (auto-populated)
// indexAlias: "@#record#2026-01-07" (auto-populated)
// indexCategory: "@#record#memory" (auto-populated)

// Get by primary key
const item = await getEntity({ id: "abc-123", model: "record" });

// Update — sets updatedAt, re-indexes
await updateEntity({ entity: { ...item, name: "Updated Name" } });

// Soft delete — sets deletedAt, re-indexes with #deleted suffix
await deleteEntity({ id: "abc-123", model: "record" });

// Archive — sets archivedAt, re-indexes with #archived suffix
await archiveEntity({ id: "abc-123", model: "record" });

// Hard delete — permanently removes
await destroyEntity({ id: "abc-123", model: "record" });
```

| Function | Description |
|----------|-------------|
| `putEntity({ entity })` | Create or replace (auto-indexes GSI keys) |
| `getEntity({ id, model })` | Get by primary key |
| `updateEntity({ entity })` | Update (sets `updatedAt`, re-indexes) |
| `deleteEntity({ id, model })` | Soft delete (`deletedAt`, `#deleted` suffix) |
| `archiveEntity({ id, model })` | Archive (`archivedAt`, `#archived` suffix) |
| `destroyEntity({ id, model })` | Hard delete (permanent) |

### Scope and Hierarchy

The `scope` field enables parent-child relationships:

```typescript
import { APEX, calculateScope, putEntity, queryByScope } from "@jaypie/dynamodb";

// Root-level entity: scope = APEX ("@")
await putEntity({ entity: { model: "chat", scope: APEX, ... } });

// Child entity: scope = "{parent.model}#{parent.id}"
const chat = { model: "chat", id: "abc-123" };
const messageScope = calculateScope(chat); // "chat#abc-123"

await putEntity({
  entity: { model: "message", scope: messageScope, ... },
});

// Query all messages in a chat
const { items } = await queryByScope({ model: "message", scope: messageScope });

// Query all root-level chats
const { items: chats } = await queryByScope({ model: "chat", scope: APEX });
```

### GSI Schema

Jaypie defines five GSI patterns, but **do not create all five upfront**. Start with zero GSIs and add only what your access patterns require. The most common first GSI is `indexScope` for hierarchical queries.

**Important:** DynamoDB allows only **one GSI to be added per deployment**. If you need multiple GSIs, add them sequentially across separate deploys. For production tables, the AWS CLI is often better suited for adding GSIs than CDK (which may try to replace the table).

All GSIs use `sequence` (Number) as the sort key for chronological ordering.

| GSI Name | Partition Key Pattern | Purpose | Add When |
|----------|----------------------|---------|----------|
| `indexScope` | `{scope}#{model}` | List entities by parent | You need hierarchical queries |
| `indexAlias` | `{scope}#{model}#{alias}` | Human-friendly slug lookup | You need slug-based lookups |
| `indexCategory` | `{scope}#{model}#{category}` | Category filtering | You need to filter by category |
| `indexType` | `{scope}#{model}#{type}` | Type filtering | You need to filter by type |
| `indexXid` | `{scope}#{model}#{xid}` | External ID lookup | You need cross-system ID lookups |

### Query Functions

All queries return `{ items, lastEvaluatedKey }` and support pagination:

```typescript
import { APEX, queryByScope, queryByAlias, queryByCategory, queryByType, queryByXid } from "@jaypie/dynamodb";

// List by parent scope (most common)
const { items } = await queryByScope({ model: "record", scope: APEX });

// Filter by category
const { items: memories } = await queryByCategory({
  model: "record", scope: APEX, category: "memory",
});

// Lookup by alias (returns single or null)
const item = await queryByAlias({ model: "record", scope: APEX, alias: "2026-01-07" });

// Filter by type
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

Build composite GSI keys manually when needed:

```typescript
import { buildIndexScope, buildIndexAlias, buildIndexCategory, calculateScope } from "@jaypie/dynamodb";

buildIndexScope(APEX, "record");                    // "@#record"
buildIndexAlias(APEX, "record", "daily-log");       // "@#record#daily-log"
buildIndexCategory(APEX, "record", "memory");       // "@#record#memory"
calculateScope({ model: "chat", id: "abc-123" });   // "chat#abc-123"
```

## CDK Table Definition

`JaypieDynamoDb` provides these defaults:

| Setting | Default | Source |
|---------|---------|--------|
| Partition key | `model` (String) | Jaypie construct |
| Sort key | `id` (String) | Jaypie construct |
| Billing mode | PAY_PER_REQUEST | Jaypie construct |
| Removal policy | DESTROY (non-production), RETAIN (production) | Jaypie construct |
| Point-in-time recovery | Enabled | Jaypie construct |
| Encryption | AWS-owned key | CDK default |

```typescript
import { JaypieDynamoDb } from "@jaypie/constructs";

// Recommended: start with no indexes (uses model/id keys)
const table = new JaypieDynamoDb(this, "myApp");

// Add indexes when driven by real access patterns
const table = new JaypieDynamoDb(this, "myApp", {
  indexes: [
    { pk: ["scope", "model"], sk: ["sequence"] },
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
    "dynamo:create-table": "AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local aws dynamodb create-table --table-name jaypie-local --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE --billing-mode PAY_PER_REQUEST --endpoint-url http://127.0.0.1:9060 2>/dev/null || true",
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
  putEntity,
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

## Migration: class to category (v0.4.0)

Version 0.4.0 renamed `class` → `category` and `indexClass` → `indexCategory`.

**If your table was created with an older version:**

1. **Local dev**: Delete and recreate the table using MCP `createTable`
2. **Production**: See `packages/dynamodb/CLAUDE.md` for migration script

| Old | New |
|-----|-----|
| `class` | `category` |
| `indexClass` | `indexCategory` |
| `INDEX_CLASS` | `INDEX_CATEGORY` |
| `queryByClass()` | `queryByCategory()` |

## See Also

- **`skill("apikey")`** - API key hash storage in DynamoDB
- **`skill("cdk")`** - JaypieDynamoDb construct and Lambda table wiring
- **`skill("models")`** - Data model and type definition patterns
