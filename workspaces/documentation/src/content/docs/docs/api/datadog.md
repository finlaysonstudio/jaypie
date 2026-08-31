---
title: "@jaypie/datadog"
---

Datadog metrics and observability integration.

## Overview

`@jaypie/datadog` provides integration with Datadog for metrics and observability in Jaypie applications.

## Installation

```bash
npm install @jaypie/datadog
```

## Key Features

### Metrics Submission

Submit custom metrics to Datadog:

```javascript
import { submitMetric } from "@jaypie/datadog";

await submitMetric({
  name: "custom.metric",
  value: 42,
  tags: { env: "production" },
});
```

The API key resolves at call time. A plain `DATADOG_API_KEY` works; so does a
Secrets Manager reference (`SECRET_DATADOG_API_KEY`, `DATADOG_API_KEY_ARN`,
`DD_API_KEY_SECRET_ARN`, or `DATADOG_API_KEY_SECRET`), which is fetched on the
call rather than loaded into the environment beforehand.

### Observability Queries

`datadogService` reads logs, monitors, synthetics, metrics, and RUM events back
out of Datadog. It is a fabric service, so it registers with an LLM toolkit or an
MCP server directly:

```javascript
import { datadogService } from "@jaypie/datadog";
import { fabricTool } from "@jaypie/fabric/llm";

const tools = [fabricTool({ service: datadogService })];

await datadogService({ command: "logs", query: "status:error", from: "now-1h" });
```

Commands are `logs`, `log_analytics`, `monitors`, `synthetics`, `metrics`,
`rum`, and `validate`. Calling it with no command returns its help. Querying
requires an application key (`DATADOG_APP_KEY`) alongside the API key.

An unsuccessful Datadog response comes back as data — `success: false` with an
`error` describing the cause — rather than as a thrown exception, so a model
holding the tool can report the failure and continue.

### Observability

Built-in observability for Jaypie handlers and AWS Lambda functions.

### APM Spans

Tag and measure the active APM (`dd-trace`) span from inside handler code:

```javascript
import { tagSpan, traceSpan } from "@jaypie/datadog";

tagSpan("order.id", orderId); // tag the active span
tagSpan({ "order.id": orderId, "order.tier": tier }); // object form

await traceSpan("ocr", async () => {
  tagSpan("pages", 12); // attaches to THIS child span, scoped to the region
  return runOcr();
}); // span auto-finishes here = the duration measured
```

`tagSpan` sets tag(s) on the active span; the caller chooses the key namespace
(avoid Datadog's reserved `test.*` / `ci.*`). `traceSpan` runs a region as a
child span kept active across awaits and returns the callback's result. Both
resolve the runtime `dd-trace` singleton in a bundler-safe way and silently
no-op (never throw) when there is no active span — e.g. running locally or in
tests.

## API Documentation

_API documentation will be generated from TypeScript definitions._

## Related Packages

- [@jaypie/core](./core) - Core utilities
- [@jaypie/lambda](./lambda) - AWS Lambda integration
