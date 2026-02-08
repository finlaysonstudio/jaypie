# @jaypie/datadog

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

## API Documentation

_API documentation will be generated from TypeScript definitions._

## Related Packages

- [@jaypie/core](./core) - Core utilities
- [@jaypie/lambda](./lambda) - AWS Lambda integration
