---
title: "@jaypie/mcp"
---


**Prerequisites:** `npm install @jaypie/mcp`

**Status:** Experimental - APIs may change

## Overview

`@jaypie/mcp` is the Jaypie MCP (Model Context Protocol) server. It gives AI assistants access to Jaypie skill documentation, package release notes, and Datadog observability data. Run it over stdio as a CLI or mount it over HTTP in Express.

## Installation

```bash
npm install @jaypie/mcp
```

## Quick Reference

### Exports

| Export | Purpose |
|--------|---------|
| `createMcpServer` | Create an MCP server instance with the Jaypie tools registered |
| `mcpExpressHandler` | Resolve an Express handler serving the MCP server over HTTP |

### Tools

| Tool | Description |
|------|-------------|
| `skill` | Access Jaypie skill documentation |
| `version` | Print the `@jaypie/mcp` version and build hash |
| `release_notes` | Browse package release notes |
| `datadog` | Query Datadog logs, monitors, metrics, synthetics, and RUM |

Every tool is router-style: call it with no command to get help.

## Running the Server

### CLI (stdio transport)

```bash
npx jaypie-mcp           # Run MCP server via stdio
npx jaypie-mcp --verbose # Run with debug logging on stderr
```

### Express (HTTP transport)

`mcpExpressHandler` returns a Promise. Await it before mounting.

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

## Skills

```
skill()                 # List all skills
skill("jaypie")         # Jaypie overview
skill("tests")          # Testing patterns
```

Set `MCP_SKILLS_PATH` to layer a directory of local skills over the built-in Jaypie skills. Local skills take precedence; built-in skills remain available with the `jaypie:` prefix (e.g., `skill("jaypie:tests")`). See [@jaypie/tildeskill](/docs/experimental/tildeskill/) for the skill store.

## Release Notes

| Command | Description | Parameters |
|---------|-------------|------------|
| `list` | List release notes | `package`, `since_version` (both optional) |
| `read` | Read one release note | `package`, `version` (both required) |

```
release_notes("list", { package: "jaypie", since_version: "1.2.0" })
release_notes("read", { package: "mcp", version: "0.5.0" })
```

## Datadog

The `datadog` tool is `datadogService` from `@jaypie/datadog`.

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
datadog("logs", { query: "status:error", from: "now-1h" })
datadog("monitors", { status: "Alert,Warn" })
```

## Custom MCP Tools

`@jaypie/mcp` does not export tool registration helpers. Register your own Jaypie services as MCP tools with `fabricMcp` from `@jaypie/fabric/mcp`:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fabricService } from "@jaypie/fabric";
import { fabricMcp } from "@jaypie/fabric/mcp";

const getUser = fabricService({
  alias: "get_user",
  description: "Get user by ID",
  input: {
    userId: { type: String },
  },
  service: async ({ userId }) => db.users.findById(userId),
});

const server = new McpServer({ name: "my-service", version: "1.0.0" });
fabricMcp({ server, service: getUser });
```

See [Fabric](/docs/experimental/fabric/) for the MCP adapter and `createMcpServerFromSuite`.

## Configuration

| Variable | Purpose |
|----------|---------|
| `DATADOG_API_KEY` or `DD_API_KEY` | Datadog API key |
| `DATADOG_APP_KEY` or `DD_APP_KEY` | Datadog application key |
| `DD_ENV` | Default Datadog environment filter |
| `DD_QUERY` | Default query terms added to Datadog searches |
| `MCP_SKILLS_PATH` | Directory of local skills layered over the built-in skills |

## Related

- [@jaypie/mcp API](/docs/api/mcp/) - Full tool and environment reference
- [Fabric](/docs/experimental/fabric/) - Service handler patterns and the MCP adapter
- [@jaypie/tildeskill](/docs/experimental/tildeskill/) - Skill store behind the `skill` tool
