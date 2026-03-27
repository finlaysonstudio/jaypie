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

## Logging Objects

DO NOT use multiple parameters when logging:
<BAD>
```typescript
log.info("Processing", { id: "my-id" });
```
</BAD>

Use `log.var` to log single-key objects that parse in Datadog:
<GOOD>
```typescript
log.trace("Processing", { id: "my-id" });
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

## Setting Log Level

Via environment variable:

```bash
LOG_LEVEL=debug npm run dev
LOG_LEVEL=trace npm test
```

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
