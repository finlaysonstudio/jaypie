---
sidebar_position: 8
---

# @jaypie/kit


**Prerequisites:** `npm install jaypie` or `npm install @jaypie/kit`

## Overview

`@jaypie/kit` provides utility functions including type coercion (`force`), UUID generation, and environment detection.

## Installation

```bash
npm install jaypie
# or
npm install @jaypie/kit
```

## Quick Reference

### Exports

| Export | Purpose |
|--------|---------|
| `force` | Type coercion utilities |
| `uuid` | UUID v4 generation |
| `sleep` | Promise-based delay |
| `cloneDeep` | Deep object cloning |
| `isLocalEnv` | Check for local environment |
| `isProductionEnv` | Check for production |
| `isNodeTestEnv` | Check for test environment |
| `generateJaypieKey` | Generate API keys with checksum |
| `validateJaypieKey` | Validate API key format and checksum |
| `hashJaypieKey` | SHA-256 hash API keys |

## force

Type coercion with safe defaults.

### force.array

Ensure value is array:

```typescript
import { force } from "jaypie";

force.array("item");           // ["item"]
force.array(["a", "b"]);       // ["a", "b"]
force.array(null);             // []
force.array(undefined);        // []
```

### force.boolean

Parse boolean:

```typescript
force.boolean("true");         // true
force.boolean("false");        // false
force.boolean("1");            // true
force.boolean("0");            // false
force.boolean(1);              // true
force.boolean(null);           // false
```

### force.number

Parse number:

```typescript
force.number("42");            // 42
force.number("3.14");          // 3.14
force.number("invalid");       // 0
force.number(null);            // 0
force.number("100", 50);       // 100 (default ignored)
force.number(null, 50);        // 50 (default used)
```

### force.positive

Ensure non-negative:

```typescript
force.positive(10);            // 10
force.positive(-5);            // 0
force.positive("25");          // 25
force.positive("-10");         // 0
```

### force.string

Ensure string:

```typescript
force.string("hello");         // "hello"
force.string(123);             // "123"
force.string(null);            // ""
force.string(null, "default"); // "default"
```

### force.object

Wrap in object:

```typescript
force.object({ a: 1 });              // { a: 1 }
force.object("value", "key");        // { key: "value" }
force.object(null);                  // {}
force.object(null, "key");           // {}
```

## uuid

Generate UUID v4:

```typescript
import { uuid } from "jaypie";

const id = uuid();
// "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
```

## sleep

Promise-based delay:

```typescript
import { sleep } from "jaypie";

await sleep(1000);  // Wait 1 second
await sleep(500);   // Wait 500ms
```

## cloneDeep

Deep clone objects:

```typescript
import { cloneDeep } from "jaypie";

const original = { a: { b: { c: 1 } } };
const copy = cloneDeep(original);

copy.a.b.c = 2;
console.log(original.a.b.c);  // 1 (unchanged)
```

## Environment Checks

### isLocalEnv

```typescript
import { isLocalEnv } from "jaypie";

if (isLocalEnv()) {
  // PROJECT_ENV === "local"
}
```

### isProductionEnv

```typescript
import { isProductionEnv } from "jaypie";

if (isProductionEnv()) {
  // PROJECT_ENV === "production"
  // OR PROJECT_PRODUCTION === "true"
}
```

### isNodeTestEnv

```typescript
import { isNodeTestEnv } from "jaypie";

if (isNodeTestEnv()) {
  // NODE_ENV === "test"
}
```

## API Key Functions

### generateJaypieKey

Generate API keys with base62 body and optional checksum:

```typescript
import { generateJaypieKey } from "jaypie";

const key = generateJaypieKey();
// "sk_<32 base62 chars>_<4 char checksum>"

const custom = generateJaypieKey({
  issuer: "jaypie",
  prefix: "pk",
  length: 16,
});
// "pk_jaypie_<16 base62 chars>_<4 char checksum>"
```

Prefix and checksum are optional:

```typescript
generateJaypieKey({ prefix: "" });           // "<body>_<checksum>"
generateJaypieKey({ checksum: 0 });          // "sk_<body>"
generateJaypieKey({ prefix: "", checksum: 0 }); // "<body>"
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `checksum` | `number` | `4` | Checksum character count (0 to omit) |
| `issuer` | `string` | `undefined` | Namespace segment after prefix |
| `length` | `number` | `32` | Random body character length |
| `pool` | `string` | base62 | Character pool |
| `prefix` | `string` | `"sk"` | Key prefix (`""` to omit) |
| `separator` | `string` | `"_"` | Delimiter between segments |

### validateJaypieKey

Validate key format and checksum. Prefix and checksum are **not required** — keys without them are still valid. Both `_` and `-` are accepted as separators:

```typescript
import { validateJaypieKey } from "jaypie";

validateJaypieKey(key);                          // true
validateJaypieKey(key, { issuer: "jaypie" });     // true (if generated with issuer)
validateJaypieKey("tampered" + key);              // false
```

### hashJaypieKey

Hash keys for secure storage. Uses HMAC-SHA256 when salted, SHA-256 otherwise:

```typescript
import { hashJaypieKey } from "jaypie";

const hash = hashJaypieKey(key);
// SHA-256 hash (reads PROJECT_SALT env, warns if missing)

const salted = hashJaypieKey(key, { salt: "my-salt" });
// HMAC-SHA256 with explicit salt
```

## Constants

### HTTP

```typescript
import { HTTP } from "jaypie";

HTTP.CODE.OK;              // 200
HTTP.CODE.CREATED;         // 201
HTTP.CODE.NO_CONTENT;      // 204
HTTP.CODE.BAD_REQUEST;     // 400
HTTP.CODE.UNAUTHORIZED;    // 401
HTTP.CODE.FORBIDDEN;       // 403
HTTP.CODE.NOT_FOUND;       // 404
HTTP.CODE.INTERNAL_ERROR;  // 500
```

### JAYPIE

```typescript
import { JAYPIE } from "jaypie";

JAYPIE.LIB.EXPRESS;        // "@jaypie/express"
JAYPIE.LIB.LAMBDA;         // "@jaypie/lambda"
JAYPIE.LIB.LOGGER;         // "@jaypie/logger"
```

## Usage Examples

### Environment-Based Configuration

```typescript
import { isProductionEnv, isLocalEnv } from "jaypie";

const config = {
  logLevel: isProductionEnv() ? "info" : "trace",
  mockServices: isLocalEnv(),
};
```

### Safe Config Parsing

```typescript
import { force } from "jaypie";

const config = {
  port: force.number(process.env.PORT, 3000),
  debug: force.boolean(process.env.DEBUG),
  allowedHosts: force.array(process.env.ALLOWED_HOSTS?.split(",")),
};
```

### ID Generation

```typescript
import { uuid } from "jaypie";

const user = {
  id: uuid(),
  name: "Alice",
  createdAt: new Date(),
};
```

### Retry with Delay

```typescript
import { sleep } from "jaypie";

async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * Math.pow(2, i));
    }
  }
}
```

## Testing

```typescript
import { matchers } from "@jaypie/testkit";
expect.extend(matchers);

it("generates valid UUID", () => {
  const id = uuid();
  expect(id).toMatchUuid();
});
```

## Related

- [jaypie](/docs/packages/jaypie) - Main package
- [Environment Variables](/docs/core/environment) - Environment configuration
