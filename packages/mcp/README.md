# Jaypie MCP

MCP (Model Context Protocol) server for Jaypie development. Provides tools for AI agents to access Jaypie documentation, development guides, Datadog observability data, and AWS CLI operations.

## Usage

```bash
npx jaypie-mcp          # Run MCP server via stdio
npx jaypie-mcp --verbose # Run with debug logging
```

## Environment Variables

### AWS CLI Integration
| Variable | Description |
|----------|-------------|
| `AWS_PROFILE` | Default profile if not specified per-call |
| `AWS_REGION` or `AWS_DEFAULT_REGION` | Default region if not specified |

AWS tools use the host's existing credential chain:
- `~/.aws/credentials` and `~/.aws/config` files
- Environment variables (`AWS_ACCESS_KEY_ID`, etc.)
- SSO sessions established via `aws sso login`

### Datadog Integration
| Variable | Description |
|----------|-------------|
| `DATADOG_API_KEY` or `DD_API_KEY` | Datadog API key |
| `DATADOG_APP_KEY` or `DD_APP_KEY` | Datadog Application key |
| `DD_ENV` | Default environment filter |
| `DD_SERVICE` | Default service filter |
| `DD_SOURCE` | Default log source (defaults to "lambda") |
| `DD_QUERY` | Default query terms appended to searches |

## MCP Tools

### Documentation Tools
- `skill` - Access Jaypie development documentation by alias
- `version` - Returns package version string
- `list_release_notes` - List available release notes
- `read_release_note` - Read specific release note content

### AWS CLI Tools (16 tools)
- Step Functions: `aws_stepfunctions_list_executions`, `aws_stepfunctions_stop_execution`
- Lambda: `aws_lambda_list_functions`, `aws_lambda_get_function`
- CloudWatch Logs: `aws_logs_filter_log_events`
- S3: `aws_s3_list_objects`
- CloudFormation: `aws_cloudformation_describe_stack`
- DynamoDB: `aws_dynamodb_describe_table`, `aws_dynamodb_scan`, `aws_dynamodb_query`, `aws_dynamodb_get_item`
- SQS: `aws_sqs_list_queues`, `aws_sqs_get_queue_attributes`, `aws_sqs_receive_message`, `aws_sqs_purge_queue`
- Profiles: `aws_list_profiles`

### Datadog Tools (6 tools)
- `datadog_logs`, `datadog_log_analytics`, `datadog_monitors`, `datadog_synthetics`, `datadog_metrics`, `datadog_rum`

### LLM Tools (2 tools)
- `llm_debug_call`, `llm_list_providers`

See [CLAUDE.md](./CLAUDE.md) for detailed documentation.

## License

[MIT License](./LICENSE.txt). Published by Finlayson Studio
