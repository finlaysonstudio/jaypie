---
sidebar_position: 2
---

# Error Handling

**Use this page when:** throwing errors in Jaypie applications, handling errors from external services, or understanding JSON:API error format.

**Prerequisites:** `npm install jaypie` (includes `@jaypie/errors`)

## Overview

Jaypie provides typed error classes that map to HTTP status codes and format as JSON:API errors.
Never throw vanilla `Error` in Jaypie applications. Always use Jaypie error classes.

## Quick Reference

| Error Class | Status | Use Case |
|-------------|--------|----------|
| `BadRequestError` | 400 | Invalid input, missing required fields |
| `UnauthorizedError` | 401 | Authentication required or failed |
| `ForbiddenError` | 403 | Permission denied |
| `NotFoundError` | 404 | Resource not found |
| `MethodNotAllowedError` | 405 | HTTP method not supported |
| `GoneError` | 410 | Resource permanently deleted |
| `TeapotError` | 418 | Easter egg |
| `TooManyRequestsError` | 429 | Rate limited |
| `InternalError` | 500 | Generic server error |
| `ConfigurationError` | 500 | Application misconfiguration |
| `NotImplementedError` | 400 | Feature not implemented |
| `BadGatewayError` | 502 | Upstream service error |
| `UnavailableError` | 503 | Service unavailable |
| `GatewayTimeoutError` | 504 | Upstream timeout |
| `RejectedError` | 403 | Request rejected before processing |

## Usage

### Throwing Errors

Both function call and `new` syntax work:

```typescript
import { BadRequestError, NotFoundError } from "jaypie";

// Function call syntax (preferred)
throw BadRequestError("Missing required field");

// Constructor syntax
throw new BadRequestError("Missing required field");
```

### Error Properties

```typescript
const error = BadRequestError("Invalid email format");

error.status;     // 400
error.name;       // "BadRequestError"
error.message;    // "Invalid email format"
error.isJaypie;   // true
error.body();     // JSON:API formatted error object
```

### JSON:API Format

Jaypie errors format as JSON:API error objects:

```typescript
const error = NotFoundError("User not found");
error.body();
```

Returns:

```json
{
  "errors": [
    {
      "status": 404,
      "title": "Not Found",
      "detail": "User not found"
    }
  ]
}
```

### Type Guard

Use `isJaypieError` to safely check error type:

```typescript
import { isJaypieError } from "jaypie";

try {
  await riskyOperation();
} catch (error) {
  if (isJaypieError(error)) {
    // Safe to access .status, .body()
    return res.status(error.status).json(error.body());
  }
  // Handle non-Jaypie errors
  throw InternalError("Unexpected error");
}
```

### Dynamic Error Creation

Create errors from HTTP status codes:

```typescript
import { jaypieErrorFromStatus } from "jaypie";

const error = jaypieErrorFromStatus(404, "Resource not found");
// Returns NotFoundError with message "Resource not found"
```

## When to Use Each Error

### Client Errors (4xx)

| Scenario | Error |
|----------|-------|
| Missing required field | `BadRequestError` |
| Invalid field format | `BadRequestError` |
| Missing auth token | `UnauthorizedError` |
| Invalid auth token | `UnauthorizedError` |
| User lacks permission | `ForbiddenError` |
| Resource doesn't exist | `NotFoundError` |
| Wrong HTTP method | `MethodNotAllowedError` |
| Resource was deleted | `GoneError` |
| Rate limit exceeded | `TooManyRequestsError` |

### Server Errors (5xx)

| Scenario | Error |
|----------|-------|
| Missing env variable | `ConfigurationError` |
| External API failed | `BadGatewayError` |
| External API timeout | `GatewayTimeoutError` |
| Service in maintenance | `UnavailableError` |
| Unexpected state | `InternalError` |

## Error Handling Pattern

### In Handlers

Jaypie handlers automatically catch and format errors:

```typescript
import { expressHandler, NotFoundError } from "jaypie";

export default expressHandler(async (req, res) => {
  const user = await db.users.findById(req.params.id);
  if (!user) throw NotFoundError("User not found");
  return { data: user };
});
// NotFoundError automatically returns 404 with JSON:API body
```

### Wrapping External Errors

Convert external service errors to Jaypie errors:

```typescript
import { BadGatewayError, log } from "jaypie";

async function callExternalApi(data) {
  try {
    return await externalService.call(data);
  } catch (error) {
    log.error("External API failed");
    log.var({ error: error.message });
    throw BadGatewayError();
  }
}
```

### Don't Include Sensitive Data

Never include internal details in error messages:

```typescript
// Bad - exposes internal details
throw InternalError(`Database error: ${dbError.message}`);

// Good - log internally, return generic message
log.error("Database query failed");
log.var({ error: dbError.message });
throw InternalError();
```

## Testing Errors

Use `@jaypie/testkit` custom matchers:

```typescript
import { matchers } from "@jaypie/testkit";
expect.extend(matchers);

it("throws NotFoundError for missing user", () => {
  expect(() => getUser("invalid-id")).toThrowNotFoundError();
});

it("throws any Jaypie error", () => {
  expect(() => riskyOperation()).toThrowJaypieError();
});
```

Available matchers:
- `toThrowJaypieError()`
- `toThrowBadRequestError()`
- `toThrowUnauthorizedError()`
- `toThrowForbiddenError()`
- `toThrowNotFoundError()`
- `toThrowInternalError()`
- `toThrowConfigurationError()`
- `toThrowBadGatewayError()`
- `toThrowUnavailableError()`

## Related

- [Handler Lifecycle](/docs/core/handler-lifecycle) - How handlers process errors
- [Logging](/docs/core/logging) - Logging errors appropriately
- [@jaypie/errors](/docs/packages/errors) - Full API reference
- [Testing](/docs/guides/testing) - Testing error conditions
