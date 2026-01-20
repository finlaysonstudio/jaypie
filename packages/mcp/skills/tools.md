---
description: Available MCP tools reference
---

# MCP Tools Reference

Tools available through the Jaypie MCP server.

## Documentation Tools

| Tool | Description |
|------|-------------|
| `skill` | Access Jaypie skill documentation |
| `list_prompts` | List prompt files (deprecated, use skill) |
| `read_prompt` | Read prompt file (deprecated, use skill) |
| `version` | Get MCP server version |
| `list_release_notes` | List package release notes |
| `read_release_note` | Read specific release note |

### Using Skills

```
skill("index")          # List all skills
skill("introduction")   # Jaypie overview
skill("tests")          # Testing patterns
```

## AWS Tools

| Tool | Description |
|------|-------------|
| `aws_list_profiles` | List AWS profiles from ~/.aws |
| `aws_lambda_list_functions` | List Lambda functions |
| `aws_lambda_get_function` | Get Lambda function details |
| `aws_logs_filter_log_events` | Search CloudWatch Logs |
| `aws_s3_list_objects` | List S3 bucket objects |
| `aws_cloudformation_describe_stack` | Get CloudFormation stack details |

### DynamoDB

| Tool | Description |
|------|-------------|
| `aws_dynamodb_describe_table` | Get table metadata |
| `aws_dynamodb_query` | Query by partition key |
| `aws_dynamodb_scan` | Full table scan |
| `aws_dynamodb_get_item` | Get single item |

### SQS

| Tool | Description |
|------|-------------|
| `aws_sqs_list_queues` | List SQS queues |
| `aws_sqs_get_queue_attributes` | Get queue attributes |
| `aws_sqs_receive_message` | Peek at messages |
| `aws_sqs_purge_queue` | Delete all messages |

### Step Functions

| Tool | Description |
|------|-------------|
| `aws_stepfunctions_list_executions` | List state machine executions |
| `aws_stepfunctions_stop_execution` | Stop running execution |

## Datadog Tools

| Tool | Description |
|------|-------------|
| `datadog_logs` | Search log entries |
| `datadog_log_analytics` | Aggregate logs with groupBy |
| `datadog_monitors` | List and check monitors |
| `datadog_synthetics` | List synthetic tests |
| `datadog_metrics` | Query timeseries metrics |
| `datadog_rum` | Search RUM events |

## LLM Tools

| Tool | Description |
|------|-------------|
| `llm_debug_call` | Debug LLM API call |
| `llm_list_providers` | List available LLM providers |

## Environment Variables

### AWS Tools
- `AWS_PROFILE` - Default profile
- `AWS_REGION` - Default region

### Datadog Tools
- `DATADOG_API_KEY` or `DD_API_KEY` - API key
- `DATADOG_APP_KEY` or `DD_APP_KEY` - App key
- `DD_ENV` - Default environment filter
- `DD_SERVICE` - Default service filter
- `DD_SOURCE` - Default log source

## Common Patterns

### Debug Lambda Issues

```
# Check function config
aws_lambda_get_function --functionName "my-function"

# Search recent logs
aws_logs_filter_log_events --logGroupName "/aws/lambda/my-function" --filterPattern "ERROR"

# Or via Datadog
datadog_logs --query "service:my-function status:error" --from "now-1h"
```

### Check Queue Health

```
# Get queue depth
aws_sqs_get_queue_attributes --queueUrl "https://..."

# Peek at messages
aws_sqs_receive_message --queueUrl "https://..." --maxNumberOfMessages 5
```

### Monitor Status

```
# Check alerting monitors
datadog_monitors --status '["Alert", "Warn"]'
```

## See Also

- `skill("aws")` - AWS integration guide
- `skill("datadog")` - Datadog guide
- `skill("debugging")` - Debugging techniques
