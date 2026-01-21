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

## Error Context

Add context to errors for debugging:

```typescript
import { NotFoundError } from "jaypie";

throw new NotFoundError("User not found", {
  context: {
    userId,
    requestId: req.id,
    searchedTables: ["users", "legacy_users"],
  },
});
```

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

it("includes context in error", async () => {
  try {
    await getUser("invalid-id");
  } catch (error) {
    expect(error.context.userId).toBe("invalid-id");
  }
});
```

