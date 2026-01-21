---
description: Data models and type definitions
related: fabric, dynamodb, services
---

# Data Models

Patterns for defining data models and types in Jaypie applications.

## TypeScript Interfaces

### Basic Model

```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  createdAt: string;
  updatedAt: string;
}
```

### Input/Output Types

Separate types for different operations:

```typescript
// Create input - required fields only
export interface UserCreateInput {
  email: string;
  name: string;
  role?: "user" | "admin";
}

// Update input - all optional
export interface UserUpdateInput {
  name?: string;
  role?: "user" | "admin";
}

// Response type - full model
export interface UserResponse extends User {
  // Additional computed fields
  displayName: string;
}
```

## Fabric Service Models

Define input schemas inline with fabric services:

```typescript
import { fabricService } from "@jaypie/fabric";

const createUser = fabricService({
  alias: "user_create",
  description: "Create a new user",
  input: {
    email: {
      type: String,
      required: true,
      description: "User email address",
    },
    name: {
      type: String,
      required: true,
      description: "User display name",
    },
    role: {
      type: ["user", "admin"] as const,
      required: false,
      description: "User role (defaults to user)",
    },
  },
  service: async ({ email, name, role }) => {
    // Input is validated and typed
    return createUserInDatabase({ email, name, role: role || "user" });
  },
});
```

## Validation Patterns

### Zod Schemas

```typescript
import { z } from "zod";

export const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(["user", "admin"]).default("user"),
});

export type User = z.infer<typeof userSchema>;

// Validate input
const validated = userSchema.parse(input);
```

### Custom Validators

```typescript
const emailValidator = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const service = fabricService({
  alias: "user_create",
  input: {
    email: { type: String, required: true },
  },
  service: async ({ email }) => {
    if (!emailValidator(email)) {
      throw new BadRequestError("Invalid email format");
    }
    // ...
  },
});
```

## DynamoDB Models

See `skill("dynamodb")` for DynamoDB-specific patterns.

```typescript
// Single-table design types
export interface DynamoItem {
  pk: string;  // Partition key
  sk: string;  // Sort key
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  ttl?: number;
}

export interface UserItem extends DynamoItem {
  type: "USER";
  data: {
    email: string;
    name: string;
    role: "user" | "admin";
  };
}
```

## API Response Models

```typescript
// Standard response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Paginated response
export interface PaginatedResponse<T> {
  items: T[];
  nextToken?: string;
  total?: number;
}
```

## Best Practices

1. **Export types** - Make types available for consumers
2. **Separate concerns** - Input, output, and storage types differ
3. **Use const assertions** - `as const` for literal types
4. **Document fields** - Add JSDoc comments for complex types
5. **Prefer interfaces** - Use `interface` over `type` for objects

## Type Documentation

```typescript
/**
 * Represents a user in the system.
 * @property id - Unique identifier (UUID)
 * @property email - Validated email address
 * @property role - Access level for permissions
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
}
```

