---
description: AWS integration, CLI tools, and cloud services
---

# AWS Integration

Jaypie integrates with AWS services through SDK utilities and CLI tools available via the MCP.

## MCP AWS Tools

The Jaypie MCP provides AWS tools that use your local AWS credentials:

### Lambda Functions
```
aws_lambda_list_functions     - List functions with optional prefix filter
aws_lambda_get_function       - Get function configuration and details
```

### Step Functions
```
aws_stepfunctions_list_executions  - List executions for a state machine
aws_stepfunctions_stop_execution   - Stop a running execution
```

### CloudWatch Logs
```
aws_logs_filter_log_events    - Search logs with patterns and time ranges
```

### S3
```
aws_s3_list_objects           - List bucket objects with prefix filtering
```

### DynamoDB
```
aws_dynamodb_describe_table   - Get table metadata and indexes
aws_dynamodb_scan             - Scan table (use sparingly)
aws_dynamodb_query            - Query by partition key
aws_dynamodb_get_item         - Get single item by key
```

### SQS
```
aws_sqs_list_queues           - List queues with prefix filter
aws_sqs_get_queue_attributes  - Get queue attributes
aws_sqs_receive_message       - Peek at queue messages
aws_sqs_purge_queue           - Delete all messages (irreversible)
```

### CloudFormation
```
aws_cloudformation_describe_stack  - Get stack details and outputs
```

## Credential Management

Tools use the host's AWS credential chain:
1. Environment variables (`AWS_ACCESS_KEY_ID`, etc.)
2. `~/.aws/credentials` and `~/.aws/config`
3. SSO sessions via `aws sso login`

```bash
# List available profiles
aws_list_profiles

# Use a specific profile
aws_lambda_list_functions --profile production
```

## Jaypie AWS Package

The `@jaypie/aws` package provides SDK utilities:

```typescript
import { getSecret, sendMessage } from "@jaypie/aws";

// Get secret from Secrets Manager
const apiKey = await getSecret("my-api-key");

// Send SQS message
await sendMessage(queueUrl, { action: "process", id: "123" });
```

## Environment-Based Configuration

Use CDK environment variables in Lambda:

| Variable | Description |
|----------|-------------|
| `CDK_ENV_BUCKET` | S3 bucket name |
| `CDK_ENV_QUEUE_URL` | SQS queue URL |
| `CDK_ENV_SNS_TOPIC_ARN` | SNS topic ARN |

## Profile Selection

When working with multiple AWS accounts:

```bash
# Set default profile
export AWS_PROFILE=development

# Or specify per-command via MCP tools
aws_lambda_list_functions --profile production --region us-west-2
```

## See Also

- `skill("cdk")` - CDK constructs
- `skill("dynamodb")` - DynamoDB patterns
- `skill("secrets")` - Secret management
- `skill("logs")` - CloudWatch logging
