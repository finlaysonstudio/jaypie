---
description: Jaypie MCP server tools reference
related: mcp-datadog, debugging, express, fabric, streaming
---

# Jaypie MCP

Tools provided by the Jaypie MCP server. All tools use a unified router-style API.

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

## Datadog Tool

Unified tool for logs, monitors, metrics, synthetics, and RUM.

See **mcp-datadog** for complete documentation.

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

## Serving MCP over HTTP

### Streamable HTTP without the SDK (`@jaypie/mcp/http`)

`mcpHttpHandler` serves a fabric `ServiceSuite` as MCP streamable HTTP from an Express route or a Jaypie Lambda. It implements stateless JSON-RPC 2.0 directly and never loads `@modelcontextprotocol/sdk`, whose Node transport fails against `LambdaRequest`.

```typescript
import express from "express";
import { createLambdaStreamHandler } from "@jaypie/express";
import { mcpHttpHandler } from "@jaypie/mcp/http";

const app = express();
app.use(express.json());
app.all(
  "/mcp",
  mcpHttpHandler({
    secrets: ["PROJECT_API_KEY"],
    services: ["skill", "version", "release_notes"],
    setup: requireApiKey,
  }),
);

export const handler = createLambdaStreamHandler(app);
```

| Request | Response |
|---------|----------|
| POST, `Accept` absent or prefers `application/json` | 200 JSON (one response, or an array for a batch) |
| POST, `Accept` prefers `text/event-stream` | 200 SSE via `expressStreamHandler({ format: "sse" })`, one `event: message` per response |
| POST carrying only notifications | 202, no body |
| GET, DELETE, any other method | 405 with `Allow: POST` |

Methods: `initialize` (echoes a supported `protocolVersion`, else `2025-06-18`), `notifications/initialized`, `notifications/cancelled`, `ping`, `tools/list`, `tools/call`. Errors: `-32700` unparseable body, `-32600` invalid request or empty batch, `-32601` unknown method, `-32602` unknown tool or non-object arguments. A tool that throws answers `isError: true`; a Jaypie error surfaces its message, any other error answers "The tool call failed".

| Option | Default | Description |
|--------|---------|-------------|
| `suite` | Jaypie MCP suite (loaded on first request) | `ServiceSuite` served as tools |
| `services` | all | Allowlist of service aliases exposed as tools |
| `name` | `suite.name` | `serverInfo.name` reported by `initialize` |
| `version` | `suite.version` | `serverInfo.version` reported by `initialize` |
| `chaos`, `locals`, `secrets`, `setup`, `teardown`, `unavailable`, `validate`, ... | | Passed to `expressHandler` and `expressStreamHandler` |

`handleMcpRpcBody(body, options)` and `handleMcpRpc(request, options)` expose the JSON-RPC layer for other transports. `@jaypie/express` and `@jaypie/logger` are optional peer dependencies required by this entry point; `jaypie` provides both.

#### Lambda Deployment

- **Streaming**: `createLambdaStreamHandler(app)` behind a Function URL with `RESPONSE_STREAM` invoke mode (for example `JaypieDistribution` with `streaming: true`). Both JSON and SSE responses work.
- **Buffered**: `createLambdaHandler(app)` behind API Gateway or a buffered Function URL. JSON responses work; SSE responses arrive when the request completes.
- The endpoint is stateless: no sessions, no `Mcp-Session-Id`, no server-initiated GET stream. Every POST stands alone, which suits Lambda.
- Put authentication in `setup` or `validate` so it runs for both JSON and SSE requests.

#### Bundling

A bundler (esbuild) inlines the code but not the markdown that `skill` and `release_notes` read. Without that markdown, `skill("index")` answers only its heading, and the first `skill` or `release_notes` call logs a `[@jaypie/mcp]` warning to stderr naming the missing directory.

Copy both directories beside the bundle at build time. `getMcpAssetPaths` from `@jaypie/mcp/assets` returns their absolute paths in the installed package and loads nothing else.

```javascript
// esbuild.config.mjs (build options from skill("express"))
import { cpSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import { getMcpAssetPaths, MCP_ASSET_DIRECTORY } from "@jaypie/mcp/assets";

const OUT_DIR = "dist";

await build({ bundle: true, format: "esm", outfile: join(OUT_DIR, "index.mjs"), platform: "node" });

const assets = getMcpAssetPaths();
cpSync(assets.releaseNotes, join(OUT_DIR, MCP_ASSET_DIRECTORY.RELEASE_NOTES), { recursive: true });
cpSync(assets.skills, join(OUT_DIR, MCP_ASSET_DIRECTORY.SKILLS), { recursive: true });
```

Each directory resolves to the first match: its environment variable, the installed package, then the directory beside the bundle.

| Variable | Description |
|----------|-------------|
| `MCP_BUILTIN_SKILLS_PATH` | Jaypie skills directory (namespace `jaypie`) |
| `MCP_RELEASE_NOTES_PATH` | Release notes directory |
| `MCP_SKILLS_PATH` | Client skills directory layered over the Jaypie skills (namespace `local`) |

### SDK Transport (`mcpExpressHandler`)

`mcpExpressHandler` from `@jaypie/mcp` wraps the SDK's `StreamableHTTPServerTransport` with optional sessions. It suits a long-running Express server, not Lambda.

```typescript
import express from "express";
import { mcpExpressHandler } from "@jaypie/mcp";

const app = express();
app.use(express.json());
app.use("/mcp", await mcpExpressHandler({ services: ["skill"], version: "1.0.0" }));
```

## Filtering Tools

Every server factory accepts `services`, an allowlist of service aliases. Omit it to expose every tool; an empty array exposes none; unknown aliases are ignored. All share `selectServiceFunctions` from `@jaypie/fabric`.

```typescript
import { createMcpServer } from "@jaypie/mcp";
import { mcpHttpHandler } from "@jaypie/mcp/http";
import { createMcpServerFromSuite } from "@jaypie/fabric/mcp";

createMcpServer({ services: ["skill", "version"] });        // stdio / SDK
createMcpServerFromSuite(suite, { services: ["greet"] });   // any suite, SDK
mcpHttpHandler({ services: ["skill", "release_notes"] });   // no SDK
```

## Environment Variables

### Datadog Tools
- `DATADOG_API_KEY` or `DD_API_KEY` - API key
- `DATADOG_APP_KEY` or `DD_APP_KEY` - App key
- `DD_ENV` - Default environment filter
