---
sidebar_position: 6
---

# @jaypie/errors


**Prerequisites:** `npm install jaypie` or `npm install @jaypie/errors`

## Overview

`@jaypie/errors` provides typed error classes that map to HTTP status codes and format as JSON:API errors.

## Installation

```bash
npm install jaypie
# or
npm install @jaypie/errors
```

## Quick Reference

### Error Classes

| Class | Status | Use Case |
|-------|--------|----------|
| `BadRequestError` | 400 | Invalid input |
| `UnauthorizedError` | 401 | Authentication required |
| `ForbiddenError` | 403 | Permission denied |
| `NotFoundError` | 404 | Resource not found |
| `MethodNotAllowedError` | 405 | Wrong HTTP method |
| `GoneError` | 410 | Resource deleted |
| `TeapotError` | 418 | Easter egg |
| `TooManyRequestsError` | 429 | Rate limited |
| `InternalError` | 500 | Server error |
| `ConfigurationError` | 500 | Missing config |
| `NotImplementedError` | 400 | Feature not built |
| `BadGatewayError` | 502 | Upstream error |
| `UnavailableError` | 503 | Service down |
| `GatewayTimeoutError` | 504 | Upstream timeout |
| `RejectedError` | 403 | Request rejected |

### Utilities

| Export | Purpose |
|--------|---------|
| `isJaypieError` | Type guard for Jaypie errors |
| `jaypieErrorFromStatus` | Create error from status code |

## Usage

### Throwing Errors

Both syntaxes work:

```typescript
import { BadRequestError, NotFoundError } from "jaypie";

// Function call (preferred)
throw BadRequestError("Missing required field");

// Constructor
throw new BadRequestError("Missing required field");
```

### Error Properties

```typescript
const error = NotFoundError("User not found");

error.status;     // 404
error.name;       // "NotFoundError"
error.message;    // "User not found"
error.isJaypie;   // true
```

### JSON:API Body

```typescript
const error = BadRequestError("Invalid email");
error.body();
```

Returns:

```json
{
  "errors": [
    {
      "status": 400,
      "title": "Bad Request",
      "detail": "Invalid email"
    }
  ]
}
```

### Type Guard

```typescript
import { isJaypieError, InternalError } from "jaypie";

try {
  await riskyOperation();
} catch (error) {
  if (isJaypieError(error)) {
    return res.status(error.status).json(error.body());
  }
  throw InternalError();
}
```

### From Status Code

```typescript
import { jaypieErrorFromStatus } from "jaypie";

const error = jaypieErrorFromStatus(404, "Not found");
// Returns NotFoundError
```

## Error Selection Guide

### Client Errors (4xx)

| Scenario | Error |
|----------|-------|
| Missing required field | `BadRequestError` |
| Invalid format | `BadRequestError` |
| No auth token | `UnauthorizedError` |
| Invalid auth | `UnauthorizedError` |
| No permission | `ForbiddenError` |
| Resource missing | `NotFoundError` |
| Wrong HTTP method | `MethodNotAllowedError` |
| Resource deleted | `GoneError` |
| Rate limited | `TooManyRequestsError` |

### Server Errors (5xx)

| Scenario | Error |
|----------|-------|
| Missing env var | `ConfigurationError` |
| External API failed | `BadGatewayError` |
| External API timeout | `GatewayTimeoutError` |
| Maintenance mode | `UnavailableError` |
| Unexpected state | `InternalError` |

## Examples

### Validation

```typescript
import { BadRequestError } from "jaypie";

function validateEmail(email) {
  if (!email) {
    throw BadRequestError("Email is required");
  }
  if (!email.includes("@")) {
    throw BadRequestError("Invalid email format");
  }
}
```

### Resource Not Found

```typescript
import { NotFoundError } from "jaypie";

async function getUser(id) {
  const user = await db.users.findById(id);
  if (!user) {
    throw NotFoundError("User not found");
  }
  return user;
}
```

### External Service

```typescript
import { BadGatewayError, log } from "jaypie";

async function callPaymentService(data) {
  try {
    return await paymentApi.charge(data);
  } catch (error) {
    log.error("Payment service failed");
    log.var({ error: error.message });
    throw BadGatewayError();
  }
}
```

### Configuration

```typescript
import { ConfigurationError } from "jaypie";

function getDbUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw ConfigurationError("MONGODB_URI not configured");
  }
  return uri;
}
```

## Testing

```typescript
import { matchers } from "@jaypie/testkit";
expect.extend(matchers);

it("throws BadRequestError for invalid input", () => {
  expect(() => validateEmail(null)).toThrowBadRequestError();
});

it("throws any Jaypie error", () => {
  expect(() => riskyOperation()).toThrowJaypieError();
});
```

### Available Matchers

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

- [Error Handling](/docs/core/error-handling) - Patterns and best practices
- [Handler Lifecycle](/docs/core/handler-lifecycle) - Automatic error formatting
- [Testing](/docs/guides/testing) - Testing error conditions
