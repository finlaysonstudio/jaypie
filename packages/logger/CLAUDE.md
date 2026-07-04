# @jaypie/logger

Structured JSON logging for Jaypie applications with support for log levels, tagging, and variable logging.

## Package Overview

This package provides two logger implementations:
- **Logger**: Low-level logger with configurable format (JSON/text) and log levels
- **JaypieLogger**: High-level wrapper with automatic environment tag extraction and library logger support

## File Structure

```
src/
├── index.ts              # Exports: log (default), Logger, JaypieLogger, createLogger, FORMAT, LEVEL, isDatadogForwardingEnabled, _resetDatadogTransport
├── Logger.ts             # Core Logger class with level methods and .var() support
├── JaypieLogger.ts       # Wrapper with init(), lib(), tag(), with() methods
├── constants.ts          # FORMAT, LEVEL, LEVEL_VALUES, DEFAULT, DATADOG_TRANSPORT configuration
├── datadogTransport.ts   # Opt-in HTTP transport for shipping logs to Datadog Logs API
├── forceVar.ts           # Normalizes key/value pairs for .var() logging
├── logTags.ts            # Extracts PROJECT_* environment variables as tags
├── logVar.ts             # Applies pipelines to logged variables
├── pipelines.ts          # Filters for axios responses and errors
└── utils.ts              # stringify, forceString, out, parse utilities
```

## Usage in Other Packages

This package is a dependency of:
- `@jaypie/aws`
- `@jaypie/core`
- `@jaypie/datadog`
- `@jaypie/express`
- `@jaypie/jaypie`
- `@jaypie/kit`
- `@jaypie/lambda`
- `@jaypie/llm`
- `@jaypie/testkit`
- `@jaypie/textract`

## Key Concepts

### Log Levels

Defined in `constants.ts` with numeric values for comparison:
- `fatal` (1) - Critical errors
- `error` (10) - Errors
- `warn` (30) - Warnings
- `info` (50) - Informational
- `debug` (70) - Debug output (default)
- `trace` (90) - Verbose tracing
- `all` (100) / `silent` (0) - Pseudo-levels

### Environment Variables

- `LOG_LEVEL` - Sets logging threshold
- `LOG_FORMAT` - Output format (`json` or `text`)
- `LOG_LEVEL_FIELD` - Include log level in JSON output (`true` adds `level` key, or set to custom key name like `status`; `false`/unset to omit)
- `LOG_VAR_LEVEL` - Level for `.var()` calls
- `LOG_MAX_ENTRY_BYTES` - Cap on the serialized entry (default 262144 = 256KB, the CloudWatch event limit; `0`/`false` disables)
- `LOG_MAX_STRING` - Truncate each string field beyond N characters (default off)
- `LOG_MAX_DEPTH` - Replace objects/arrays nested beyond N levels with `[Object]`/`[Array(n)]` (default off)
- `MODULE_LOGGER` - Enable library loggers (boolean)
- `MODULE_LOG_LEVEL` - Override level for library loggers
- `PROJECT_*` - Auto-tagged: COMMIT, ENV, KEY, SERVICE, SPONSOR, VERSION

#### Datadog Log Forwarding

- `DATADOG_LOCAL_FORWARDING` - Set to `true` to enable direct HTTP log forwarding
- `DATADOG_API_KEY` - Datadog API key (required when forwarding is enabled)
- `DD_SITE` - Datadog intake site (default: `datadoghq.com`)
- `DD_SERVICE` / `PROJECT_SERVICE` - Service name tag (default: `unknown`)
- `DD_ENV` / `PROJECT_ENV` - Environment tag (default: `local`)
- `DD_HOST` / `PROJECT_HOST` - Hostname tag (default: `os.hostname()`)
- `DD_SOURCE` / `PROJECT_SOURCE` - Log source tag (default: `nodejs`)

### Message and Data Splitting

In JSON format, when the final argument is an object (or array) and all preceding arguments are scalars, the object becomes the structured `data` field and the scalars join into `message`:

```typescript
log.warn("Processing failed", { id: "my-id" });
// Output: { message: "Processing failed", data: { id: "my-id" } }
```

Calls with an object mid-argument, multiple objects, or a trailing object that does not serialize to JSON (e.g., `Error`) fall back to space-joined stringification.

### Variable Logging

The `.var()` method logs key-value pairs in structured JSON:

```typescript
log.debug.var({ userId: "123" });
// Output: { message: "123", var: "userId", data: "123", dataType: "string" }
```

### Pipelines

