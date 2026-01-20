---
description: Datadog integration and observability
---

# Datadog Integration

Jaypie integrates with Datadog for logging, monitoring, and APM.

## MCP Datadog Tools

The Jaypie MCP provides tools for querying Datadog:

### Log Search
```
datadog_logs          - Search individual log entries
datadog_log_analytics - Aggregate logs with groupBy
```

### Monitoring
```
datadog_monitors      - List and check monitor status
datadog_synthetics    - List synthetic tests and results
datadog_metrics       - Query timeseries metrics
datadog_rum           - Search Real User Monitoring events
```

## Environment Variables

Configure Datadog tools via environment:

| Variable | Description |
|----------|-------------|
| `DATADOG_API_KEY` or `DD_API_KEY` | API key |
| `DATADOG_APP_KEY` or `DD_APP_KEY` | Application key |
| `DD_ENV` | Default environment filter |
| `DD_SERVICE` | Default service filter |
| `DD_SOURCE` | Default log source (default: lambda) |

## Common Queries

### Search Error Logs

```
datadog_logs --query "status:error" --from "now-1h"
```

### Count Errors by Service

```
datadog_log_analytics --groupBy '["service"]' --query "status:error"
```

### Check Alerting Monitors

```
datadog_monitors --status '["Alert", "Warn"]'
```

## Lambda Integration

Enable Datadog tracing in CDK:

```typescript
import { JaypieLambda } from "@jaypie/constructs";

const handler = new JaypieLambda(this, "Handler", {
  datadogApiKeyArn: process.env.CDK_ENV_DATADOG_API_KEY_ARN,
  environment: {
    DD_ENV: "production",
    DD_SERVICE: "my-api",
    DD_VERSION: "1.0.0",
  },
});
```

## Logging Integration

Jaypie logging automatically formats for Datadog:

```typescript
import { log } from "jaypie";

// Structured logs are indexed by Datadog
log.info("Request processed", {
  userId: "user-123",
  action: "checkout",
  duration: 150,
});
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

## Unified Service Tagging

Use consistent tags across services:

| Tag | Purpose |
|-----|---------|
| `env` | Environment (sandbox, production) |
| `service` | Service name |
| `version` | Deployment version |

```typescript
environment: {
  DD_ENV: process.env.PROJECT_ENV,
  DD_SERVICE: process.env.PROJECT_KEY,
  DD_VERSION: process.env.npm_package_version,
}
```

## See Also

- `skill("logs")` - Logging patterns
- `skill("debugging")` - Debugging techniques
- `skill("aws")` - AWS integration
