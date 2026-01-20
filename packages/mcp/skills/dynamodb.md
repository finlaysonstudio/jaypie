---
description: DynamoDB patterns and queries
---

# DynamoDB Patterns

Best practices for DynamoDB with Jaypie applications.

## MCP DynamoDB Tools

```
aws_dynamodb_describe_table   - Get table schema and indexes
aws_dynamodb_query            - Query by partition key (efficient)
aws_dynamodb_scan             - Full table scan (use sparingly)
aws_dynamodb_get_item         - Get single item by key
```

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

## Query Examples

### Query via MCP

```
# Get user profile
aws_dynamodb_get_item --tableName "MyTable" --key '{"pk":{"S":"USER#123"},"sk":{"S":"PROFILE"}}'

# List user orders
aws_dynamodb_query --tableName "MyTable" \
  --keyConditionExpression "pk = :pk AND begins_with(sk, :prefix)" \
  --expressionAttributeValues '{":pk":{"S":"USER#123"},":prefix":{"S":"ORDER#"}}'
```

### Query in Code

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

```
aws_dynamodb_query --tableName "MyTable" --indexName "gsi1" \
  --keyConditionExpression "gsi1pk = :status" \
  --expressionAttributeValues '{":status":{"S":"ORDER#pending"}}'
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

## See Also

- `skill("aws")` - AWS integration
- `skill("cdk")` - CDK constructs
- `skill("models")` - Data models
