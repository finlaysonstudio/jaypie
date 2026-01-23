---
description: Available MCP tools reference
related: tools-aws, tools-dynamodb, tools-datadog, debugging
---

# MCP Tools Reference

Tools available through the Jaypie MCP server.

## Documentation Tools

| Tool | Description |
|------|-------------|
| `skill` | Access Jaypie skill documentation |
| `version` | Get MCP server version |
| `list_release_notes` | List package release notes |
| `read_release_note` | Read specific release note |

### Using Skills

```
skill("index")          # List all skills
skill("jaypie")         # Jaypie overview
skill("tests")          # Testing patterns
```

## AWS Tools

Tools for Lambda, S3, SQS, CloudWatch Logs, Step Functions, and CloudFormation.

See **tools-aws** for complete documentation.

| Tool | Description |
|------|-------------|
| `aws_list_profiles` | List AWS profiles from ~/.aws |
| `aws_lambda_*` | Lambda function management |
| `aws_logs_*` | CloudWatch Logs search |
| `aws_s3_*` | S3 bucket operations |
| `aws_sqs_*` | SQS queue operations |
| `aws_stepfunctions_*` | Step Functions management |
| `aws_cloudformation_*` | CloudFormation stack details |

## DynamoDB Tools

Tools for querying, scanning, and inspecting DynamoDB tables.

See **tools-dynamodb** for complete documentation.

| Tool | Description |
|------|-------------|
| `aws_dynamodb_describe_table` | Get table metadata |
| `aws_dynamodb_query` | Query by partition key |
| `aws_dynamodb_scan` | Full table scan |
| `aws_dynamodb_get_item` | Get single item |

## Datadog Tools

Tools for logs, monitors, metrics, synthetics, and RUM.

See **tools-datadog** for complete documentation.

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

