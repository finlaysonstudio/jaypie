---
description: Datadog integration, logging, and observability code patterns
related: logs, debugging, aws, tools-datadog
---

# Datadog Integration

Jaypie integrates with Datadog for logging, monitoring, and APM.

## MCP Tools

For interactive Datadog tools (logs, monitors, metrics, synthetics, RUM), see **tools-datadog**.

## Lambda Integration

Enable Datadog tracing in CDK:

```typescript
import { JaypieLambda } from "@jaypie/constructs";

const handler = new JaypieLambda(this, "Handler", {
  entry: "src/handler.ts",
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

// Error logs include stack traces
log.error("Payment failed", {
  error,
  orderId: "order-456",
});
```

## @jaypie/datadog Package

The `@jaypie/datadog` package provides utilities:

```typescript
import { datadogMetric, datadogEvent } from "@jaypie/datadog";

// Send custom metric
await datadogMetric("checkout.completed", 1, {
  tags: ["env:production", "service:checkout"],
});

// Send event
await datadogEvent({
  title: "Deployment completed",
  text: "Version 1.2.3 deployed to production",
  tags: ["env:production"],
});
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

## Environment Variables

### CDK Configuration

| Variable | Description |
|----------|-------------|
| `CDK_ENV_DATADOG_API_KEY_ARN` | Datadog API key ARN in Secrets Manager |

### Lambda Environment

| Variable | Description |
|----------|-------------|
| `DD_ENV` | Environment tag |
| `DD_SERVICE` | Service tag |
| `DD_VERSION` | Version tag |
| `DD_TRACE_ENABLED` | Enable APM tracing |
| `DD_LOGS_INJECTION` | Inject trace IDs in logs |

## Trace Correlation

Correlate logs with traces:

```typescript
import { log, getTraceContext } from "jaypie";

function processRequest() {
  const traceContext = getTraceContext();

  log.info("Processing request", {
    ...traceContext,
    requestId: "req-123",
  });
}
```

## Custom Metrics

Send custom metrics from Lambda:

```typescript
import { log } from "jaypie";

// Use log for metrics that Datadog indexes
log.info("MONITORING", {
  metric: "orders.processed",
  value: 1,
  tags: { env: "production", region: "us-east-1" },
});
```

## Testing

Mock Datadog in tests:

```typescript
import { datadogMetric } from "@jaypie/datadog";
import { vi } from "vitest";

vi.mock("@jaypie/datadog");

describe("CheckoutService", () => {
  it("sends metric on completion", async () => {
    await processCheckout();

    expect(datadogMetric).toHaveBeenCalledWith(
      "checkout.completed",
      1,
      expect.objectContaining({ tags: expect.any(Array) })
    );
  });
});
```