Two-tier filtering system in `src/pipelines.ts`:

**Key-based pipelines** (match on var key name):
- **Axios responses** (key: `"response"`): Strips `config`/`request`, keeps `data`/`status`/`headers`/`statusText`

**Type-based filters** (run on any key, match on value shape via `filterByType`):
- **Fetch Response**: Extracts `ok`, `status`, `statusText`, `headers`, `url`, `redirected`, `type`
- **Errors**: Extracts `message`, `name`, `stack`, and Jaypie error properties (`isProjectError`, `title`, `detail`, `status`)

**Generic opaque fallback** (catches any class instance where `JSON.stringify` returns `{}`):
- Map-like objects (`Headers`, `URLSearchParams`, `FormData`): converted via `.entries()`
- Other opaque objects: walks prototype chain to read getters, includes `_type` constructor name

### Session Management

Handlers can bookend a logging session with `setup()` / `teardown()`:

```typescript
log.setup({ handler: "myHandler", invoke: "abc-123" }); // Tags + starts session
log.report({ status: "200", path: "/api/test" });        // Accumulate report data
log.teardown();                                           // Emits report, resets
```

- `setup(tags?)` starts a session, applies tags, resets counters
- `teardown()` emits `log.info.var({ report })` with accumulated data + `{ log: { warn, warns, error, errors } }`
- `report(data)` merges key-value data into the report; warns on duplicate keys
- Warn and error calls are auto-counted during an active session

### Serialization Limits

Entries are capped at 256KB by default (`maxEntryBytes: 262144` — the
CloudWatch Logs event limit that fronts Datadog in Lambda; Datadog's own
per-log cap is 1MB). Oversized entries truncate the top-level attributes of
`data` largest-first, each keeping a 72-character preview plus a visible
marker (`… [truncated 612,340 chars]`); only if every attribute is truncated
and the entry is still oversized does `data` collapse to `[truncated N
bytes]`. Two more limits are off by default: `maxStringLength` (truncate
each string field beyond N chars) and `maxDepth` (replace nesting beyond N
levels with `[Object]`/`[Array(n)]`).

Resolution order: constructor options (`new Logger({ maxEntryBytes })`),
then env vars (`LOG_MAX_ENTRY_BYTES`, `LOG_MAX_STRING`, `LOG_MAX_DEPTH`),
then defaults. Pass `false` (or env `0`/`false`/`none`/`off`) to disable a
limit. `log.config({ maxStringLength: 1024 })` overrides at runtime,
propagates to derived loggers (`lib`, `with`, `flag`), and persists across
`init()`. Limits apply at serialization time only — the caller's object is
never mutated; class instances (Error, Date) are not traversed. See
`src/limits.ts`.

### Tagging

Tags are key-value pairs included in every log output:

```typescript
log.tag({ requestId: "abc-123" });
log.with({ userId: "456" }).info("User action"); // Creates child logger
log.flag("beta").info("Behind a flag"); // Child logger tagged { flag: "beta" }; no-op without a string
```

## API Reference

### createLogger(tags?)

Factory function returning a `JaypieLogger` instance.

### JaypieLogger Methods

- `config({ maxDepth?, maxEntryBytes?, maxStringLength? })` - Update serialization limits at runtime (number sets, `false` disables, omitted unchanged)
- `debug/info/warn/error/fatal/trace(...messages)` - Log at level
- `*.var(keyValue)` - Log variable at level
- `var(keyValue)` - Log variable at configured var level
- `flag(flag?)` - Returns a child logger tagged `{ flag }` for a non-empty string; returns the same logger for `undefined`, non-strings, or empty string
- `init()` - Reset logger state (used between Lambda invocations)
- `lib({ lib?, level?, tags? })` - Create library logger (silent by default)
- `tag(tags)` - Add tags to all loggers
- `untag(key)` - Remove tags
- `with(key, value)` - Create child logger with additional tag

### Logger Class

Lower-level class used internally by JaypieLogger. Supports `json` or `text` format output.

### Datadog Transport Functions

- `isDatadogForwardingEnabled()` - Returns `true` when `DATADOG_LOCAL_FORWARDING=true` and `DATADOG_API_KEY` is present
- `_resetDatadogTransport()` - Destroys the singleton transport; called by `init()` to re-read env vars between Lambda invocations

## Testing Notes

When testing code that uses `@jaypie/logger`:
- Mock the logger in `@jaypie/testkit`
- Logger output goes to console methods based on level
- The `init()` method should be called between test cases when testing lifecycle behavior
