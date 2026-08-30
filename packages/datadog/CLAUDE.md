# @jaypie/datadog

Datadog metrics submission and observability queries for Jaypie applications.

## Purpose

Provides functions to submit metrics to Datadog from Jaypie applications, plus a fabric service that reads logs, monitors, synthetics, metrics, and RUM back out. Metric submission supports both direct API submission and StatsD via the Datadog Lambda extension.

## Exports

| Export | Type | Description |
|--------|------|-------------|
| `DATADOG` | Constant | Environment variable names, metric types, and default site |
| `DATADOG_HELP` | Constant | Help text the service returns when called with no command |
| `datadogService` | Fabric Service | Unified Datadog query service: `logs`, `log_analytics`, `monitors`, `synthetics`, `metrics`, `rum`, `validate` |
| `flushLlmObs` | Function | Flush buffered LLM Observability spans via the runtime `dd-trace` singleton. No-op unless `DD_LLMOBS_ENABLED`; never throws. Bundler-safe |
| `getLlmObs` | Function | Lazy, bundler-safe accessor for the runtime `tracer.llmobs` SDK, or `null` when `dd-trace` is unavailable |
| `hasDatadogEnv` | Function | Returns `true` if any Datadog API key env var is set |
| `isLlmObsEnabled` | Function | Returns `true` when `DD_LLMOBS_ENABLED` is truthy (anything but `false`/`0`) |
| `loadDatadogApiKey` | Async Function | When LLM Observability is enabled, resolve `DD_API_KEY_SECRET_ARN` into `DD_API_KEY` |
| `submitDistribution` | Async Function | Submit distribution metrics (percentiles, histograms) |
| `submitMetric` | Async Function | Submit a single metric |
| `submitMetricSet` | Async Function | Submit multiple metrics in one call |
| `tagSpan` | Function | Set tag(s) on the active APM span. `tagSpan(key, value)` or `tagSpan({ ... })`. Caller owns the key namespace; silently no-ops with no active span and never throws |
| `traceSpan` | Function | Run a callback as a child span (`traceSpan(name, fn)`), active across awaits so the region's duration is measured on its own. Returns `fn`'s result; no-ops to just running `fn` without a tracer |

## File Structure

```
src/
  constants.ts              # DATADOG constant with env vars and metric types
  datadog.client.ts         # HTTP client for Datadog metric submission
  datadog.service.ts        # datadogService — fabric service command router
  datadogApi.client.ts      # HTTP client for the Datadog query APIs
  datadogHelp.constant.ts   # DATADOG_HELP text returned by the service
  hasDatadogEnv.function.ts # Check for API key presence
  llmobs.ts                 # Bundler-safe flushLlmObs / getLlmObs / isLlmObsEnabled
  loadDatadogApiKey.function.ts # Load DD_API_KEY from secret ARN for LLM Observability
  index.ts                  # Public exports
  objectToKeyValueArray.pipeline.ts  # Convert tag objects to Datadog format
  resolveDatadogKeys.function.ts     # API and application key resolution
  span.ts                   # tagSpan / traceSpan — tag and measure the active APM span
  statsd.client.ts          # StatsD client for Lambda extension
  submitDistribution.adapter.ts     # Distribution metric submission
  submitMetric.adapter.ts           # Single metric submission
  submitMetricSet.adapter.ts        # Batch metric submission
  tracer.client.ts          # Bundler-safe dd-trace tracer singleton resolver (shared by span helpers)
```

## Usage Patterns

### Environment Variables

The package reads these environment variables:

