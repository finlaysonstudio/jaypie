# @jaypie/mcp HTTP Transport Usage Example

This example demonstrates how to use the `@jaypie/mcp` package with HTTP transport for Express integration.

## Installation

```bash
npm install @jaypie/mcp express
```

## Basic Usage

### Express Server Setup

```typescript
import express from "express";
import { mcpExpressHandler } from "@jaypie/mcp";

const app = express();

// Required: Parse JSON request bodies
app.use(express.json());

// Mount MCP server at /mcp endpoint
app.use("/mcp", await mcpExpressHandler({
  version: "1.0.0",
  enableSessions: true,
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP server running on http://localhost:${PORT}/mcp`);
});
```

## Configuration Options

### Stateful Mode (Default)

```typescript
app.use("/mcp", await mcpExpressHandler({
  version: "1.0.0",
  enableSessions: true, // Default
}));
```

In stateful mode:
- Session IDs are automatically generated and included in response headers
- Session state is maintained in-memory
- Clients must include session IDs in subsequent requests

### Stateless Mode

```typescript
app.use("/mcp", await mcpExpressHandler({
  version: "1.0.0",
  enableSessions: false,
}));
```

In stateless mode:
- No session IDs are generated or validated
- Each request is independent
- Useful for serverless deployments or load-balanced environments

### Custom Session ID Generation

```typescript
import { randomUUID } from "crypto";

app.use("/mcp", await mcpExpressHandler({
  version: "1.0.0",
  sessionIdGenerator: () => randomUUID(),
}));
```

### JSON Response Mode

By default, the server uses Server-Sent Events (SSE) for streaming responses. You can enable simple JSON responses instead:

```typescript
app.use("/mcp", await mcpExpressHandler({
  version: "1.0.0",
  enableJsonResponse: true,
}));
```

## Complete Example with Multiple Endpoints

```typescript
import express from "express";
import { mcpExpressHandler } from "@jaypie/mcp";

const app = express();

app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// MCP server endpoint (stateful)
app.use("/mcp", await mcpExpressHandler({
  version: "1.0.0",
  enableSessions: true,
}));

// Alternative MCP endpoint (stateless for serverless)
app.use("/mcp-stateless", await mcpExpressHandler({
  version: "1.0.0",
  enableSessions: false,
  enableJsonResponse: true,
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`MCP (stateful): http://localhost:${PORT}/mcp`);
  console.log(`MCP (stateless): http://localhost:${PORT}/mcp-stateless`);
});
```

## Available Tools

The Jaypie MCP server registers four router-style tools. Each tool returns help when called without a command.

| Tool | Description |
|------|-------------|
| `skill` | Access Jaypie skill documentation |
| `version` | Print the `@jaypie/mcp` version and build hash |
| `release_notes` | Browse package release notes |
| `datadog` | Query Datadog logs, monitors, metrics, synthetics, and RUM |

### `skill`

**Parameters:**
- `alias` (string, optional): Skill alias (e.g., `tests`). Omit or pass `index` to list all skills.

```
skill()                 # List all skills
skill("jaypie")         # Jaypie overview
skill("tests")          # Testing patterns
```

### `version`

**Parameters:** None

### `release_notes`

**Parameters:**
- `command` (string, optional): `list` or `read`. Omit for help.
- `input` (object, optional): Command parameters

| Command | Description | Parameters |
|---------|-------------|------------|
| `list` | List release notes | `package`, `since_version` (both optional) |
| `read` | Read one release note | `package`, `version` (both required) |

```
release_notes("list", { package: "mcp" })
release_notes("read", { package: "mcp", version: "0.5.0" })
```

### `datadog`

Requires `DATADOG_API_KEY` (or `DD_API_KEY`) and `DATADOG_APP_KEY` (or `DD_APP_KEY`).

| Command | Description |
|---------|-------------|
| `logs` | Search log entries |
| `log_analytics` | Aggregate logs with groupBy |
| `monitors` | List and check monitors |
| `synthetics` | List synthetic tests or get results for one test |
| `metrics` | Query timeseries metrics |
| `rum` | Search RUM events |
| `validate` | Check Datadog key configuration without calling the API |

```
datadog("logs", { query: "status:error", from: "now-1h" })
datadog("monitors", { status: "Alert,Warn" })
```

See the `mcp-datadog` skill (`skill("mcp-datadog")`) for every parameter.

## Transport Comparison

### stdio Transport (CLI Tool)

The original stdio transport is still available for use as a CLI tool:

```bash
npx jaypie-mcp
```

This mode is useful when:
- Running the MCP server as a standalone process
- Integrating with tools that expect stdio-based MCP servers
- Local development and testing

### HTTP Transport (Express Integration)

The new HTTP transport is ideal when:
- Building web applications with MCP capabilities
- Deploying to serverless platforms (with stateless mode)
- Exposing MCP functionality over HTTP/HTTPS
- Integrating with existing Express.js applications

## Deployment Considerations

### Serverless Deployment

For serverless environments (AWS Lambda, Vercel, etc.), use stateless mode:

```typescript
export const handler = await mcpExpressHandler({
  version: "1.0.0",
  enableSessions: false,
  enableJsonResponse: true,
});
```

### Traditional Server Deployment

For long-running server processes, stateful mode works well:

```typescript
app.use("/mcp", await mcpExpressHandler({
  version: "1.0.0",
  enableSessions: true,
}));
```

## Security Considerations

1. **CORS**: Configure CORS appropriately for your use case
2. **Authentication**: Add authentication middleware before the MCP handler
3. **Rate Limiting**: Consider rate limiting for public endpoints
4. **HTTPS**: Always use HTTPS in production

Example with authentication:

```typescript
import { authenticateUser } from "./auth.js";

app.use("/mcp", authenticateUser, await mcpExpressHandler({
  version: "1.0.0",
}));
```

## Troubleshooting

### "Cannot find module" errors

Ensure you've installed all dependencies:
```bash
npm install @jaypie/mcp express
```

### Request body is undefined

Make sure to use `express.json()` middleware before the MCP handler:
```typescript
app.use(express.json());
app.use("/mcp", await mcpExpressHandler());
```

### TypeScript errors

Install type definitions:
```bash
npm install --save-dev @types/express
```
