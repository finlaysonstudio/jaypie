# @jaypie/mcp

Model Context Protocol (MCP) server for Jaypie development. Provides tools for AI agents to access Jaypie documentation, development guides, Datadog observability data, and AWS CLI operations.

## Overview

`@jaypie/mcp` provides a complete MCP server that can be used via:
- **CLI**: Run as `npx jaypie-mcp` for stdio-based MCP server
- **Express Handler**: Integrate MCP via HTTP with `mcpExpressHandler`

## Installation

```bash
npm install @jaypie/mcp
```

## Usage

### CLI (stdio transport)

```bash
npx jaypie-mcp          # Run MCP server via stdio
npx jaypie-mcp --verbose # Run with debug logging
```

### Express Integration (HTTP transport)

```typescript
import express from "express";
import { mcpExpressHandler } from "@jaypie/mcp";

const app = express();
app.use(express.json());
app.use("/mcp", await mcpExpressHandler({ version: "1.0.0" }));
```

### Direct Server Creation

```typescript
import { createMcpServer } from "@jaypie/mcp";

const server = createMcpServer({ version: "1.0.0", verbose: true });
```

## MCP Tools

### Documentation Tools

| Tool | Description |
|------|-------------|
| `list_prompts` | Lists Jaypie development prompts and guides |
| `read_prompt` | Returns content of a specific prompt file |
| `version` | Returns package version string |

### AWS CLI Tools (16 tools)

Requires AWS CLI installed and configured with credentials.

| Tool | Description |
|------|-------------|
| `aws_list_profiles` | List available AWS profiles from ~/.aws/config and credentials |
| `aws_stepfunctions_list_executions` | List Step Function executions for a state machine |
| `aws_stepfunctions_stop_execution` | Stop a running Step Function execution |
| `aws_lambda_list_functions` | List Lambda functions with optional prefix filtering |
| `aws_lambda_get_function` | Get configuration and details for a specific Lambda function |
| `aws_logs_filter_log_events` | Search CloudWatch Logs with pattern and time range filtering |
| `aws_s3_list_objects` | List objects in an S3 bucket with optional prefix filtering |
| `aws_cloudformation_describe_stack` | Get details and status of a CloudFormation stack |
| `aws_dynamodb_describe_table` | Get metadata about a DynamoDB table |
| `aws_dynamodb_scan` | Scan a DynamoDB table (use sparingly on large tables) |
| `aws_dynamodb_query` | Query a DynamoDB table by partition key |
| `aws_dynamodb_get_item` | Get a single item from a DynamoDB table by primary key |
| `aws_sqs_list_queues` | List SQS queues with optional prefix filtering |
| `aws_sqs_get_queue_attributes` | Get queue attributes including message counts |
| `aws_sqs_receive_message` | Peek at messages in an SQS queue (does not delete) |
| `aws_sqs_purge_queue` | Delete all messages from an SQS queue (irreversible) |

### Datadog Tools (6 tools)

Requires `DATADOG_API_KEY` and `DATADOG_APP_KEY` environment variables.

| Tool | Description |
|------|-------------|
| `datadog_logs` | Search individual log entries |
| `datadog_log_analytics` | Aggregate logs with groupBy operations |
| `datadog_monitors` | List and filter monitors by status/tags |
| `datadog_synthetics` | List synthetic tests or get results for a specific test |
| `datadog_metrics` | Query timeseries metrics |
| `datadog_rum` | Search Real User Monitoring events |

### LLM Tools (2 tools)

| Tool | Description |
|------|-------------|
| `llm_debug_call` | Debug LLM API calls and inspect raw responses |
| `llm_list_providers` | List available LLM providers with their models |

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

## Exports

```typescript
import { createMcpServer, mcpExpressHandler } from "@jaypie/mcp";
import type { CreateMcpServerOptions, McpExpressHandlerOptions } from "@jaypie/mcp";
```

## Related Packages

- [@jaypie/llm](./llm) - LLM utilities
- [@jaypie/aws](./aws) - AWS SDK utilities
