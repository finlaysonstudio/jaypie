---
description: Datadog MCP tools for logs, monitors, metrics, synthetics, and RUM
related: datadog, tools, debugging, logs
---

# Datadog MCP Tools

Tools for querying Datadog observability data via the Jaypie MCP.

## Available Tools

| Tool | Description |
|------|-------------|
| `datadog_logs` | Search individual log entries |
| `datadog_log_analytics` | Aggregate logs with groupBy |
| `datadog_monitors` | List and check monitor status |
| `datadog_synthetics` | List synthetic tests and results |
| `datadog_metrics` | Query timeseries metrics |
| `datadog_rum` | Search Real User Monitoring events |

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
datadog_logs --query "status:error" --from "now-1h"

# Search by service
datadog_logs --query "service:my-api status:error" --from "now-15m"

# Search by attribute
datadog_logs --query "@http.status_code:500" --from "now-1h"

# Wildcard search
datadog_logs --query "*timeout*" --from "now-30m"

# Limit results
datadog_logs --query "status:error" --from "now-1h" --limit 100
```

## Log Analytics

Aggregate logs for statistics:

```
# Count errors by service
datadog_log_analytics --groupBy '["service"]' --query "status:error"

# Count by status code
datadog_log_analytics --groupBy '["@http.status_code"]' --query "*"

# Multiple groupings
datadog_log_analytics --groupBy '["service", "status"]' --query "*"

# Average response time
datadog_log_analytics --groupBy '["service"]' \
  --aggregation "avg" \
  --metric "@duration" \
  --query "*"
```

## Monitors

Check monitor status:

```
# List all monitors
datadog_monitors

# Filter alerting monitors
datadog_monitors --status '["Alert", "Warn"]'

# Filter by name
datadog_monitors --name "my-api"

# Filter by tags
datadog_monitors --tags '["env:production"]'
```

## Synthetics

List synthetic tests:

```
# List all tests
datadog_synthetics

# Filter by type
datadog_synthetics --type "api"
datadog_synthetics --type "browser"

# Get results for specific test
datadog_synthetics --testId "abc-123-def"
```

## Metrics

Query timeseries metrics:

```
# CPU usage
datadog_metrics --query "avg:system.cpu.user{*}" --from "1h"

# Lambda invocations
datadog_metrics --query "sum:aws.lambda.invocations{function:my-func}.as_count()" --from "1h"

# Lambda duration
datadog_metrics --query "max:aws.lambda.duration{env:production}" --from "30m"
```

## RUM Events

Search Real User Monitoring events:

```
# Search all events
datadog_rum --from "now-1h"

# Filter by type
datadog_rum --query "@type:error" --from "now-1h"

# Filter by session
datadog_rum --query "@session.id:abc123" --from "now-1h"

# Filter by URL
datadog_rum --query "@view.url:*checkout*" --from "now-1h"
```

## Query Syntax

### Log Search Syntax

```
status:error                    # By status
@http.status_code:500          # By attribute
service:my-api                  # By service
*timeout*                       # Wildcard
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
datadog_logs --query "service:my-function status:error" --from "now-1h"

# Check error counts by service
datadog_log_analytics --groupBy '["service"]' --query "status:error" --from "now-1h"
```

### Monitor Status Check

```
# Check alerting monitors
datadog_monitors --status '["Alert", "Warn"]'
```

### Frontend Issues

```
# Search RUM errors
datadog_rum --query "@type:error" --from "now-1h"

# Check synthetic test results
datadog_synthetics --testId "my-checkout-test"
```

