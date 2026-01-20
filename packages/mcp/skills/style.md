---
description: Code style conventions and patterns
related: errors, tests
---

# Code Style

Jaypie coding conventions and patterns.

## General Rules

### TypeScript Everywhere

Use TypeScript for all code:

```typescript
// GOOD
function greet(name: string): string {
  return `Hello, ${name}!`;
}

// BAD
function greet(name) {
  return `Hello, ${name}!`;
}
```

### ESM Over CommonJS

Use ES modules:

```typescript
// GOOD
import { log } from "jaypie";
export function myFunction() {}

// BAD
const { log } = require("jaypie");
module.exports = { myFunction };
```

### Alphabetize Everything

Alphabetize imports, object keys, exports:

```typescript
// GOOD
import { ConfigurationError, log, NotFoundError } from "jaypie";

const config = {
  apiKey: "...",
  baseUrl: "...",
  timeout: 5000,
};

// BAD
import { NotFoundError, log, ConfigurationError } from "jaypie";
```

## Function Signatures

### Object Parameters

Use destructured objects for multiple parameters:

```typescript
// GOOD
function createUser({ email, name, role }: CreateUserInput) {}

// GOOD (single required + optional config)
function fetchData(url: string, { timeout, retries }: FetchOptions = {}) {}

// BAD (multiple positional parameters)
function createUser(email: string, name: string, role: string) {}
```

### Allow Zero Arguments

Functions with optional config should allow no arguments:

```typescript
// GOOD
function initialize(options: InitOptions = {}) {
  const { timeout = 5000, retries = 3 } = options;
}

// Call with or without args
initialize();
initialize({ timeout: 10000 });
```

## Constants

### File-Level Constants

Use SCREAMING_SNAKE_CASE for constants:

```typescript
const DEFAULT_TIMEOUT = 5000;
const DATADOG_SITE = "datadoghq.com";
const HTTP_STATUS = {
  OK: 200,
  NOT_FOUND: 404,
} as const;
```

### Magic Numbers

Never use magic numbers inline:

```typescript
// BAD
if (retries > 3) { ... }
await sleep(5000);

// GOOD
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

if (retries > MAX_RETRIES) { ... }
await sleep(RETRY_DELAY_MS);
```

## Error Handling

### Never Vanilla Error

```typescript
// BAD
throw new Error("Missing config");

// GOOD
import { ConfigurationError } from "jaypie";
throw new ConfigurationError("Missing config");
```

### Error Context

Include relevant context:

```typescript
throw new NotFoundError("User not found", {
  context: { userId, searchedAt: new Date() }
});
```

## Avoid Over-Engineering

### No Premature Abstraction

```typescript
// BAD - Unnecessary abstraction for one use
const formatName = (name) => name.toUpperCase();
const processUser = (user) => ({ ...user, name: formatName(user.name) });

// GOOD - Simple and direct
const processUser = (user) => ({ ...user, name: user.name.toUpperCase() });
```

### Minimal Changes

Only modify what's requested:

- Bug fix? Fix the bug, nothing else.
- Add feature? Add only that feature.
- Don't add docstrings to unchanged code.
- Don't refactor surrounding code.

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Functions | camelCase | `getUser`, `createOrder` |
| Classes | PascalCase | `UserService`, `OrderModel` |
| Constants | SCREAMING_SNAKE | `MAX_RETRIES`, `API_URL` |
| Files | kebab-case | `user-service.ts`, `order-model.ts` |
| Types/Interfaces | PascalCase | `UserInput`, `IUserService` |

## Lint Rules

Use `@jaypie/eslint`:

```javascript
// eslint.config.mjs
import jaypie from "@jaypie/eslint";
export default [...jaypie];
```

Always run `npm run format` before committing.

