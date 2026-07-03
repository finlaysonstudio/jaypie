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

await submitMetric("custom.metric", 42, { tags: ["env:production"] });
```

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
