---
description: AWS MCP tool for Lambda, S3, SQS, CloudWatch, Step Functions, CloudFormation
related: aws, tools, tools-dynamodb
---

# AWS MCP Tool

Unified tool for interacting with AWS services via the Jaypie MCP. Uses your local AWS credentials.

## Usage

```
aws()                                    # Show help with all commands
aws("command", { ...params })            # Execute a command
```

## Lambda Functions

| Command | Description |
|---------|-------------|
| `lambda_list_functions` | List functions with optional prefix filter |
| `lambda_get_function` | Get function configuration and details |

```
# List all functions
aws("lambda_list_functions")

# Filter by prefix
aws("lambda_list_functions", { functionNamePrefix: "my-api" })

# Get function details
aws("lambda_get_function", { functionName: "my-api-handler" })
```

## Step Functions

| Command | Description |
|---------|-------------|
| `stepfunctions_list_executions` | List executions for a state machine |
| `stepfunctions_stop_execution` | Stop a running execution |

```
# List recent executions
aws("stepfunctions_list_executions", { stateMachineArn: "arn:aws:states:..." })

# Stop a running execution
aws("stepfunctions_stop_execution", { executionArn: "arn:aws:states:..." })
```

## CloudWatch Logs

| Command | Description |
|---------|-------------|
| `logs_filter_log_events` | Search logs with patterns and time ranges |

```
# Search for errors in Lambda logs
aws("logs_filter_log_events", { logGroupName: "/aws/lambda/my-function", filterPattern: "ERROR" })

# Search with time range
aws("logs_filter_log_events", { logGroupName: "/aws/lambda/my-function", startTime: "now-1h" })
```

## S3

| Command | Description |
|---------|-------------|
| `s3_list_objects` | List bucket objects with prefix filtering |

```
# List all objects
aws("s3_list_objects", { bucket: "my-bucket" })

# Filter by prefix
aws("s3_list_objects", { bucket: "my-bucket", prefix: "uploads/" })
```

## SQS

| Command | Description |
|---------|-------------|
| `sqs_list_queues` | List queues with prefix filter |
| `sqs_get_queue_attributes` | Get queue attributes including message counts |
| `sqs_receive_message` | Peek at queue messages (does not delete) |
| `sqs_purge_queue` | Delete all messages (irreversible) |

```
# List queues
aws("sqs_list_queues", { queueNamePrefix: "my-app" })

# Check queue depth
aws("sqs_get_queue_attributes", { queueUrl: "https://sqs..." })

# Peek at messages
aws("sqs_receive_message", { queueUrl: "https://sqs...", maxNumberOfMessages: 5 })

# Purge queue (careful!)
aws("sqs_purge_queue", { queueUrl: "https://sqs..." })
```

## CloudFormation

| Command | Description |
|---------|-------------|
| `cloudformation_describe_stack` | Get stack details, outputs, and status |

```
# Get stack details
aws("cloudformation_describe_stack", { stackName: "MyStack" })
```

## DynamoDB

See **tools-dynamodb** for DynamoDB-specific documentation.

| Command | Description |
|---------|-------------|
| `dynamodb_describe_table` | Get table metadata |
| `dynamodb_query` | Query by partition key |
| `dynamodb_scan` | Full table scan |
| `dynamodb_get_item` | Get single item |

## Credential Management

Tools use the host's AWS credential chain:
1. Environment variables (`AWS_ACCESS_KEY_ID`, etc.)
2. `~/.aws/credentials` and `~/.aws/config`
3. SSO sessions via `aws sso login`

```
# List available profiles
aws("list_profiles")

# Use a specific profile (supported on all commands)
aws("lambda_list_functions", { profile: "production", region: "us-west-2" })
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AWS_PROFILE` | Default profile |
| `AWS_REGION` | Default region |

## Common Patterns

### Debug Lambda Issues

```
# Check function config
aws("lambda_get_function", { functionName: "my-function" })

# Search recent logs
aws("logs_filter_log_events", { logGroupName: "/aws/lambda/my-function", filterPattern: "ERROR" })
```

### Check Queue Health

```
# Get queue depth
aws("sqs_get_queue_attributes", { queueUrl: "https://..." })

# Peek at messages
aws("sqs_receive_message", { queueUrl: "https://...", maxNumberOfMessages: 5 })
```

