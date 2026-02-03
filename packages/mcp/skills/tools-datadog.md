---
description: Datadog MCP tool for logs, monitors, metrics, synthetics, and RUM
related: datadog, tools, debugging, logs
---

# Datadog MCP Tool

Unified tool for querying Datadog observability data via the Jaypie MCP.

## Usage

All parameters are passed at the top level (flat structure):

```
datadog()                                          # Show help
datadog({ command: "logs", query: "...", ... })    # Execute a command
```

## Available Commands

| Command | Description |
|---------|-------------|
| `logs` | Search individual log entries |
| `log_analytics` | Aggregate logs with groupBy |
| `monitors` | List and check monitor status |
| `synthetics` | List synthetic tests and results |
| `metrics` | Query timeseries metrics |
| `rum` | Search Real User Monitoring events |

## Parameters

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

Configure defaults via environment:

| Variable | Description |
|----------|-------------|
| `DATADOG_API_KEY` or `DD_API_KEY` | API key (required) |
| `DATADOG_APP_KEY` or `DD_APP_KEY` | Application key (required) |
| `DD_ENV` | Default environment filter |
| `DD_SERVICE` | Default service filter |
| `DD_SOURCE` | Default log source (default: lambda) |

## Log Search

Search individual log entries:

```
# Search error logs
datadog({ command: "logs", query: "status:error", from: "now-1h" })

# Search by service
datadog({ command: "logs", query: "service:my-api status:error", from: "now-15m" })

# Search by Lambda ARN
datadog({ command: "logs", query: "@lambda.arn:\"arn:aws:lambda:us-east-1:...\"", from: "now-1h" })

# Search by attribute
datadog({ command: "logs", query: "@http.status_code:500", from: "now-1h" })

# Wildcard search
datadog({ command: "logs", query: "*timeout*", from: "now-30m" })

# Limit results
datadog({ command: "logs", query: "status:error", from: "now-1h", limit: 100 })
```

## Log Analytics

Aggregate logs for statistics (use comma-separated groupBy):

```
# Count errors by service
datadog({ command: "log_analytics", groupBy: "service", query: "status:error" })

# Count by status code
datadog({ command: "log_analytics", groupBy: "@http.status_code", query: "*" })

# Multiple groupings
datadog({ command: "log_analytics", groupBy: "service,status", query: "*" })

# Average response time
datadog({ command: "log_analytics", groupBy: "service", aggregation: "avg", metric: "@duration", query: "*" })
```

## Monitors

Check monitor status (use comma-separated status):

```
# List all monitors
datadog({ command: "monitors" })

# Filter alerting monitors
datadog({ command: "monitors", status: "Alert,Warn" })

# Filter by name
datadog({ command: "monitors", name: "my-api" })

# Filter by tags
datadog({ command: "monitors", tags: "env:production" })
```

## Synthetics

List synthetic tests:

```
# List all tests
datadog({ command: "synthetics" })

# Filter by type
datadog({ command: "synthetics", type: "api" })
datadog({ command: "synthetics", type: "browser" })

# Get results for specific test
datadog({ command: "synthetics", testId: "abc-123-def" })
```

## Metrics

Query timeseries metrics:

```
# CPU usage
datadog({ command: "metrics", query: "avg:system.cpu.user{*}", from: "1h" })

# Lambda invocations
datadog({ command: "metrics", query: "sum:aws.lambda.invocations{function:my-func}.as_count()", from: "1h" })

# Lambda duration
datadog({ command: "metrics", query: "max:aws.lambda.duration{env:production}", from: "30m" })
```

## RUM Events

Search Real User Monitoring events:

```
# Search all events
datadog({ command: "rum", from: "now-1h" })

# Filter by type
datadog({ command: "rum", query: "@type:error", from: "now-1h" })

# Filter by session
datadog({ command: "rum", query: "@session.id:abc123", from: "now-1h" })

# Filter by URL
datadog({ command: "rum", query: "@view.url:*checkout*", from: "now-1h" })
```

## Query Syntax

### Log Search Syntax

```
status:error                    # By status
@http.status_code:500          # By attribute
service:my-api                  # By service
*timeout*                       # Wildcard
@lambda.arn:"arn:aws:..."      # Quoted values
```

### Time Ranges

```
now-15m                         # Last 15 minutes
now-1h                          # Last hour
now-1d                          # Last day
2024-01-15T10:00:00Z           # Specific time (ISO 8601)
```

## Common Patterns

### Debug Lambda Issues

```
# Search recent errors
datadog({ command: "logs", query: "service:my-function status:error", from: "now-1h" })

# Check error counts by service
datadog({ command: "log_analytics", groupBy: "service", query: "status:error", from: "now-1h" })
```

### Monitor Status Check

```
# Check alerting monitors
datadog({ command: "monitors", status: "Alert,Warn" })
```

### Frontend Issues

```
# Search RUM errors
datadog({ command: "rum", query: "@type:error", from: "now-1h" })

# Check synthetic test results
datadog({ command: "synthetics", testId: "my-checkout-test" })
```