| Variable | Purpose |
|----------|---------|
| `DATADOG_API_KEY` | Direct API key |
| `DATADOG_API_KEY_SECRET` | Secrets Manager reference resolved by `getEnvSecret` |
| `DATADOG_APP_KEY` / `DATADOG_APPLICATION_KEY` / `DD_APP_KEY` / `DD_APPLICATION_KEY` | Application key, required by the query service |
| `SECRET_DATADOG_API_KEY` | AWS Secrets Manager ARN for API key |
| `DATADOG_API_KEY_ARN` | AWS Secrets Manager ARN (alternate) |
| `DD_API_KEY_SECRET_ARN` | AWS Secrets Manager ARN (Datadog convention) |
| `DD_API_KEY` | dd-trace API key (set by `loadDatadogApiKey` for LLM Observability) |
| `DD_LLMOBS_ENABLED` | Opt-in for LLM Observability (truthy except `false`/`0`) |
| `DD_SITE` | Datadog site (default: `datadoghq.com`) |
| `PROJECT_ENV`, `PROJECT_KEY`, `PROJECT_SERVICE`, `PROJECT_SPONSOR`, `PROJECT_VERSION` | Auto-applied as metric tags |

### LLM Observability API Key

`loadDatadogApiKey()` resolves `DD_API_KEY` from `DD_API_KEY_SECRET_ARN` so dd-trace LLM Observability can authenticate. It is a no-op unless all hold: `DD_LLMOBS_ENABLED` is truthy (anything but `false`/`0`), `DD_API_KEY_SECRET_ARN` is set, and neither `DD_API_KEY` nor `DATADOG_API_KEY` is already present. `@jaypie/lambda` and `@jaypie/express` handlers call it automatically before the handler runs.

### Lambda Extension Detection

When `AWS_LAMBDA_FUNCTION_NAME` and `DD_API_KEY_SECRET_ARN` are both set, metrics are sent via StatsD (localhost:8125) instead of the HTTP API. This leverages the Datadog Lambda extension.

### Tag Handling

- Tags can be passed as arrays (`["key:value"]`) or objects (`{ key: "value" }`)
- User tags override default PROJECT_* tags with the same prefix
- Duplicate tag prefixes are deduplicated, keeping the last occurrence

## Dependencies

| Package | Purpose |
|---------|---------|
| `@jaypie/aws` | `getSecret()` and `getEnvSecret()` for resolving keys from Secrets Manager |
| `@jaypie/errors` | Jaypie error types thrown by the service |
| `@jaypie/fabric` | `fabricService()` for the query service |
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
// DATADOG and DATADOG_HELP constants are passed through unchanged
// datadogService is passed through, not stubbed
```

## Key Resolution

`resolveDatadogApiKey` and `resolveDatadogAppKey` in
`resolveDatadogKeys.function.ts` own every key lookup. They are internal; the
adapters and the query client both go through them. Order for the API key:

1. An explicit `apiSecret`, resolved with `getSecret`
2. `SECRET_DATADOG_API_KEY`, `DATADOG_API_KEY_ARN`, or `DD_API_KEY_SECRET_ARN`,
   resolved with `getSecret`
3. An explicit `apiKey`
4. `getEnvSecret("DATADOG_API_KEY")`, then `getEnvSecret("DD_API_KEY")`

`getEnvSecret` reads a `SECRET_<NAME>` or `<NAME>_SECRET` reference from Secrets
Manager and falls back to the plain variable, so a deferred secret never has to
be written into `process.env` first.

The legacy `*_ARN` variables stay on `getSecret` deliberately: `getEnvSecret`
requires `AWS_SESSION_TOKEN` before it will read a secret reference, so routing
them through it would break a consumer resolving keys outside Lambda with
ambient credentials.

## Query Service

`datadogService` is a fabric service. It registers with an LLM toolkit through
`fabricTool({ service: datadogService })` or with an MCP server through
`suite.register(datadogService)`.

```typescript
import { datadogService } from "@jaypie/datadog";

await datadogService({ command: "logs", query: "status:error", from: "now-1h" });
```

Error contract: faults the caller can act on throw a Jaypie error, because
neither `fabricTool()` nor `fabricMcp()` converts a throw into a result. A
missing key is a `ConfigurationError`; a bad command or a missing required
parameter is a `BadRequestError`. An unsuccessful Datadog response is not a
throw: the result carries `success: false` and a status-specific `error` string,
so a model reading the tool output can explain the failure and move on.
