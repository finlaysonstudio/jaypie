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
│       ├── aws/
│       │   ├── index.ts      # Unified aws service
│       │   ├── help.md       # AWS help documentation
│       │   └── aws.ts        # AWS CLI functions
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

## MCP Tools (6 Unified Tools)

The MCP server provides 6 consolidated router-style tools (down from 26 individual tools):

### Documentation Tools
- **`skill`** - Access Jaypie development documentation
  - `skill("index")` or `skill()` - List all available skills
  - `skill("aws")`, `skill("tests")` - Get specific documentation

- **`version`** - Returns package version string

- **`release_notes`** - Browse package release notes
  - `release_notes()` or `release_notes("help")` - Show help
  - `release_notes("list")` - List all release notes
  - `release_notes("list", { package: "mcp" })` - Filter by package
  - `release_notes("read", { package: "mcp", version: "0.5.0" })` - Read specific note

### AWS Tool (requires AWS CLI installed)
- **`aws`** - Access AWS services via CLI
  - `aws()` or `aws("help")` - Show help with all commands
  - `aws("list_profiles")` - List AWS profiles
  - `aws("lambda_list_functions", { region: "us-east-1" })` - Lambda operations
  - `aws("dynamodb_query", { tableName: "...", keyConditionExpression: "..." })` - DynamoDB

  **Commands**: `list_profiles`, `lambda_list_functions`, `lambda_get_function`, `stepfunctions_list_executions`, `stepfunctions_stop_execution`, `logs_filter_log_events`, `s3_list_objects`, `cloudformation_describe_stack`, `dynamodb_describe_table`, `dynamodb_scan`, `dynamodb_query`, `dynamodb_get_item`, `sqs_list_queues`, `sqs_get_queue_attributes`, `sqs_receive_message`, `sqs_purge_queue`

### Datadog Tool (requires DATADOG_API_KEY and DATADOG_APP_KEY)
- **`datadog`** - Access Datadog observability data
  - `datadog()` or `datadog("help")` - Show help
  - `datadog("logs", { query: "status:error" })` - Search logs
  - `datadog("log_analytics", { groupBy: ["service"] })` - Aggregate logs
  - `datadog("monitors", { status: ["Alert"] })` - List monitors

  **Commands**: `logs`, `log_analytics`, `monitors`, `synthetics`, `metrics`, `rum`

### LLM Tool
- **`llm`** - Debug LLM provider responses
  - `llm()` or `llm("help")` - Show help
  - `llm("list_providers")` - List available providers
  - `llm("debug_call", { provider: "openai", message: "Hello" })` - Test API call

  **Commands**: `list_providers`, `debug_call`

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
3. Skills are automatically available via `skill(alias)`

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
3. Notes are automatically available via `release_notes("list")` and `release_notes("read", ...)`

## Environment Variables

### AWS CLI Integration
| Variable | Description |
|----------|-------------|
| `AWS_PROFILE` | Default profile if not specified per-call |
| `AWS_REGION` or `AWS_DEFAULT_REGION` | Default region if not specified |

### Datadog Integration
| Variable | Description |
|----------|-------------|
| `DATADOG_API_KEY` or `DD_API_KEY` | Datadog API key |
| `DATADOG_APP_KEY` or `DD_APP_KEY` | Datadog Application key |
| `DD_ENV` | Default environment filter |
| `DD_SERVICE` | Default service filter |
| `DD_SOURCE` | Default log source (defaults to "lambda") |

### LLM Integration
| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GOOGLE_API_KEY` | Google/Gemini API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |

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
        ├── aws/index.ts      → awsService (16 commands)
        ├── datadog/index.ts  → datadogService (6 commands)
        ├── llm/index.ts      → llmService (2 commands)
        └── docs/index.ts     → skillService, versionService, releaseNotesService
```

Each suite directory contains:
- `index.ts` - Unified service with command router
- `help.md` - Documentation returned when command is omitted
- `<domain>.ts` - Implementation functions (for testability)

This architecture enables:
- **Progressive disclosure** - Tools return help when no command is provided
- **Modular organization** - Each domain is self-contained
- **Reduced tool count** - 26 tools → 6 tools (cleaner MCP interface)
- **Testability** - Implementation functions tested independently
