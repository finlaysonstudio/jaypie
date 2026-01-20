# @jaypie/mcp

MCP (Model Context Protocol) server for Jaypie development. Provides tools for AI agents to access Jaypie documentation, development guides, and Datadog observability data.

## Package Overview

This package serves two purposes:
1. **CLI Tool**: Run as `npx jaypie-mcp` for stdio-based MCP server
2. **Express Handler**: Integrate MCP via HTTP with `mcpExpressHandler`

## Directory Structure

```
packages/mcp/
├── src/
│   ├── index.ts           # CLI entrypoint, exports createMcpServer and mcpExpressHandler
│   ├── createMcpServer.ts # Core MCP server factory with tool definitions
│   ├── mcpExpressHandler.ts # Express middleware for HTTP transport
│   ├── datadog.ts         # Datadog API integration (logs, monitors, synthetics, metrics, RUM)
│   └── aws.ts             # AWS CLI integration (Step Functions, Lambda, CloudWatch, S3, DynamoDB, SQS)
├── prompts/               # Markdown guides served via list_prompts/read_prompt tools
├── release-notes/         # Version history organized by package (e.g., release-notes/mcp/0.3.2.md)
└── dist/                  # Built output
```

## Exports

```typescript
import { createMcpServer, mcpExpressHandler } from "@jaypie/mcp";
import type { CreateMcpServerOptions, McpExpressHandlerOptions } from "@jaypie/mcp";
```

## MCP Tools Provided

### Documentation Tools
- `list_prompts` - Lists all `.md` files in `prompts/` with descriptions and required file patterns
- `read_prompt` - Returns content of a specific prompt file
- `version` - Returns package version string
- `list_release_notes` - Lists release notes by package, supports `since_version` filtering
- `read_release_note` - Returns full content of a specific release note

### Datadog Tools (require DATADOG_API_KEY and DATADOG_APP_KEY)
- `datadog_logs` - Search individual log entries
- `datadog_log_analytics` - Aggregate logs with groupBy operations
- `datadog_monitors` - List and filter monitors by status/tags
- `datadog_synthetics` - List synthetic tests or get results for a specific test
- `datadog_metrics` - Query timeseries metrics
- `datadog_rum` - Search Real User Monitoring events

### AWS CLI Tools (require AWS CLI installed and configured)
- `aws_list_profiles` - List available AWS profiles from ~/.aws/config and credentials
- `aws_stepfunctions_list_executions` - List Step Function executions for a state machine
- `aws_stepfunctions_stop_execution` - Stop a running Step Function execution
- `aws_lambda_list_functions` - List Lambda functions with optional prefix filtering
- `aws_lambda_get_function` - Get configuration and details for a specific Lambda function
- `aws_logs_filter_log_events` - Search CloudWatch Logs with pattern and time range filtering
- `aws_s3_list_objects` - List objects in an S3 bucket with optional prefix filtering
- `aws_cloudformation_describe_stack` - Get details and status of a CloudFormation stack
- `aws_dynamodb_describe_table` - Get metadata about a DynamoDB table including key schema and indexes
- `aws_dynamodb_scan` - Scan a DynamoDB table (use sparingly on large tables)
- `aws_dynamodb_query` - Query a DynamoDB table by partition key
- `aws_dynamodb_get_item` - Get a single item from a DynamoDB table by primary key
- `aws_sqs_list_queues` - List SQS queues with optional prefix filtering
- `aws_sqs_get_queue_attributes` - Get queue attributes including message counts
- `aws_sqs_receive_message` - Peek at messages in an SQS queue (does not delete)
- `aws_sqs_purge_queue` - Delete all messages from an SQS queue (irreversible)

## Usage Patterns

### CLI (stdio transport)
```bash
npx jaypie-mcp
npx jaypie-mcp --verbose
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

## Prompts Directory

The `prompts/` directory contains Jaypie development guides. Prompt files use optional YAML frontmatter:

```yaml
---
description: Brief description shown in list_prompts
include: "packages/express/**"  # File patterns this guide applies to
---
```

When adding new prompts:
1. Use descriptive filenames like `Jaypie_Feature_Name.md`
2. Add frontmatter with `description` and `include` when applicable
3. Prompts are automatically available via `list_prompts` and `read_prompt`

## Release Notes Directory

The `release-notes/` directory contains version history organized by package name:

```
release-notes/
├── jaypie/
│   └── 1.2.3.md
└── mcp/
    └── 0.3.2.md
```

Release note files use YAML frontmatter:

```yaml
---
version: 0.3.2
date: 2025-01-19
summary: Brief one-line summary for listing
---

## Changes

- Feature 1
- Bug fix 2
```

When adding release notes:
1. Create `release-notes/<package>/<version>.md` for each version bump
2. Add frontmatter with `version`, `date`, and `summary`
3. Notes are automatically available via `list_release_notes` and `read_release_note`

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

## Build Configuration

Uses Rollup with TypeScript. Version string is injected at build time via `@rollup/plugin-replace`.

## Commands

```bash
npm run build      # Build with rollup
npm run test       # vitest run
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run format     # eslint --fix
```

## Dependencies

- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `commander` - CLI argument parsing
- `gray-matter` - YAML frontmatter parsing for prompts and release notes
- `semver` - Version comparison for release notes filtering
- `zod` - Schema validation for tool parameters

## Integration with Other Packages

This package is used by AI agents when working on any Jaypie project. The prompts provide context about:
- Package-specific conventions (Express, CDK, Lambda)
- Development workflows and testing patterns
- Error handling and logging standards
- Project structure and initialization guides
