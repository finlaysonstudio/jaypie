---
description: error and logging philosophy
---

# Jaypie Core Errors and Logging

Execution of most Jaypie apps comes through an event "handler" function implementing jaypieHandler, most often expressHandler or lambdaHandler.

## Errors

Jaypie providers errors that will be handled properly when thrown (e.g., presenting the correct status code).

`import { BadGatewayError, BadRequestError, ConfigurationError, ForbiddenError, GatewayTimeoutError, GoneError, IllogicalError, InternalError, MethodNotAllowedError, NotFoundError, NotImplementedError, RejectedError, TeapotError, UnauthorizedError, UnavailableError, UnhandledError, UnreachableCodeError } from "jaypie";`

ConfigurationError is a special InternalError 500 that is can be thrown for incorrect types and other "developer" errors.

Though supported, rely on default error messages when throwing.
Custom error messages should be logged.

<Bad>
throw new NotFoundError("Item not found");
</Bad>
<Good>
log.error("Item not found");
throw new NotFoundError();
</Good>

Error messages may be returned to the user especially in express.

## Logging

`import { log } from "jaypie";`

`log` has methods `trace`, `debug`, `info`, `warn`, `error`, `fatal`, and `var`.
Only `trace` and `var` should be used in "happy paths".
`debug` should be used when execution deviates from the happy path.
`info` should rarely be used.
`var` expects a _single_ key-value pair like `log.var({ key: "value" });`.
Do _not_ pass multiple keys to `var`.
