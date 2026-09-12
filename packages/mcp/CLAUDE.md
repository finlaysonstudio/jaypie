# @jaypie/mcp

MCP (Model Context Protocol) server for Jaypie development. Provides tools for AI agents to access Jaypie documentation, development guides, and observability data.

## Package Overview

This package serves three purposes:
1. **CLI Tool**: Run as `npx jaypie-mcp` for stdio-based MCP server
2. **Express Handler**: Integrate MCP via HTTP with `mcpExpressHandler` (SDK transport, sessions)
3. **Streamable HTTP Handler**: Serve any `ServiceSuite` from a Jaypie Lambda with `mcpHttpHandler` from `@jaypie/mcp/http` (no SDK)

## Directory Structure

```
packages/mcp/
├── src/
│   ├── index.ts              # CLI entrypoint, exports createMcpServer and mcpExpressHandler
│   ├── createMcpServer.ts    # MCP server factory using ServiceSuite
│   ├── suite.ts              # ServiceSuite registration (simplified)
│   ├── mcpExpressHandler.ts  # Express middleware for HTTP transport
│   ├── http/                 # @jaypie/mcp/http entry; never imports the SDK
│   │   ├── index.ts          # Exports mcpHttpHandler, handleMcpRpc, handleMcpRpcBody
│   │   ├── mcpHttpHandler.ts # Accept negotiation, JSON via expressHandler, SSE via expressStreamHandler, 405
│   │   ├── rpc.ts            # JSON-RPC methods, batching, error codes
│   │   └── tools.ts          # Tool selection via selectServiceFunctions
│   └── suites/               # Modular suite implementations
│       └── docs/
│           ├── index.ts      # skill, version, release_notes services
│           └── release-notes/
│               └── help.md   # Release notes help
├── skills/                   # Markdown skill files served via skill tool
├── release-notes/            # Version history organized by package
└── dist/                     # Built output
```

## Exports

```typescript
import { createMcpServer, mcpExpressHandler } from "@jaypie/mcp";
import type { CreateMcpServerOptions, McpExpressHandlerOptions } from "@jaypie/mcp";

// Loads @jaypie/express, never @modelcontextprotocol/sdk
import {
  handleMcpRpc,
  handleMcpRpcBody,
  JSON_RPC_ERROR,
  MCP_PROTOCOL_VERSION,
  MCP_SUPPORTED_PROTOCOL_VERSIONS,
  mcpHttpHandler,
} from "@jaypie/mcp/http";
import type {
  JsonRpcId,
  JsonRpcRequest,
  JsonRpcResponse,
  McpHttpHandler,
  McpHttpHandlerOptions,
  McpRpcOptions,
} from "@jaypie/mcp/http";
```

The `.` entry imports the SDK at load (stdio CLI). Keep `src/http/` free of
SDK imports and of static imports of `suite.ts`: the default suite loads with a
dynamic import only when no `suite` option is passed.

## MCP Tools (4 Unified Tools)

The MCP server provides 4 unified router-style tools:

### Documentation Tools
- **`skill`** - Access Jaypie development documentation
  - `skill("index")` or `skill()` - List all available skills
  - `skill("tests")` - Get specific documentation

- **`version`** - Returns package version string

- **`release_notes`** - Browse package release notes
  - `release_notes()` or `release_notes("help")` - Show help
  - `release_notes("list")` - List all release notes
  - `release_notes("list", { package: "mcp" })` - Filter by package
  - `release_notes("read", { package: "mcp", version: "0.5.0" })` - Read specific note

### Datadog Tool (requires DATADOG_API_KEY and DATADOG_APP_KEY)

Defined in `@jaypie/datadog` as `datadogService` and registered here. Adding a
command or changing its behavior means editing that package, not this one.

- **`datadog`** - Access Datadog observability data
  - `datadog()` or `datadog("help")` - Show help
  - `datadog("logs", { query: "status:error" })` - Search logs
  - `datadog("log_analytics", { groupBy: ["service"] })` - Aggregate logs
  - `datadog("monitors", { status: ["Alert"] })` - List monitors

  **Commands**: `logs`, `log_analytics`, `monitors`, `synthetics`, `metrics`, `rum`

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

