---
description: DynamoDB code patterns, key design, and queries
related: aws, cdk, models, tools-dynamodb
---

# DynamoDB Patterns

Best practices for DynamoDB with Jaypie applications.

## MCP Tools

For interactive DynamoDB tools (query, scan, get-item, describe-table), see **tools-dynamodb**.

## Key Design

### Single Table Design

Use prefixed keys for multiple entity types:

```typescript
// User entity
{
  pk: "USER#123",
  sk: "PROFILE",
  name: "John Doe",
  email: "john@example.com"
}

// User's orders
{
  pk: "USER#123",
  sk: "ORDER#2024-01-15#abc",
  total: 99.99,
  status: "completed"
}
```

### Access Patterns

| Access Pattern | Key Condition |
|---------------|---------------|
| Get user profile | pk = USER#123, sk = PROFILE |
| List user orders | pk = USER#123, sk begins_with ORDER# |
| Get specific order | pk = USER#123, sk = ORDER#2024-01-15#abc |

## Query in Code

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
  ScanIndexForward: false,  // Newest first
  Limit: 10,
}));
```

## GSI Patterns

### By-Status Index

```typescript
// GSI for querying by status across all users
{
  pk: "USER#123",
  sk: "ORDER#2024-01-15#abc",
  gsi1pk: "ORDER#pending",
  gsi1sk: "2024-01-15T10:00:00Z",
}
```

Query pending orders:

```typescript
const result = await client.send(new QueryCommand({
  TableName: process.env.CDK_ENV_TABLE,
  IndexName: "gsi1",
  KeyConditionExpression: "gsi1pk = :status",
  ExpressionAttributeValues: {
    ":status": "ORDER#pending",
  },
}));
```

## CDK Table Definition

```typescript
import { JaypieTable } from "@jaypie/constructs";

const table = new JaypieTable(this, "DataTable", {
  partitionKey: { name: "pk", type: AttributeType.STRING },
  sortKey: { name: "sk", type: AttributeType.STRING },
  globalSecondaryIndexes: [
    {
      indexName: "gsi1",
      partitionKey: { name: "gsi1pk", type: AttributeType.STRING },
      sortKey: { name: "gsi1sk", type: AttributeType.STRING },
    },
  ],
});
```

## Local Development

```bash
# Start local DynamoDB
docker run -p 8000:8000 amazon/dynamodb-local

# Create table
AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local \
  aws dynamodb create-table \
  --table-name MyTable \
  --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://127.0.0.1:8000
```

## Testing

Mock DynamoDB in tests:

```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { vi } from "vitest";

vi.mock("@aws-sdk/client-dynamodb");

describe("OrderService", () => {
  it("queries user orders", async () => {
    vi.mocked(DynamoDBClient.prototype.send).mockResolvedValue({
      Items: [{ pk: "USER#123", sk: "ORDER#abc" }],
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

