# Datadog Tools

Access Datadog observability data. Requires `DATADOG_API_KEY` and `DATADOG_APP_KEY` environment variables.

## Commands

| Command | Description | Required Parameters |
|---------|-------------|---------------------|
| `logs` | Search individual log entries | - |
| `log_analytics` | Aggregate logs by fields | `groupBy` (comma-separated) |
| `monitors` | List and filter monitors | - |
| `synthetics` | List synthetic tests or get results | - |
| `metrics` | Query timeseries metrics | `query` |
| `rum` | Search Real User Monitoring events | - |

## Parameters

All parameters are passed at the top level (no nested objects):

| Parameter | Type | Description |
|-----------|------|-------------|
| `command` | string | Command to execute (logs, log_analytics, monitors, synthetics, metrics, rum) |
| `query` | string | Datadog query string (e.g., `status:error`, `@lambda.arn:"arn:..."`) |
| `from` | string | Start time (e.g., now-1h, now-15m, now-1d) |
| `to` | string | End time (e.g., now) |
| `limit` | number | Maximum results to return |
| `env` | string | Environment filter |
| `service` | string | Service name filter |
| `source` | string | Log source filter (default: lambda) |
| `groupBy` | string | Fields to group by, comma-separated (for log_analytics) |
| `aggregation` | string | Aggregation type: count, avg, sum, min, max, cardinality |
| `status` | string | Monitor status filter, comma-separated: Alert, Warn, No Data, OK |
| `tags` | string | Tags filter, comma-separated |
| `testId` | string | Synthetic test ID for getting results |
| `type` | string | Synthetic test type: api or browser |

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
# Search error logs
datadog({ command: "logs", query: "status:error", from: "now-1h" })

# Search by Lambda ARN
datadog({ command: "logs", query: "@lambda.arn:\"arn:aws:lambda:...\"", from: "now-1h" })

# Aggregate logs by service
datadog({ command: "log_analytics", groupBy: "service,status", from: "now-24h" })

# List alerting monitors
datadog({ command: "monitors", status: "Alert,Warn" })

# Query metrics
datadog({ command: "metrics", query: "avg:system.cpu.user{*}", from: "1h" })
```

## Time Formats

- Relative: `now-15m`, `now-1h`, `now-1d`
- ISO 8601: `2024-01-15T10:00:00Z`
- Unix timestamp (metrics only)
