---
description: Error handling with @jaypie/errors
related: debugging, logs, tests
---

# Error Handling

Jaypie provides structured error types for consistent error handling.

## Core Principle

**Never throw vanilla `Error`**. Use Jaypie error types:

```typescript
import { ConfigurationError, NotFoundError } from "jaypie";

// BAD
throw new Error("Missing API key");

// GOOD
throw new ConfigurationError("Missing API key");
```

## Error Types

| Error | HTTP Status | Use When |
|-------|-------------|----------|
| BadRequestError | 400 | Invalid input from client |
| UnauthorizedError | 401 | Authentication required |
| ForbiddenError | 403 | Authenticated but not permitted |
| NotFoundError | 404 | Resource doesn't exist |
| ConflictError | 409 | Request conflicts with current state (e.g. uniqueness violation) |
| ConfigurationError | 500 | Missing or invalid config |
| InternalError | 500 | Unexpected server error |

## Usage Examples

### Bad Request

```typescript
import { BadRequestError } from "jaypie";

if (!request.body.email) {
  throw new BadRequestError("Email is required");
}

if (!isValidEmail(request.body.email)) {
  throw new BadRequestError("Invalid email format");
}
```

### Not Found

```typescript
import { NotFoundError } from "jaypie";

const user = await User.findById(userId);
if (!user) {
  throw new NotFoundError(`User ${userId} not found`);
}
```

### Configuration Error

```typescript
import { ConfigurationError } from "jaypie";

if (!process.env.API_KEY) {
  throw new ConfigurationError("API_KEY environment variable is required");
}
```

### Unauthorized vs Forbidden

```typescript
import { UnauthorizedError, ForbiddenError } from "jaypie";

// No credentials provided
if (!token) {
  throw new UnauthorizedError("Authentication required");
}

// Credentials provided but insufficient permission
if (!user.hasRole("admin")) {
  throw new ForbiddenError("Admin access required");
}
```

## Error Cause

Pass the caught error as `cause` when rethrowing so the chain survives:

```typescript
import { ConfigurationError } from "jaypie";

try {
  await getSecret(name);
} catch (error) {
  throw new ConfigurationError("Could not get or parse secret", {
    cause: error,
  });
}
```

`cause` is the second argument to every Jaypie error class and reaches
`error.cause` unchanged, so classification that walks a cause chain sees through
the Jaypie wrapper. An error constructed without the option has no `cause`
property, matching native `Error`.

The base `JaypieError` takes `status` and `title` alongside `cause`; the named
classes take `cause` only, because status and title identify the class.

## Checking Error Types

Use `instanceof`. It holds across the ESM and CommonJS builds and across
duplicate installs, because the classes match on structural markers rather than
prototype identity:

```typescript
import { NotFoundError } from "jaypie";

try {
  await getUser(id);
} catch (error) {
  if (error instanceof NotFoundError) {
    return null;
  }
  throw error;
}
```

Class identity does not hold across module formats. Never compare constructors:

```typescript
// BAD - false when the error crossed an ESM/CommonJS boundary
if (error.constructor === NotFoundError) { ... }

// GOOD
if (error instanceof NotFoundError) { ... }
```

`isJaypieError(error)` answers whether a value is any Jaypie error, and
`error instanceof JaypieError` answers the same question.

## Error Handling in Handlers

Jaypie handlers automatically catch and format errors:

```typescript
import { lambdaHandler } from "@jaypie/lambda";
import { NotFoundError } from "jaypie";

export const handler = lambdaHandler(async (event) => {
  const item = await getItem(event.id);
  if (!item) {
    throw new NotFoundError("Item not found");
    // Returns: { statusCode: 404, body: { error: "Item not found" } }
  }
  return item;
});
```

## Testing Errors

```typescript
import { expect, it } from "vitest";
import { NotFoundError } from "jaypie";

it("throws NotFoundError when user missing", async () => {
  await expect(getUser("invalid-id"))
    .rejects
    .toThrow(NotFoundError);
});

it("preserves the underlying error", async () => {
  try {
    await getUser("invalid-id");
  } catch (error) {
    expect(error.cause).toBeInstanceOf(DatabaseError);
  }
});
```

## See Also

- **`skill("handlers")`** - Handler lifecycle and automatic error formatting
- **`skill("logs")`** - Logging patterns for error context
- **`skill("tests")`** - Testing error types with Vitest

