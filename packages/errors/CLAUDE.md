# @jaypie/errors

Error utilities for Jaypie applications. Provides typed HTTP errors with JSON:API-compliant response formatting.

## Package Structure

```
src/
├── index.ts                 # Public exports
├── baseErrors.ts            # JaypieError base class
├── errors.ts                # Pre-configured error classes
├── errorFactory.ts          # Factory for creating error classes
├── isJaypieError.ts         # Type guard function
├── jaypieErrorFromStatus.ts # Create error from HTTP status code
└── types.ts                 # Constants and TypeScript interfaces
```

## Core Concepts

### JaypieError Base Class

All errors extend `JaypieError` which provides:
- `status`: HTTP status code
- `title`: Human-readable error title
- `detail`: Error message (same as `message`)
- `isJaypieError`: Always `true` for identification
- `isProjectError`: Legacy alias for `isJaypieError`
- `json()`: Returns JSON:API error object
- `body()`: Returns JSON:API error response body

### Available Errors

**Standard HTTP Errors:**
- `BadGatewayError` (502)
- `BadRequestError` (400)
- `ConflictError` (409)
- `ForbiddenError` (403)
- `GatewayTimeoutError` (504)
- `GoneError` (410)
- `InternalError` (500)
- `MethodNotAllowedError` (405)
- `NotFoundError` (404)
- `TeapotError` (418)
- `TooManyRequestsError` (429)
- `UnauthorizedError` (401)
- `UnavailableError` (503)

**Special Errors:**
- `ConfigurationError` (500) - Application configuration issues
- `CorsError` (401) - CORS validation failures
- `IllogicalError` (500) - Illogical code paths
- `NotImplementedError` (400) - Unimplemented features
- `RejectedError` (403) - Request rejected before processing
- `UnhandledError` (500) - Unhandled exceptions
- `UnreachableCodeError` (500) - Code that should never execute

## Usage

```typescript
import {
  BadRequestError,
  ConfigurationError,
  isJaypieError,
  jaypieErrorFromStatus,
} from "@jaypie/errors";

// Throw with default message
throw new BadRequestError();

// Throw with custom message
throw new ConfigurationError("Missing required API_KEY");

// Errors can be called as functions (proxy pattern)
throw BadRequestError("Invalid input");

// Check if error is a Jaypie error
if (isJaypieError(error)) {
  return res.status(error.status).json(error.body());
}

// Create error from HTTP status code
const error = jaypieErrorFromStatus(404, "User not found");

// Omit the message for the generic strings of that status
jaypieErrorFromStatus(500).detail;
// "An unexpected error occurred and the request was unable to complete"
```

`jaypieErrorFromStatus` covers every status carried by an error class in this
package (400, 401, 403, 404, 405, 409, 410, 418, 429, 500, 502, 503, 504). An
unmapped 4xx falls to `BadRequestError`; anything else falls to `InternalError`.

`@jaypie/kit`'s handler uses the no-message form to scrub a caught error's
`detail` and `title`, and only substitutes within the same status class, so an
unmapped 4xx keeps its own status while carrying the bad request strings. The
handler scrubs 500-class by default and 4xx only when configured with `scrub`.
Add a case when adding an error class with a new status, or that status answers
with `BadRequestError`'s wording.

## Use in Other Packages

This package is foundational and used throughout the monorepo:

- **@jaypie/core**: Re-exports errors, uses in argument validation
- **@jaypie/kit**: Handler error wrapping and chaos testing
- **@jaypie/lambda**: Error handling in Lambda handlers
- **@jaypie/express**: Error responses and CORS handling
- **@jaypie/llm**: Provider error handling
- **@jaypie/aws**: SQS/Secrets/Textract error handling
- **@jaypie/constructs**: CDK construct validation
- **@jaypie/testkit**: Mock patterns and `toThrowJaypieError` matcher

## Guidelines

- Never throw vanilla `Error`; always use a Jaypie error type
- Use `isJaypieError()` to check before accessing Jaypie-specific properties
- Prefer specific error types over generic `InternalError`
- Custom messages are optional; defaults are user-friendly
- A 4xx custom message is for the caller: it reaches the response body, so say
  what to correct
- A 500-class custom message is for the logs, not the caller. Handlers scrub
  `detail` and `title` to the generic strings for the status before a 500-class
  error reaches a response body
