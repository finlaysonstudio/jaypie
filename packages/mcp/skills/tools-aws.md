---
description: AWS MCP tools for Lambda, S3, SQS, CloudWatch, Step Functions, CloudFormation
related: aws, tools, tools-dynamodb
---

# AWS MCP Tools

Tools for interacting with AWS services via the Jaypie MCP. Uses your local AWS credentials.

## Lambda Functions

| Tool | Description |
|------|-------------|
| `aws_lambda_list_functions` | List functions with optional prefix filter |
| `aws_lambda_get_function` | Get function configuration and details |

```
# List all functions
aws_lambda_list_functions

# Filter by prefix
aws_lambda_list_functions --prefix "my-api"

# Get function details
aws_lambda_get_function --functionName "my-api-handler"
```

## Step Functions

| Tool | Description |
|------|-------------|
| `aws_stepfunctions_list_executions` | List executions for a state machine |
| `aws_stepfunctions_stop_execution` | Stop a running execution |

```
# List recent executions
aws_stepfunctions_list_executions --stateMachineArn "arn:aws:states:..."

# Stop a running execution
aws_stepfunctions_stop_execution --executionArn "arn:aws:states:..."
```

## CloudWatch Logs

| Tool | Description |
|------|-------------|
| `aws_logs_filter_log_events` | Search logs with patterns and time ranges |

```
# Search for errors in Lambda logs
aws_logs_filter_log_events --logGroupName "/aws/lambda/my-function" --filterPattern "ERROR"

# Search with time range
aws_logs_filter_log_events --logGroupName "/aws/lambda/my-function" --startTime "2024-01-15T10:00:00Z"
```

## S3

| Tool | Description |
|------|-------------|
| `aws_s3_list_objects` | List bucket objects with prefix filtering |

```
# List all objects
aws_s3_list_objects --bucket "my-bucket"

# Filter by prefix
aws_s3_list_objects --bucket "my-bucket" --prefix "uploads/"
```

## SQS

| Tool | Description |
|------|-------------|
| `aws_sqs_list_queues` | List queues with prefix filter |
| `aws_sqs_get_queue_attributes` | Get queue attributes including message counts |
| `aws_sqs_receive_message` | Peek at queue messages (does not delete) |
| `aws_sqs_purge_queue` | Delete all messages (irreversible) |

```
# List queues
aws_sqs_list_queues --prefix "my-app"

# Check queue depth
aws_sqs_get_queue_attributes --queueUrl "https://sqs..."

# Peek at messages
aws_sqs_receive_message --queueUrl "https://sqs..." --maxNumberOfMessages 5

# Purge queue (careful!)
aws_sqs_purge_queue --queueUrl "https://sqs..."
```

## CloudFormation

| Tool | Description |
|------|-------------|
| `aws_cloudformation_describe_stack` | Get stack details, outputs, and status |

```
# Get stack details
aws_cloudformation_describe_stack --stackName "MyStack"
```

## Credential Management

Tools use the host's AWS credential chain:
1. Environment variables (`AWS_ACCESS_KEY_ID`, etc.)
2. `~/.aws/credentials` and `~/.aws/config`
3. SSO sessions via `aws sso login`

```
# List available profiles
aws_list_profiles

# Use a specific profile (supported on all tools)
aws_lambda_list_functions --profile production --region us-west-2
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
aws_lambda_get_function --functionName "my-function"

# Search recent logs
aws_logs_filter_log_events --logGroupName "/aws/lambda/my-function" --filterPattern "ERROR"
```

### Check Queue Health

```
# Get queue depth
aws_sqs_get_queue_attributes --queueUrl "https://..."

# Peek at messages
aws_sqs_receive_message --queueUrl "https://..." --maxNumberOfMessages 5
```

