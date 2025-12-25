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
│   └── datadog.ts         # Datadog API integration (logs, monitors, synthetics, metrics, RUM)
├── prompts/               # Markdown guides served via list_prompts/read_prompt tools
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

### Datadog Tools (require DATADOG_API_KEY and DATADOG_APP_KEY)
- `datadog_logs` - Search individual log entries
- `datadog_log_analytics` - Aggregate logs with groupBy operations
- `datadog_monitors` - List and filter monitors by status/tags
- `datadog_synthetics` - List synthetic tests or get results for a specific test
- `datadog_metrics` - Query timeseries metrics
- `datadog_rum` - Search Real User Monitoring events

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

## Environment Variables

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
- `gray-matter` - YAML frontmatter parsing for prompts
- `zod` - Schema validation for tool parameters

## Integration with Other Packages

This package is used by AI agents when working on any Jaypie project. The prompts provide context about:
- Package-specific conventions (Express, CDK, Lambda)
- Development workflows and testing patterns
- Error handling and logging standards
- Project structure and initialization guides