### Filtering Tools
`createMcpServer`, `mcpExpressHandler`, and `mcpHttpHandler` accept
`services?: string[]`, an allowlist of service aliases passed to
`selectServiceFunctions` in `@jaypie/fabric` (the same selection
`createMcpServerFromSuite` applies). Omit to expose all; `[]` exposes none.

## Skills Directory

The `skills/` directory contains Jaypie development documentation accessed via the `skill` tool. Skill files use YAML frontmatter:

```yaml
---
description: Brief description shown in skill("index") listing
related: alias1, alias2
---

# Skill Title

Content...
```

When adding new skills:
1. Create `skills/<alias>.md` with lowercase alphanumeric alias (hyphens/underscores allowed)
2. Add frontmatter with `description` and optionally `related` (comma-separated aliases)
3. Skills are immediately available via `skill(alias)` — no rebuild needed

Skills and release notes are read from the **package root**, not `dist/`. The
docs suite resolves `../../../skills` from `dist/suites/docs/`, and `files` in
`package.json` ships both directories alongside `dist`. Only the per-suite
`help.md` files are copied into `dist` by rollup.

**Important**: Keep the skill category listings in sync across `skills/skills.md`, `skills/agents.md`, and the root `CLAUDE.md` Skills section. When adding or removing a skill alias, update all three.

## Release Notes Directory

The `release-notes/` directory contains version history organized by package name:

```
release-notes/
├── jaypie/
│   └── 1.2.3.md
└── mcp/
    └── 0.5.0.md
```

Release note files use YAML frontmatter:

```yaml
---
version: 0.5.0
date: 2025-01-22
summary: Consolidate 26 tools into 6 unified router-style tools
---

## Changes

- Feature 1
- Bug fix 2
```

When adding release notes:
1. Create `release-notes/<package>/<version>.md` for each version bump
2. Add frontmatter with `version`, `date`, and `summary`
3. Notes are immediately available via `release_notes("list")` and `release_notes("read", ...)` — no rebuild needed

## Environment Variables

### Datadog Integration
| Variable | Description |
|----------|-------------|
| `DATADOG_API_KEY` or `DD_API_KEY` | Datadog API key |
| `DATADOG_APP_KEY` or `DD_APP_KEY` | Datadog Application key |
| `DD_ENV` | Default environment filter |

## Build Configuration

Uses Rollup with TypeScript. Help markdown files are copied to dist via `rollup-plugin-copy`.

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
- `@jaypie/datadog` - `datadogService`, the Datadog observability tool
- `@jaypie/errors` - Jaypie error types thrown by the suites
- `@jaypie/fabric` - `ServiceSuite`, `selectServiceFunctions`, `inputToJsonSchema`
- `@jaypie/express` (optional peer) - `expressHandler` / `expressStreamHandler` for `@jaypie/mcp/http`
- `@jaypie/logger` (optional peer) - Logging for `@jaypie/mcp/http`
- `@jaypie/kit` - YAML frontmatter parsing (`parseFrontmatter`) for release notes
- `commander` - CLI argument parsing
- `semver` - Version comparison for release notes filtering
- `rollup-plugin-copy` - Copy help.md files to dist

## Architecture

The MCP server uses `@jaypie/fabric`'s ServiceSuite pattern with modular organization:

```
suite.ts (simplified registration)
    ├── @jaypie/datadog   → datadogService (6 commands)
    └── suites/
        └── docs/index.ts → skillService, versionService, releaseNotesService
```

Services may live in this package or in the package that owns the domain. A
domain package exporting a `fabricService` is registered directly, so a consumer
who wants the capability as an LLM tool does not take the MCP suite and its
skill files as a dependency.

Each local suite directory contains:
- `index.ts` - Unified service with command router
- `help.md` - Documentation returned when command is omitted
- `<domain>.ts` - Implementation functions (for testability)

Suites throw Jaypie errors from `@jaypie/errors`, never a vanilla `Error`.

This architecture enables:
- **Progressive disclosure** - Tools return help when no command is provided
- **Modular organization** - Each domain is self-contained
- **Reduced tool count** - Consolidated into 4 unified tools
- **Testability** - Implementation functions tested independently
