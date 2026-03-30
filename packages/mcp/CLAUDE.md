# @jaypie/mcp

MCP (Model Context Protocol) server for Jaypie development. Provides tools for AI agents to access Jaypie documentation, development guides, and observability data.

## Package Overview

This package serves two purposes:
1. **CLI Tool**: Run as `npx jaypie-mcp` for stdio-based MCP server
2. **Express Handler**: Integrate MCP via HTTP with `mcpExpressHandler`

## Directory Structure

```
packages/mcp/
├── src/
│   ├── index.ts              # CLI entrypoint, exports createMcpServer and mcpExpressHandler
│   ├── createMcpServer.ts    # MCP server factory using ServiceSuite
│   ├── suite.ts              # ServiceSuite registration (simplified)
│   ├── mcpExpressHandler.ts  # Express middleware for HTTP transport
│   └── suites/               # Modular suite implementations
│       ├── datadog/
│       │   ├── index.ts      # Unified datadog service
│       │   ├── help.md       # Datadog help documentation
│       │   └── datadog.ts    # Datadog API functions
│       ├── llm/
│       │   ├── index.ts      # Unified llm service
│       │   ├── help.md       # LLM help documentation
│       │   └── llm.ts        # LLM functions
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
```

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
3. Run `npm run build -w packages/mcp` to copy skills to dist
4. Skills are then available via `skill(alias)`

**Important**: Always rebuild after editing skills or release notes - files are copied to `dist/` during build.

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
3. Run `npm run build -w packages/mcp` to include new notes
4. Notes are then available via `release_notes("list")` and `release_notes("read", ...)`

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
- `commander` - CLI argument parsing
- `gray-matter` - YAML frontmatter parsing for skills and release notes
- `semver` - Version comparison for release notes filtering
- `rollup-plugin-copy` - Copy help.md files to dist

## Architecture

The MCP server uses `@jaypie/fabric`'s ServiceSuite pattern with modular organization:

```
suite.ts (simplified registration)
    └── suites/
        ├── datadog/index.ts  → datadogService (6 commands)
        └── docs/index.ts     → skillService, versionService, releaseNotesService
```

Each suite directory contains:
- `index.ts` - Unified service with command router
- `help.md` - Documentation returned when command is omitted
- `<domain>.ts` - Implementation functions (for testability)

This architecture enables:
- **Progressive disclosure** - Tools return help when no command is provided
- **Modular organization** - Each domain is self-contained
- **Reduced tool count** - Consolidated into 4 unified tools
- **Testability** - Implementation functions tested independently
