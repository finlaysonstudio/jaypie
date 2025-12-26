# @jaypie/datadog

Datadog metrics submission for Jaypie applications.

## Purpose

Provides functions to submit metrics to Datadog from Jaypie applications. Supports both direct API submission and StatsD via the Datadog Lambda extension.

## Exports

| Export | Type | Description |
|--------|------|-------------|
| `DATADOG` | Constant | Environment variable names, metric types, and default site |
| `hasDatadogEnv` | Function | Returns `true` if any Datadog API key env var is set |
| `submitDistribution` | Async Function | Submit distribution metrics (percentiles, histograms) |
| `submitMetric` | Async Function | Submit a single metric |
| `submitMetricSet` | Async Function | Submit multiple metrics in one call |

## File Structure

```
src/
  constants.ts              # DATADOG constant with env vars and metric types
  datadog.client.ts         # HTTP client for Datadog v1/v2 APIs
  hasDatadogEnv.function.ts # Check for API key presence
  index.ts                  # Public exports
  objectToKeyValueArray.pipeline.ts  # Convert tag objects to Datadog format
  statsd.client.ts          # StatsD client for Lambda extension
  submitDistribution.adapter.ts     # Distribution metric submission
  submitMetric.adapter.ts           # Single metric submission
  submitMetricSet.adapter.ts        # Batch metric submission
```

## Usage Patterns

### Environment Variables

The package reads these environment variables:

| Variable | Purpose |
|----------|---------|
| `DATADOG_API_KEY` | Direct API key |
| `SECRET_DATADOG_API_KEY` | AWS Secrets Manager ARN for API key |
| `DATADOG_API_KEY_ARN` | AWS Secrets Manager ARN (alternate) |
| `DD_API_KEY_SECRET_ARN` | AWS Secrets Manager ARN (Datadog convention) |
| `DD_SITE` | Datadog site (default: `datadoghq.com`) |
| `PROJECT_ENV`, `PROJECT_KEY`, `PROJECT_SERVICE`, `PROJECT_SPONSOR`, `PROJECT_VERSION` | Auto-applied as metric tags |

### Lambda Extension Detection

When `AWS_LAMBDA_FUNCTION_NAME` and `DD_API_KEY_SECRET_ARN` are both set, metrics are sent via StatsD (localhost:8125) instead of the HTTP API. This leverages the Datadog Lambda extension.

### Tag Handling

- Tags can be passed as arrays (`["key:value"]`) or objects (`{ key: "value" }`)
- User tags override default PROJECT_* tags with the same prefix
- Duplicate tag prefixes are deduplicated, keeping the last occurrence

## Dependencies

| Package | Purpose |
|---------|---------|
| `@jaypie/aws` | `getSecret()` for resolving API key from Secrets Manager |
| `hot-shots` | StatsD client for Lambda extension |

## Peer Dependencies

| Package | Purpose |
|---------|---------|
| `@jaypie/kit` | `force.number()` for value coercion |
| `@jaypie/logger` | Logging |

## Used By

- `jaypie` - Re-exports all exports
- `@jaypie/express` - Uses `submitMetric` for request metrics in handlers
- `@jaypie/testkit` - Provides mocks for all exports

## Testing Mocks

`@jaypie/testkit` provides mocks at `@jaypie/testkit/mock/datadog.ts`:

```typescript
import { submitMetric } from "@jaypie/testkit";

// submitMetric, submitMetricSet, submitDistribution resolve to true
// hasDatadogEnv returns false
// DATADOG constant is passed through unchanged
```
