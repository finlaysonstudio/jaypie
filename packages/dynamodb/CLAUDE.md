# @jaypie/dynamodb

DynamoDB single-table storage utilities for Jaypie applications.

## Overview

This package provides utilities for:
- **Single-Table Design**: GSI-based access patterns for hierarchical data
- **Key Builders**: Composite key construction for five GSIs
- **Query Utilities**: Named query functions (not gsi1, gsi2, etc.)
- **Client Management**: Singleton DynamoDB Document Client

## Directory Structure

```
src/
├── __tests__/           # Test files
├── client.ts            # Client initialization and management
├── constants.ts         # APEX, SEPARATOR, GSI index names
├── index.ts             # Package exports
├── keyBuilders.ts       # Key builder and entity utilities
├── queries.ts           # Query functions for each GSI
└── types.ts             # TypeScript interfaces
```

## Exports

### Constants

| Export | Value | Description |
|--------|-------|-------------|
| `APEX` | `"@"` | Root-level marker (DynamoDB prohibits empty strings) |
| `SEPARATOR` | `"#"` | Composite key separator |
| `INDEX_OU` | `"indexOu"` | Hierarchical queries GSI name |
| `INDEX_ALIAS` | `"indexAlias"` | Human-friendly lookup GSI name |
| `INDEX_CLASS` | `"indexClass"` | Category filtering GSI name |
| `INDEX_TYPE` | `"indexType"` | Type filtering GSI name |
| `INDEX_XID` | `"indexXid"` | External ID lookup GSI name |

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
| `populateIndexKeys(entity)` | Auto-populates GSI keys on entity based on present fields |

### Client Functions

| Export | Description |
|--------|-------------|
| `initClient(config)` | Initialize the DynamoDB client (call once at startup) |
| `getDocClient()` | Get the initialized Document Client |
| `getTableName()` | Get the configured table name |
| `isInitialized()` | Check if client is initialized |
| `resetClient()` | Reset client state (for testing) |

### Query Functions

| Export | Description |
|--------|-------------|
| `queryByOu(ou, model, options?)` | List entities by parent (hierarchical) |
| `queryByAlias(ou, model, alias)` | Lookup by human-friendly slug (returns single entity or null) |
| `queryByClass(ou, model, recordClass, options?)` | Filter by category |
| `queryByType(ou, model, type, options?)` | Filter by type |
| `queryByXid(ou, model, xid)` | Lookup by external ID (returns single entity or null) |

### Types

```typescript
interface DynamoClientConfig {
  tableName: string;
  endpoint?: string;   // For local dev
  region?: string;     // Default: "us-east-1"
  credentials?: { accessKeyId: string; secretAccessKey: string };
}

interface ParentReference {
  id: string;
  model: string;
}

interface QueryOptions {
  ascending?: boolean;       // Default: false (most recent first)
  includeDeleted?: boolean;  // Default: false
  limit?: number;
  startKey?: Record<string, unknown>;  // Pagination cursor
}

interface QueryResult<T = FabricEntity> {
  items: T[];
  lastEvaluatedKey?: Record<string, unknown>;
}

interface FabricEntity {
  // Primary Key
  model: string;              // Partition key
  id: string;                 // Sort key (UUID)

  // Required
  name: string;
  ou: string;                 // APEX or "{parent.model}#{parent.id}"
  sequence: number;           // Date.now() for chronological ordering

  // GSI Keys (auto-populated)
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
  deletedAt?: string;
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
initClient({
  tableName: "my-table",
  endpoint: process.env.DYNAMODB_ENDPOINT,  // Optional for local dev
});

// Use anywhere
const { items } = await queryByOu(APEX, "record");
```

### Create Entity

```typescript
import { APEX, populateIndexKeys } from "@jaypie/dynamodb";

const now = new Date().toISOString();
const record = populateIndexKeys({
  model: "record",
  id: crypto.randomUUID(),
  name: "Daily Log",
  ou: APEX,
  sequence: Date.now(),
  alias: "2026-01-07",
  class: "memory",
  createdAt: now,
  updatedAt: now,
});
// indexOu: "@#record"
// indexAlias: "@#record#2026-01-07"
// indexClass: "@#record#memory"
```

### Hierarchical Entities

```typescript
import { calculateOu, populateIndexKeys, queryByOu } from "@jaypie/dynamodb";

// Create child entity
const chat = { model: "chat", id: "abc-123" };
const messageOu = calculateOu(chat); // "chat#abc-123"

const message = populateIndexKeys({
  model: "message",
  id: crypto.randomUUID(),
  name: "Message 1",
  ou: messageOu,
  sequence: Date.now(),
  // ...
});
// indexOu: "chat#abc-123#message"

// Query all messages in chat
const { items } = await queryByOu(messageOu, "message");
```

### Query with Options

```typescript
import { APEX, queryByClass } from "@jaypie/dynamodb";

const { items, lastEvaluatedKey } = await queryByClass(
  APEX,
  "record",
  "memory",
  {
    limit: 10,
    ascending: true,        // Oldest first
    includeDeleted: false,  // Default
  }
);

// Pagination
const nextPage = await queryByClass(APEX, "record", "memory", {
  startKey: lastEvaluatedKey,
});
```

## Testing

Mock implementations are provided in `@jaypie/testkit`:

```typescript
import {
  APEX,
  queryByOu,
  populateIndexKeys,
} from "@jaypie/testkit/mock";
```

All mocks delegate to real implementations where possible, so key builders and `populateIndexKeys` work correctly in tests.

## Commands

```bash
npm run build     # Build package
npm run test      # Run tests
npm run typecheck # Type check
npm run lint      # Lint code
npm run format    # Auto-fix lint issues
```

## Peer Dependencies

- `@jaypie/errors` - Error types
- `@jaypie/kit` - Core utilities
- `@jaypie/logger` - Logging
