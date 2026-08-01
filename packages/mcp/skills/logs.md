---
description: Logging patterns and conventions
related: debugging, datadog, variables, vocabulary
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

## Caught Jaypie Errors

The handler lifecycle picks the level from the error's status, so an outage is visible to monitors filtering on error status without the application logging anything itself:

- **4xx** (`BadRequestError`, `NotFoundError`, …) → `log.warn("[handler] Caught Jaypie error")`
- **500-class** (`ConfigurationError`, `InternalError`, `BadGatewayError`, `GatewayTimeoutError`, `UnavailableError`, …) → `log.error("[handler] Caught Jaypie error")`

Either way the handler emits `log.var({ jaypieError: { detail, status, title } })` carrying the error as thrown. The same applies to errors thrown during `validate` and `teardown`. Non-Jaypie errors remain `log.fatal` plus `log.error`.

### 5xx detail is logged, then scrubbed

After logging a 500-class error, the handler replaces its `detail` and `title` with the generic strings for the status. The message an application passes to a 500-class error constructor reaches the logs and never reaches a response body.

```typescript
throw new ConfigurationError("Fabric model chat is not registered");
// log.error("[handler] Caught Jaypie error")
// log.var({ jaypieError: { detail: "Fabric model chat is not registered", status: 500, title: "Internal Configuration Error" } })
// response: { errors: [{ status: 500, title: "Internal Application Error",
//   detail: "An unexpected error occurred and the request was unable to complete" }] }
```

4xx is not scrubbed. A client error is only actionable when it says what to correct, so `NotFoundError("User 12345 not found")` answers with that detail. Write 4xx messages for the caller and 5xx messages for the logs.

`status`, `message`, and `stack` are untouched, so logs and handlers configured with `throw: true` still see the original.

### The `scrub` option

Every handler accepts `scrub` to override the default of `{ client: false, server: true }`:

```typescript
expressHandler(handler, { scrub: true });              // scrub 4xx and 5xx
expressHandler(handler, { scrub: false });             // scrub neither
expressHandler(handler, { scrub: { client: true } });  // scrub 4xx as well
expressHandler(handler, { scrub: { server: false } }); // return 5xx detail
```

Scrubbing never changes what is logged: `log.var({ jaypieError })` always carries the error as thrown.

A scrubbed status with no error class of its own falls to the generic for its class: an unmapped 4xx (422, 451, …) answers the bad request strings while keeping its own status, and 500-class falls to internal error. A status outside 4xx and 5xx has no correct substitute and is never scrubbed.

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
LOG_LEVEL_FIELD=status        # Adds "status": "debug" (etc.) — preferred
LOG_LEVEL_FIELD=true          # Adds "level": "debug" (etc.)
LOG_LEVEL_FIELD=false         # Omit (default)
```

Prefer `status` as the field name: Datadog reserves `status` for log severity and cannot be reconfigured, and the Fabric vocabulary follows — severity is a `status` vocabulary, and `level` is not a reserved attribute (see `skill("vocabulary")`).

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

## Redaction

Sensitive values are scrubbed before serialization. Redaction recurses through nested objects and arrays (budgeted at depth 32 and 25,000 nodes) and never mutates the caller's object. Three layers:

### 1. Field names

Names match case-insensitively ignoring `_`, `-`, and spaces (`routing_number` ≡ `routingNumber`). Each name has a render:

| Names | Render |
|-------|--------|
| `authorization`, `password`, `apiKey`, `clientSecret`, `accessToken`, `refreshToken`, `privateKey`, `sessionToken`, … | `sk_<last4>` for sk-prefixed values, `md5_<last4>` otherwise |
| `accountNumber`, `routingNumber`, `iban`, `ssn`, `socialSecurityNumber`, `taxId` | Last four: `…6789` |
| `cardNumber`, `creditCardNumber`, `pan`, `ccNumber` | BIN and last four: `411111…1111` |
| `cvv`, `cvc`, `pin`, `otp`, `securityCode`, `mfaCode` | `redacted` — never any part of the value |

Values too short for a partial reveal render fully as `redacted`.

### 2. Value shapes

Strings matching known credential shapes (`sk_live_…`, `AKIA…`, `ghp_…`, `xoxb-…`, JWTs) redact under any field name. Ambiguous names (`key`, `token`, `auth`, `credential`) redact only when the value looks like a credential (mixed case with digits and low-frequency letters), so S3 keys, UUIDs, DynamoDB keys, and file paths pass through.

### 3. Marking values with `secret()`

Mark a value sensitive at the point of creation. Every log renders it redacted regardless of the field name it lands under, while `JSON.stringify` still yields the true value for the real consumer:

```typescript
import { secret } from "jaypie";

findings.push({ field: "apiKey", key: secret(plaintext) });
// log output: { "key": "md5_ab12" }
// JSON.stringify(response): { "key": "<plaintext>" }
```

### Configuration

```bash
LOG_REDACT_KEYS=memberId,internalNote   # Add names to the denylist
LOG_REDACT=false                        # Disable all scrubbing (local debugging)
```

Or at runtime with `log.config()` — propagates to derived loggers and persists across `init()`:

```typescript
log.config({ redactKeys: ["memberId"] });
log.config({
  redact: (value, { key, path }) =>
    path === "event.body.email" ? "redacted-email" : undefined,
});
```

The `redact` hook runs ahead of built-in rules on every node; return a replacement value or `undefined` to defer.

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

Handlers log the incoming event and outgoing response at `info`. Handlers that receive or return sensitive values can opt out:

```typescript
export const handler = lambdaHandler(mintApiKey, {
  logResponse: false, // response carries a one-time secret
});
// logEvent: false suppresses the event log the same way
```

## See Also

- **`skill("datadog")`** - Datadog integration and log forwarding
- **`skill("handlers")`** - Handler lifecycle with automatic log context
- **`skill("variables")`** - LOG_LEVEL and other environment variables
- **`skill("vocabulary")`** - Severity as a `status` vocabulary; reserved attribute names
