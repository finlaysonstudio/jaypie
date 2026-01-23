# Release Notes

Browse Jaypie package release notes.

## Commands

| Command | Description | Required Parameters |
|---------|-------------|---------------------|
| `list` | List available release notes | - |
| `read` | Read a specific release note | `package`, `version` |

## Options for `list`

| Option | Description |
|--------|-------------|
| `package` | Filter by package name (e.g., "mcp", "jaypie") |
| `since_version` | Only versions newer than this (e.g., "1.0.0") |

## Examples

```
release_notes("list")
release_notes("list", { package: "mcp" })
release_notes("list", { package: "jaypie", since_version: "2.0.0" })
release_notes("read", { package: "mcp", version: "0.4.2" })
```

## Available Packages

Release notes are available for all Jaypie packages including:
- `jaypie` - Main package
- `mcp` - MCP server
- `fabric` - Service handlers and adapters
- `llm` - LLM provider interface
- And more...

Use `release_notes("list")` to see all available packages and versions.
