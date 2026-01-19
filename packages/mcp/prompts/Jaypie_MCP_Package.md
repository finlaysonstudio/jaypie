---
description: MCP server package with documentation, AWS, Datadog, and LLM tools
include: "packages/mcp/**"
---

# @jaypie/mcp Package

The `@jaypie/mcp` package provides a Model Context Protocol (MCP) server for AI agents working with Jaypie projects. It includes tools for accessing documentation, AWS CLI operations, Datadog observability, and LLM debugging.

## Package Structure

```
packages/mcp/
├── src/
│   ├── index.ts              # CLI entrypoint, exports createMcpServer and mcpExpressHandler
│   ├── createMcpServer.ts    # Core MCP server factory with tool definitions
│   ├── mcpExpressHandler.ts  # Express middleware for HTTP transport
│   ├── aws.ts                # AWS CLI integration (spawn-based)
│   ├── datadog.ts            # Datadog API integration (https-based)
│   └── llm.ts                # LLM debug utilities
├── prompts/                  # Markdown guides served via list_prompts/read_prompt tools
└── dist/                     # Built output
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

## MCP Tools (27 total)

### Documentation Tools (3)

| Tool | Description |
|------|-------------|
| `list_prompts` | Lists all `.md` files in `prompts/` with descriptions and required file patterns |
| `read_prompt` | Returns content of a specific prompt file |
| `version` | Returns package version string |

### AWS CLI Tools (16)

Requires AWS CLI installed and configured. All tools accept optional `profile` and `region` parameters.

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

### Datadog Tools (6)

Requires `DATADOG_API_KEY` and `DATADOG_APP_KEY` environment variables.

| Tool | Description |
|------|-------------|
| `datadog_logs` | Search individual log entries |
| `datadog_log_analytics` | Aggregate logs with groupBy operations |
| `datadog_monitors` | List and filter monitors by status/tags |
| `datadog_synthetics` | List synthetic tests or get results for a specific test |
| `datadog_metrics` | Query timeseries metrics |
| `datadog_rum` | Search Real User Monitoring events |

### LLM Tools (2)

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

## Adding New Tools

Tools are registered in `createMcpServer.ts` using the MCP SDK pattern:

```typescript
server.tool(
  "tool_name",
  "Description shown to AI agents",
  {
    // Zod schema for parameters
    param1: z.string().describe("Parameter description"),
    param2: z.number().optional().describe("Optional parameter"),
  },
  async ({ param1, param2 }) => {
    // Implementation
    return {
      content: [{ type: "text" as const, text: "Result text" }],
    };
  },
);
```

### AWS Tool Pattern

AWS tools use `child_process.spawn` to call the AWS CLI:

```typescript
// In aws.ts
export async function myAwsOperation(
  options: MyOperationOptions,
  logger: Logger = nullLogger,
): Promise<AwsCommandResult<MyResultType>> {
  const args = ["--required-arg", options.requiredArg];
  if (options.optionalArg) {
    args.push("--optional-arg", options.optionalArg);
  }

  return executeAwsCommand(
    "service-name",    // e.g., "stepfunctions", "lambda", "s3api"
    "command-name",    // e.g., "list-executions", "get-function"
    args,
    { profile: options.profile, region: options.region },
    logger,
  );
}
```

### Datadog Tool Pattern

Datadog tools use Node.js `https` module directly:

```typescript
// In datadog.ts
export async function myDatadogOperation(
  credentials: DatadogCredentials,
  options: MyOptions,
  logger: Logger = nullLogger,
): Promise<MyResult> {
  const requestOptions = {
    hostname: "api.datadoghq.com",
    port: 443,
    path: "/api/v2/endpoint",
    method: "POST",
    headers: {
      "DD-API-KEY": credentials.apiKey,
      "DD-APPLICATION-KEY": credentials.appKey,
      "Content-Type": "application/json",
    },
  };

  return new Promise((resolve) => {
    const req = https.request(requestOptions, (res) => {
      // Handle response
    });
    req.write(JSON.stringify(body));
    req.end();
  });
}
```

## Adding New Prompts

Prompts are markdown files in `prompts/` with optional YAML frontmatter:

```yaml
---
description: Brief description shown in list_prompts
include: "packages/express/**"  # File patterns this guide applies to
---

# Prompt Title

Markdown content here...
```

Prompts are automatically available via `list_prompts` and `read_prompt` tools.

## Exports

```typescript
import { createMcpServer, mcpExpressHandler } from "@jaypie/mcp";
import type { CreateMcpServerOptions, McpExpressHandlerOptions } from "@jaypie/mcp";
```

## Commands

```bash
npm run build -w packages/mcp      # Build with rollup
npm run test -w packages/mcp       # Run tests (vitest run)
npm run typecheck -w packages/mcp  # Type check (tsc --noEmit)
npm run format packages/mcp        # Format with eslint --fix
```

## Security Considerations

1. **Allowlisted operations only** - No arbitrary command execution
2. **Read-heavy design** - Most tools are read-only; mutating operations have explicit warnings
3. **No credential exposure** - Credentials never passed through MCP; uses host's credential chain
4. **Profile isolation** - Each call can specify a different profile for multi-account work
