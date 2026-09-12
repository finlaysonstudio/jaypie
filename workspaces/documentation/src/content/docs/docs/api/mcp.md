---
title: "@jaypie/mcp"
---

Model Context Protocol (MCP) server for Jaypie development. Provides tools for AI agents to access Jaypie skill documentation, release notes, and Datadog observability data.

## Overview

`@jaypie/mcp` provides a complete MCP server that can be used via:
- **CLI**: Run as `npx jaypie-mcp` for stdio-based MCP server
- **Express Handler**: Integrate MCP via HTTP with `mcpExpressHandler`
- **Streamable HTTP Handler**: Serve any fabric `ServiceSuite` from a Jaypie Lambda with `mcpHttpHandler` from `@jaypie/mcp/http`, without `@modelcontextprotocol/sdk`

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

### Streamable HTTP on Lambda (no SDK)

```typescript
import express from "express";
import { createLambdaStreamHandler } from "@jaypie/express";
import { mcpHttpHandler } from "@jaypie/mcp/http";

const app = express();
app.use(express.json());
app.all("/mcp", mcpHttpHandler({ services: ["skill", "version"] }));

export const handler = createLambdaStreamHandler(app);
```

The handler answers one JSON body, or server-sent events when `Accept` prefers `text/event-stream`. Notifications answer 202 with no body; GET and DELETE answer 405. Pass `suite` to serve any `ServiceSuite`, and `secrets`, `setup`, or `validate` to run the Jaypie handler lifecycle. Deploy behind a Function URL with `RESPONSE_STREAM` invoke mode for streaming, or use `createLambdaHandler` for buffered JSON.

### Filtering Tools

`createMcpServer`, `mcpExpressHandler`, `mcpHttpHandler`, and `createMcpServerFromSuite` (from `@jaypie/fabric/mcp`) accept `services`, an allowlist of tool names:

```typescript
const server = createMcpServer({ services: ["skill", "version"] });
```

## MCP Tools

The server registers four router-style tools. Each tool returns help when called without a command.

| Tool | Description |
|------|-------------|
| `skill` | Access Jaypie skill documentation |
| `version` | Print the `@jaypie/mcp` version and build hash |
| `release_notes` | Browse package release notes |
| `datadog` | Query Datadog logs, monitors, metrics, synthetics, and RUM |

### skill

```
skill()                 # List all skills
skill("jaypie")         # Jaypie overview
skill("tests")          # Testing patterns
```

Input: `alias` (optional). Omit or pass `index` to list all skills.

### version

Takes no input.

### release_notes

| Command | Description | Parameters |
|---------|-------------|------------|
| `list` | List release notes | `package`, `since_version` (both optional) |
| `read` | Read one release note | `package`, `version` (both required) |

```
release_notes()                                              # Show help
release_notes("list", { package: "mcp" })                    # Filter by package
release_notes("read", { package: "mcp", version: "0.5.0" })  # Read one note
```

### datadog

Defined in [@jaypie/datadog](/docs/api/datadog/) as `datadogService`. Requires Datadog API and application keys.

| Command | Description |
|---------|-------------|
| `logs` | Search log entries |
| `log_analytics` | Aggregate logs with groupBy |
| `monitors` | List and check monitors |
| `synthetics` | List synthetic tests or get results for one test |
| `metrics` | Query timeseries metrics |
| `rum` | Search Real User Monitoring events |
| `validate` | Check Datadog key configuration without calling the API |

```
datadog()                                                  # Show help
datadog("logs", { query: "status:error", from: "now-1h" })
datadog("monitors", { status: "Alert,Warn" })
```

## Environment Variables

### Skills and Release Notes

| Variable | Description |
|----------|-------------|
| `MCP_SKILLS_PATH` | Directory of local skills layered over the built-in Jaypie skills (built-ins remain available under `jaypie:`) |
| `MCP_BUILTIN_SKILLS_PATH` | Relocate the bundled Jaypie skills directory (e.g., esbuild Lambda bundles) |
| `MCP_RELEASE_NOTES_PATH` | Relocate the bundled release notes directory |

### Datadog Integration

| Variable | Description |
|----------|-------------|
| `DATADOG_API_KEY` or `DD_API_KEY` | Datadog API key |
| `DATADOG_APP_KEY` or `DD_APP_KEY` | Datadog application key |
| `DD_ENV` | Default environment filter |
| `DD_QUERY` | Default query terms added to searches |
| `DD_SITE` | Datadog site (defaults to `datadoghq.com`) |

Either key may be held in Secrets Manager. `SECRET_DATADOG_API_KEY`, `DATADOG_API_KEY_ARN`, and `DD_API_KEY_SECRET_ARN` take an ARN; any key name also accepts a `SECRET_<NAME>` or `<NAME>_SECRET` reference.

## Exports

```typescript
import { createMcpServer, mcpExpressHandler } from "@jaypie/mcp";
import type { CreateMcpServerOptions, McpExpressHandlerOptions } from "@jaypie/mcp";

import { handleMcpRpc, handleMcpRpcBody, mcpHttpHandler } from "@jaypie/mcp/http";
import type { McpHttpHandlerOptions, McpRpcOptions } from "@jaypie/mcp/http";
```

## Related Packages

- [@jaypie/datadog](/docs/api/datadog/) - Datadog utilities and the `datadog` tool
- [@jaypie/fabric](/docs/experimental/fabric/) - Service handlers and the MCP adapter
