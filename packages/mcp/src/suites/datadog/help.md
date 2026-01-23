# Datadog Tools

Access Datadog observability data. Requires `DATADOG_API_KEY` and `DATADOG_APP_KEY` environment variables.

## Commands

| Command | Description | Required Parameters |
|---------|-------------|---------------------|
| `logs` | Search individual log entries | - |
| `log_analytics` | Aggregate logs by fields | `groupBy` (array) |
| `monitors` | List and filter monitors | - |
| `synthetics` | List synthetic tests or get results | - |
| `metrics` | Query timeseries metrics | `query` |
| `rum` | Search Real User Monitoring events | - |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATADOG_API_KEY` or `DD_API_KEY` | Datadog API key |
| `DATADOG_APP_KEY` or `DD_APP_KEY` | Datadog Application key |
| `DD_ENV` | Default environment filter |
| `DD_SERVICE` | Default service filter |
| `DD_SOURCE` | Default log source (defaults to "lambda") |

## Examples

```
datadog("logs", { query: "status:error", from: "now-1h" })
datadog("log_analytics", { groupBy: ["service", "status"], from: "now-24h" })
datadog("monitors", { status: ["Alert", "Warn"] })
datadog("metrics", { query: "avg:system.cpu.user{*}", from: "1h" })
```

## Time Formats

- Relative: `now-15m`, `now-1h`, `now-1d`
- ISO 8601: `2024-01-15T10:00:00Z`
- Unix timestamp (metrics only)
