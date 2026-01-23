---
description: Available MCP tools reference
related: tools-aws, tools-dynamodb, tools-datadog, debugging
---

# MCP Tools Reference

Tools available through the Jaypie MCP server. All tools use a unified router-style API.

## Documentation Tools

| Tool | Description |
|------|-------------|
| `skill` | Access Jaypie skill documentation |
| `version` | Get MCP server version |
| `release_notes` | Browse package release notes |

### Using Skills

```
skill("index")          # List all skills
skill("jaypie")         # Jaypie overview
skill("tests")          # Testing patterns
```

### Release Notes

```
release_notes()                                    # Show help
release_notes("list")                              # List all release notes
release_notes("list", { package: "mcp" })          # Filter by package
release_notes("read", { package: "mcp", version: "0.5.0" })  # Read specific note
```

## AWS Tool

Unified tool for Lambda, S3, SQS, CloudWatch Logs, Step Functions, CloudFormation, and DynamoDB.

See **tools-aws** for complete documentation.

```
aws()                   # Show help with all commands
aws("list_profiles")    # List AWS profiles
aws("lambda_list_functions", { region: "us-east-1" })
aws("dynamodb_query", { tableName: "...", keyConditionExpression: "..." })
```

| Command | Description |
|---------|-------------|
| `list_profiles` | List AWS profiles from ~/.aws |
| `lambda_list_functions`, `lambda_get_function` | Lambda management |
| `logs_filter_log_events` | CloudWatch Logs search |
| `s3_list_objects` | S3 bucket operations |
| `sqs_list_queues`, `sqs_get_queue_attributes`, `sqs_receive_message`, `sqs_purge_queue` | SQS operations |
| `stepfunctions_list_executions`, `stepfunctions_stop_execution` | Step Functions |
| `cloudformation_describe_stack` | CloudFormation stack details |
| `dynamodb_describe_table`, `dynamodb_query`, `dynamodb_scan`, `dynamodb_get_item` | DynamoDB |

## Datadog Tool

Unified tool for logs, monitors, metrics, synthetics, and RUM.

See **tools-datadog** for complete documentation.

```
datadog()               # Show help with all commands
datadog("logs", { query: "status:error", from: "now-1h" })
datadog("monitors", { status: ["Alert", "Warn"] })
```

| Command | Description |
|---------|-------------|
| `logs` | Search log entries |
| `log_analytics` | Aggregate logs with groupBy |
| `monitors` | List and check monitors |
| `synthetics` | List synthetic tests |
| `metrics` | Query timeseries metrics |
| `rum` | Search RUM events |

## LLM Tool

```
llm()                   # Show help
llm("list_providers")   # List available LLM providers
llm("debug_call", { provider: "openai", message: "Hello" })
```

| Command | Description |
|---------|-------------|
| `list_providers` | List available LLM providers |
| `debug_call` | Debug LLM API call |

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

