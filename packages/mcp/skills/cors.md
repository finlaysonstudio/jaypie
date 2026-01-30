---
description: CORS configuration for Express.js using Jaypie's cors helper
related: express, handlers, lambda
---

# CORS Configuration

Jaypie's `@jaypie/express` package provides a `cors` helper that wraps the standard [express/cors](https://github.com/expressjs/cors) middleware with Jaypie-specific defaults and environment awareness.

## Quick Start

```typescript
import express from "express";
import { cors } from "jaypie";

const app = express();

// Basic usage - environment-aware defaults
app.use(cors());

// With specific origin
app.use(cors({ origin: "https://example.com" }));

// Multiple origins
app.use(cors({ origin: ["https://a.com", "https://b.com"] }));

// Allow all origins
app.use(cors({ origin: "*" }));
```

## Default Behavior: `cors()`

When called with no arguments, `cors()` allows origins based on environment variables only:

| Condition | Allowed |
|-----------|---------|
| No `Origin` header (curl, mobile, server-to-server) | ✅ Always |
| Origin matches `BASE_URL` env var | ✅ Yes |
| Origin matches `PROJECT_BASE_URL` env var | ✅ Yes |
| `PROJECT_ENV=sandbox` and origin is `localhost[:port]` | ✅ Yes |
| Any other cross-origin request | ❌ Rejected |

**Important:** With no environment variables set and not in sandbox mode, `cors()` rejects all cross-origin browser requests. This is secure by default—you must explicitly configure allowed origins.

```typescript
// Example: Production environment
// BASE_URL=https://api.example.com
// PROJECT_BASE_URL=https://example.com

app.use(cors());
// Allows: https://api.example.com, https://example.com
// Rejects: all other origins

// Example: Sandbox/development
// PROJECT_ENV=sandbox

app.use(cors());
// Allows: http://localhost, http://localhost:3000, http://localhost:5173, etc.
// Rejects: all other origins (unless BASE_URL/PROJECT_BASE_URL set)
```

## Jaypie vs Standard Express CORS

### Key Differences

| Feature | Standard `cors` | Jaypie `cors` |
|---------|-----------------|---------------|
| **Origin Validation** | Static or manual callback | Dynamic environment-aware callback |
| **Environment URLs** | Not supported | Reads `BASE_URL`, `PROJECT_BASE_URL` |
| **Sandbox Mode** | Manual localhost config | Auto-allows localhost in sandbox |
| **Error Response** | Generic CORS error | Returns `CorsError` with JSON body |
| **No-Origin Requests** | Configurable | Always allowed (mobile apps, curl) |

### Jaypie-Specific Behavior

1. **Environment Variable Integration**
   - `BASE_URL` - Automatically added to allowed origins
   - `PROJECT_BASE_URL` - Automatically added to allowed origins
   - Protocol auto-added if missing (defaults to `https://`)

2. **Sandbox Mode** (when `PROJECT_ENV=sandbox` or `PROJECT_SANDBOX_MODE=true`)
   - `http://localhost` is automatically allowed
   - `http://localhost:*` (any port) is automatically allowed

3. **No-Origin Requests**
   - Requests without an `Origin` header are always allowed
   - Enables mobile apps, server-to-server calls, and curl testing

4. **Error Handling**
   - Invalid origins return a `CorsError` from `@jaypie/errors`
   - Response includes JSON body with error details

## Configuration Options

### Jaypie `cors` Options

```typescript
interface CorsConfig {
  origin?: string | string[];  // Additional allowed origins
  overrides?: Record<string, unknown>;  // Pass-through to express/cors
}
```

### Standard `cors` Options (via `overrides`)

All standard `cors` options can be passed through the `overrides` parameter:

```typescript
import { cors } from "jaypie";

app.use(cors({
  origin: "https://example.com",
  overrides: {
    methods: ["GET", "POST", "PUT"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["X-Request-Id"],
    credentials: true,
    maxAge: 86400,
    optionsSuccessStatus: 200,
    preflightContinue: false,
  },
}));
```

