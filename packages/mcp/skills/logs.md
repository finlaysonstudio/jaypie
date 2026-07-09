---
description: Logging patterns and conventions
related: debugging, datadog, variables
---

# Logging Patterns

Jaypie provides structured logging for observability.

## Basic Usage

- All logging should use `log` from `jaypie`, custom functions should be eliminated
- Logging should tell a story as the process unfolds; a non-developer should be able to read and follow
- `log.trace` the happy path at major checkpoints or junctures where logic forks or errors may be thrown
- `log.debug` things that should stand out, anything off the happy path that might impact operations later
- Avoid `log.info`. Reserve info for values that must be recorded such as metrics
- Use `log.warn` when the problem is unexpected and warrants attention but is recoverable. Use `log.debug` for unusual things that are part of normal operations
- Use `log.error` when unrecoverable or "really bad." Do not use `log.error` just because an error occurs that is part of normal operations (e.g., 404)

```typescript
import { log } from "jaypie";

log.trace("Detailed debug info");
log.debug("Debug information");
log.info("Informational message");
log.warn("Warning message");
log.error("Error message");
log.fatal("Fatal error"); // only used internally in jaypie
```

## Logging Data

A trailing object becomes the structured `data` field; preceding scalars join into `message`:

```typescript
log.warn("Processing failed", { id: "my-id" });
// => { "message": "Processing failed", "data": { "id": "my-id" } }
```

This only splits when the object is last and everything before it is scalar. An object mid-call, multiple objects, or a non-serializable object (e.g., `Error`) falls back to space-joined stringification — keep objects last and singular.

Prefer `log.var` to log single-key objects that parse in Datadog:
<GOOD>
```typescript
log.trace("Processing");
log.var({ id: "my-id" });
```
</GOOD>

Or have the variable name tell the story:
<GOOD>
```typescript
log.var({ Processing: id });
```
</GOOD>

Nest multi-key objects under a single key:
```typescript
log.var({ Processing: {
  id,
  amount,
  quantity,
} });
```

Log any important, even scalar, data and filter with `var` in Datadog

## Session Management

Handlers automatically call `log.setup()` and `log.teardown()` to bookend each request. On teardown, a report is emitted as `log.info.var({ report })` containing accumulated data and warn/error counts.

```typescript
// Manual session (handlers do this automatically)
log.setup({ handler: "myHandler", invoke: "abc-123" });

// Accumulate report data during the request
log.report({ userId: "456" });
log.report({ itemCount: 3 });

// Teardown emits the report with warn/error stats
log.teardown();
// => { report: { userId: "456", itemCount: 3, log: { warn: false, warns: 0, error: false, errors: 0 } } }
```

`log.report()` warns when a key is written twice. Use `log.tally()` for data written repeatedly — keys combine instead: numbers sum, strings collect into an array of strings, booleans AND, and objects merge recursively.

```typescript
log.tally({ llm: { operates: 1, turns: 2 } });
log.tally({ llm: { operates: 1, turns: 3 } });
// => teardown report includes { llm: { operates: 2, turns: 5 } }
```

Outside an active session `tally()` silently no-ops, so libraries can tally unconditionally. `@jaypie/llm` tallies an `llm` key (turns, tool calls, usage by model) automatically.

## Setting Log Level

Via environment variable:

```bash
LOG_LEVEL=debug npm run dev
LOG_LEVEL=trace MODULE_LOG_LEVEL=warn npm test
```

## Including Level in JSON Output

By default, the log level is not included in JSON output (Lambda determines level from the console method). To include it:

```bash
LOG_LEVEL_FIELD=true          # Adds "level": "debug" (etc.)
LOG_LEVEL_FIELD=status        # Adds "status": "debug" (etc.)
LOG_LEVEL_FIELD=false         # Omit (default)
```

Or via constructor option:

```typescript
import { Logger } from "@jaypie/logger";

const logger = new Logger({ format: "json", level: "debug", levelField: "status" });
logger.info("test"); // { "message": "test", "status": "info" }
```

## Serialization Limits

Entries are capped at 256KB by default (`maxEntryBytes: 262144` — the CloudWatch Logs event limit that fronts Datadog in Lambda). Oversized entries truncate the top-level attributes of `data` largest-first, each keeping a 72-character preview plus a visible marker:

```
data:application/pdf;base64,JVBERi0xLjcK… [truncated 612,340 chars]
```

Two more limits are available, off by default:

- `maxStringLength` — truncate each string field beyond N characters
- `maxDepth` — replace objects/arrays nested beyond N levels with `[Object]` / `[Array(n)]`

Configure via env vars (`0`/`false` disables a limit):

```bash
LOG_MAX_ENTRY_BYTES=1048576   # Raise entry cap to 1MB (Datadog direct)
LOG_MAX_ENTRY_BYTES=false     # Unlimited entries
LOG_MAX_STRING=16384          # Truncate strings beyond 16KB
LOG_MAX_DEPTH=8               # Collapse nesting beyond 8 levels
```

Or at runtime with `log.config()` — propagates to derived loggers (`lib`, `with`, `flag`) and persists across `init()`:

```typescript
import { log } from "jaypie";

log.config({ maxStringLength: 1024 });
log.config({ maxEntryBytes: false }); // false disables a limit
```

Limits apply at serialization time only — the caller's object is never mutated.

## Lambda Logging

Lambda handlers automatically add context:

```typescript
import { lambdaHandler } from "@jaypie/lambda";

export const handler = lambdaHandler(async (event) => {
  log.trace("Begin Processing");
}, {
  name: "exampleHandler"
});
```

Logs will include the `env`, `invoke`, and `handler` name. For example:

```json
{
  "env": "sandbox",
  "invoke": "uuid",
  "handler": "exampleHandler"
}
```

## See Also

- **`skill("datadog")`** - Datadog integration and log forwarding
- **`skill("handlers")`** - Handler lifecycle with automatic log context
- **`skill("variables")`** - LOG_LEVEL and other environment variables
