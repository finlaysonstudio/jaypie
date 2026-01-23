---
description: DynamoDB commands in the AWS MCP tool for table queries, scans, and item retrieval
related: dynamodb, tools, tools-aws
---

# DynamoDB MCP Commands

DynamoDB commands in the unified AWS tool for interacting with DynamoDB tables.

## Usage

```
aws("dynamodb_command", { ...params })
```

## Available Commands

| Command | Description |
|---------|-------------|
| `dynamodb_describe_table` | Get table schema, indexes, and metadata |
| `dynamodb_query` | Query by partition key (efficient) |
| `dynamodb_scan` | Full table scan (use sparingly) |
| `dynamodb_get_item` | Get single item by primary key |

## Describe Table

Get table metadata including key schema, indexes, and throughput:

```
aws("dynamodb_describe_table", { tableName: "MyTable" })
```

Returns:
- Key schema (partition key, sort key)
- Global secondary indexes
- Billing mode and provisioned throughput
- Item count and size estimates

## Query by Partition Key

Query is the most efficient way to retrieve items:

```
# Simple partition key query
aws("dynamodb_query", {
  tableName: "MyTable",
  keyConditionExpression: "pk = :pk",
  expressionAttributeValues: '{":pk":{"S":"USER#123"}}'
})

# With sort key condition
aws("dynamodb_query", {
  tableName: "MyTable",
  keyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
  expressionAttributeValues: '{":pk":{"S":"USER#123"},":prefix":{"S":"ORDER#"}}'
})

# Query GSI
aws("dynamodb_query", {
  tableName: "MyTable",
  indexName: "gsi1",
  keyConditionExpression: "gsi1pk = :status",
  expressionAttributeValues: '{":status":{"S":"ORDER#pending"}}'
})
```

## Get Single Item

Retrieve a specific item by its full primary key:

```
# Simple key
aws("dynamodb_get_item", {
  tableName: "MyTable",
  key: '{"pk":{"S":"USER#123"}}'
})

# Composite key (partition + sort)
aws("dynamodb_get_item", {
  tableName: "MyTable",
  key: '{"pk":{"S":"USER#123"},"sk":{"S":"PROFILE"}}'
})
```

## Scan Table

Full table scan - use sparingly on large tables:

```
# Scan all items
aws("dynamodb_scan", { tableName: "MyTable" })

# With filter (applied after scan, not efficient for filtering)
aws("dynamodb_scan", {
  tableName: "MyTable",
  filterExpression: "status = :status",
  expressionAttributeValues: '{":status":{"S":"active"}}'
})

# Limit results
aws("dynamodb_scan", { tableName: "MyTable", limit: 10 })
```

## DynamoDB Attribute Format

All values use DynamoDB's attribute value format:

| Type | Format | Example |
|------|--------|---------|
| String | `{"S": "value"}` | `{"S": "USER#123"}` |
| Number | `{"N": "123"}` | `{"N": "99.99"}` |
| Boolean | `{"BOOL": true}` | `{"BOOL": false}` |
| List | `{"L": [...]}` | `{"L": [{"S": "a"}, {"S": "b"}]}` |
| Map | `{"M": {...}}` | `{"M": {"name": {"S": "John"}}}` |
| Null | `{"NULL": true}` | `{"NULL": true}` |

## Common Patterns

### Get User Profile

```
aws("dynamodb_get_item", {
  tableName: "DataTable",
  key: '{"pk":{"S":"USER#123"},"sk":{"S":"PROFILE"}}'
})
```

### List User Orders

```
aws("dynamodb_query", {
  tableName: "DataTable",
  keyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
  expressionAttributeValues: '{":pk":{"S":"USER#123"},":prefix":{"S":"ORDER#"}}'
})
```

### Find Pending Orders (via GSI)

```
aws("dynamodb_query", {
  tableName: "DataTable",
  indexName: "gsi1",
  keyConditionExpression: "gsi1pk = :status",
  expressionAttributeValues: '{":status":{"S":"ORDER#pending"}}'
})
```

### Check Table Schema

```
aws("dynamodb_describe_table", { tableName: "DataTable" })
```

## Profile and Region

All DynamoDB commands support profile and region options:

```
aws("dynamodb_query", {
  tableName: "MyTable",
  profile: "production",
  region: "us-west-2",
  keyConditionExpression: "pk = :pk",
  expressionAttributeValues: '{":pk":{"S":"USER#123"}}'
})
```