### Full Standard Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `methods` | `string \| string[]` | All methods | Allowed HTTP methods |
| `allowedHeaders` | `string \| string[]` | Reflect request | Allowed request headers |
| `exposedHeaders` | `string \| string[]` | None | Headers exposed to browser |
| `credentials` | `boolean` | `false` | Allow credentials (cookies) |
| `maxAge` | `number` | None | Preflight cache duration (seconds) |
| `preflightContinue` | `boolean` | `false` | Pass OPTIONS to next handler |
| `optionsSuccessStatus` | `number` | `204` | Status for successful OPTIONS |

## Usage Patterns

### API with Multiple Allowed Origins

```typescript
import { cors } from "jaypie";

// Production + staging + local origins
app.use(cors({
  origin: [
    "https://app.example.com",
    "https://staging.example.com",
  ],
}));
```

### API with Credentials

```typescript
import { cors } from "jaypie";

// Enable cookies for cross-origin requests
app.use(cors({
  origin: "https://app.example.com",
  overrides: {
    credentials: true,
  },
}));
```

### Public API (Allow All Origins)

```typescript
import { cors } from "jaypie";

// Allow any origin
app.use(cors({ origin: "*" }));
```

### Per-Route CORS

```typescript
import express from "express";
import { cors } from "jaypie";

const app = express();

// Public endpoints - wide open
app.use("/api/public", cors({ origin: "*" }));

// Protected endpoints - restricted origins
app.use("/api/admin", cors({
  origin: "https://admin.example.com",
  overrides: { credentials: true },
}));
```

## How Origin Validation Works

Jaypie's `cors` uses a dynamic origin callback that checks origins in this order:

1. **Wildcard** - If `origin: "*"`, allow all origins
2. **No Origin** - Allow requests without Origin header (mobile, curl, etc.)
3. **Environment URLs** - Check `BASE_URL` and `PROJECT_BASE_URL`
4. **Configured Origins** - Check origins passed to `cors({ origin: [...] })`
5. **Sandbox Localhost** - In sandbox mode, allow localhost with any port

```typescript
// Simplified origin validation logic
const isAllowed =
  origin === "*" ||
  !requestOrigin ||
  requestOrigin.includes(process.env.BASE_URL) ||
  requestOrigin.includes(process.env.PROJECT_BASE_URL) ||
  configuredOrigins.some(o => requestOrigin.includes(o)) ||
  (isSandbox && requestOrigin.match(/^http:\/\/localhost(:\d+)?$/));
```

## Error Responses

When an origin is not allowed, Jaypie returns a structured error response:

```json
{
  "errors": [{
    "title": "CorsError",
    "status": 403,
    "detail": "Cross-Origin Request Blocked"
  }]
}
```

## Comparison: Standard vs Jaypie CORS Setup

### Standard Express CORS

```typescript
import express from "express";
import cors from "cors";

const app = express();

// Manual origin validation
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.BASE_URL,
      process.env.PROJECT_BASE_URL,
      "https://app.example.com",
    ];

    // Allow no-origin requests
    if (!origin) {
      return callback(null, true);
    }

    // Check allowed list
    if (allowedOrigins.some(o => origin.includes(o))) {
      return callback(null, true);
    }

    // Sandbox localhost
    if (process.env.PROJECT_ENV === "sandbox" &&
        origin.match(/^http:\/\/localhost(:\d+)?$/)) {
      return callback(null, true);
    }

    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
```

### Jaypie CORS (Equivalent)

```typescript
import express from "express";
import { cors } from "jaypie";

const app = express();

// Same behavior, less code
app.use(cors({
  origin: "https://app.example.com",
  overrides: { credentials: true },
}));
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BASE_URL` | Automatically added to allowed origins |
| `PROJECT_BASE_URL` | Automatically added to allowed origins |
| `PROJECT_ENV` | Set to `sandbox` to enable localhost access |
| `PROJECT_SANDBOX_MODE` | Set to `true` to enable localhost access |

## See Also

- **`skill("express")`** - Express handler and Lambda adapter documentation
- **`skill("handlers")`** - Jaypie handler lifecycle documentation
- **`skill("lambda")`** - AWS Lambda deployment patterns
