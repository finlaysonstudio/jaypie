---
description: Jaypie MCP server tools reference
related: mcp-datadog, debugging
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

## Environment Variables

### Datadog Tools
- `DATADOG_API_KEY` or `DD_API_KEY` - API key
- `DATADOG_APP_KEY` or `DD_APP_KEY` - App key
- `DD_ENV` - Default environment filter
- `DD_SERVICE` - Default service filter
- `DD_SOURCE` - Default log source
