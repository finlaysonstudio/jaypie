---
description: Debugging techniques and troubleshooting
related: logs, datadog, errors
---

# Debugging Techniques

Strategies for debugging Jaypie applications.

## Log-Based Debugging

### Enable Debug Logging

```bash
LOG_LEVEL=debug npm run dev
LOG_LEVEL=trace npm run dev  # Most verbose
```

### Search Logs via MCP

```
# Find errors in last hour
datadog_logs --query "status:error" --from "now-1h"

# Find specific request
datadog_logs --query "@requestId:abc-123"

# Search CloudWatch directly
aws_logs_filter_log_events --logGroupName "/aws/lambda/my-function" --filterPattern "ERROR"
```

## Common Issues

### "undefined" in Stack Names

If you see `undefined` in a CDK stack name, a required variable is missing:

```typescript
// BAD: undefined if PROJECT_NONCE not set
const stackName = `api-${process.env.PROJECT_NONCE}`;

// GOOD: Provide default
const nonce = process.env.PROJECT_NONCE || "dev";
const stackName = `api-${nonce}`;
```

### "unknown" in Logs

`unknown` indicates a value was expected but fell back to a default:

```typescript
// This produces "unknown" if PROJECT_KEY not set
log.info("Starting", { project: process.env.PROJECT_KEY || "unknown" });
```

### Lambda Cold Starts

Check initialization time:

```
datadog_logs --query "@dd.cold_start:true" --from "now-1h"
```

### Connection Timeouts

For database or external service timeouts:

```typescript
// Check Lambda timeout settings
aws_lambda_get_function --functionName "my-function"

// Look for timeout patterns in logs
datadog_logs --query "timeout OR ETIMEDOUT" --from "now-1h"
```

Increase Lambda timeout or optimize slow operations.

## Local Testing

### Lambda Local Testing

Use SAM CLI for local Lambda testing:

```bash
cd packages/express/docker
sam local invoke -e event.json
```

### DynamoDB Local

```bash
# Start local DynamoDB
docker run -p 8000:8000 amazon/dynamodb-local

# Access with AWS CLI
AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local \
  aws dynamodb list-tables --endpoint-url http://127.0.0.1:8000
```

## Stack Traces

### Finding Root Cause

Jaypie errors include context:

```typescript
try {
  await riskyOperation();
} catch (error) {
  log.error("Operation failed", {
    error: error.message,
    stack: error.stack,
    context: error.context,  // Jaypie errors include this
  });
  throw error;
}
```

### Error Classification

| Error Type | Cause |
|------------|-------|
| ConfigurationError | Missing or invalid config |
| NotFoundError | Resource doesn't exist |
| UnauthorizedError | Authentication failed |
| ForbiddenError | Permission denied |
| BadRequestError | Invalid input |

## Step Function Debugging

```
# List running executions
aws_stepfunctions_list_executions --stateMachineArn "arn:..." --statusFilter "RUNNING"

# Stop stuck execution
aws_stepfunctions_stop_execution --executionArn "arn:..." --cause "Manual stop for debugging"
```

## Queue Debugging

```
# Check queue depth
aws_sqs_get_queue_attributes --queueUrl "https://..."

# Peek at messages (does not delete)
aws_sqs_receive_message --queueUrl "https://..." --maxNumberOfMessages 5
```

