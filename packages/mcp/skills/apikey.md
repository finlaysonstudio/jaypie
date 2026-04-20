---
description: API key generation, validation, and hashing with Jaypie keys
related: dynamodb, secrets, style, tests
---

# API Keys

Jaypie provides four functions for working with API keys: `generateJaypieKey`, `validateJaypieKey`, `hashJaypieKey`, and `jaypieApiKeyId`. Available from `jaypie` or `@jaypie/kit`.

## Generate

```typescript
import { generateJaypieKey } from "jaypie";

const key = generateJaypieKey();
// "sk_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6_Xq7R"
//  ^^ prefix    ^^ 32-char base62 body   ^^ 4-char checksum
```

### With Issuer

Use `issuer` to namespace keys by application or service. Prefer explicit naming:

```typescript
const key = generateJaypieKey({ issuer: "jaypie" });
// "sk_jaypie_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6_Xq7R"
```

### Without Prefix or Checksum

Prefix and checksum are optional. Pass `prefix: ""` or `checksum: 0` to omit:

```typescript
generateJaypieKey({ prefix: "" });
// "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6_Xq7R"

generateJaypieKey({ prefix: "", checksum: 0 });
// "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6"

generateJaypieKey({ prefix: "", issuer: "jaypie" });
// "jaypie_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6_Xq7R"
```

### With Seed

> **Version note:** `seed` support requires `jaypie >= 1.2.17` / `@jaypie/kit >= 1.2.2`.

Pass `seed` to derive a deterministic key from a secret. Uses HMAC-SHA256 with the `issuer` (defaulting to `"jaypie"`) as the HMAC message:

```typescript
const key = generateJaypieKey({ seed: process.env.PROJECT_ADMIN_SEED, issuer: "jaypie" });
// Same seed + same issuer = same key every time
```

Different issuers produce different keys from the same seed:

```typescript
generateJaypieKey({ seed: "my-seed", issuer: "alpha" });
generateJaypieKey({ seed: "my-seed", issuer: "beta" });
// Two different keys
```

This is useful for bootstrapping an initial owner key from a shared secret without requiring database access.

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `checksum` | `4` | Checksum character count (0 to omit) |
| `issuer` | (none) | Namespace segment after prefix |
| `length` | `32` | Random body length |
| `pool` | base62 (`0-9A-Za-z`) | Character pool for body |
| `prefix` | `"sk"` | Key prefix (`""` to omit) |
| `seed` | (none) | Derive key deterministically via HMAC-SHA256 |
| `separator` | `"_"` | Delimiter between segments |

All options are optional. Zero-param call produces `sk_<32 base62>_<4 checksum>`.

### Valid Formats

All of the following are valid key formats:

| Format | Example |
|--------|---------|
| `sk_issuer_body_checksum` | `sk_jaypie_A1b2...p6_Xq7R` |
| `sk_issuer_bodychecksum` | `sk_jaypie_A1b2...p6Xq7R` |
| `sk_body_checksum` | `sk_A1b2...p6_Xq7R` |
| `issuer_bodychecksum` | `jaypie_A1b2...p6Xq7R` |
| `body_checksum` | `A1b2...p6_Xq7R` |
| `body` | `A1b2...p6` |

Both `_` and `-` are accepted as separators in prefix matter.

## Validate

Checks format, character pool, and checksum (when present). Prefix and checksum are **not required** — a key without them is still valid. Pass `issuer` when the key was generated with one:

```typescript
import { validateJaypieKey } from "jaypie";

validateJaypieKey(key);                             // true
validateJaypieKey(key, { issuer: "jaypie" });        // true (if generated with issuer)
validateJaypieKey("tampered" + key);                 // false
validateJaypieKey(key, { issuer: "wrong" });         // false
```

Keys without a prefix validate with default options:

```typescript
const bare = generateJaypieKey({ prefix: "" });
validateJaypieKey(bare);  // true — prefix is not required
```

Keys without checksum validate with default options:

```typescript
const noCheck = generateJaypieKey({ checksum: 0 });
validateJaypieKey(noCheck);  // true — checksum is not required
```

Checksum separator is also optional — `body_checksum` and `bodychecksum` both validate.

Validation does **not** check revocation or authorization — only structural validity.

## Hash

Store hashed keys instead of plaintext. Uses HMAC-SHA256 when salted, SHA-256 otherwise:

```typescript
import { hashJaypieKey } from "jaypie";

// With explicit salt
const hash = hashJaypieKey(key, { salt: "my-secret-salt" });

// Falls back to process.env.PROJECT_SALT
const hash = hashJaypieKey(key);
```

Returns a 64-character hex string. Deterministic — same key and salt always produce the same hash.

### Salt Resolution

1. Explicit `{ salt }` parameter (highest priority)
2. `process.env.PROJECT_SALT` environment variable
3. No salt — plain SHA-256 (logs a warning)

## Derive UUID Id

> **Version note:** `jaypieApiKeyId` requires `jaypie >= 1.2.22` / `@jaypie/kit >= 1.2.8`.

`jaypieApiKeyId(key, { namespace, salt? })` derives a deterministic UUIDv5 from the hashed key. Use this when the id must be surfaced in UIs, API responses, or resource URLs — a 64-char hex hash is not ergonomic, but a UUID is:

```typescript
import { jaypieApiKeyId } from "jaypie";

const APIKEY_NAMESPACE = "b85e1a7a-5c7e-4e7b-9b8e-7c3a9d2f4e5b";

const id = jaypieApiKeyId(key, { namespace: APIKEY_NAMESPACE });
// "c4e1b0d2-..."
```

Properties:

- **Deterministic** — same key + namespace always produces the same id; auth stays `getEntity({ id })`, still no GSI required
- **One-way** — derives from the hash, so the plaintext key cannot be recovered
- **Presentable** — a standard UUID, safe to expose externally

Pick a stable namespace UUID per application (a random UUIDv4 is fine) so ids cannot collide across unrelated services.

## Typical Workflow

1. **Generate** a key and return it to the user (only time plaintext is visible)
2. **Hash** the key and store the hash in the database
3. On subsequent requests, **validate** the key format, then **hash** and compare against stored hash

```typescript
import { generateJaypieKey, hashJaypieKey, validateJaypieKey } from "jaypie";

// Provisioning
const key = generateJaypieKey({ issuer: "jaypie" });
const hash = hashJaypieKey(key);
await db.storeApiKeyHash(userId, hash);
// Return key to user

// Authentication
function authenticate(presentedKey: string) {
  if (!validateJaypieKey(presentedKey, { issuer: "jaypie" })) {
    return false; // Malformed
  }
  const hash = hashJaypieKey(presentedKey);
  return db.findByApiKeyHash(hash);
}
```

## Testing

Mocked in `@jaypie/testkit`:

```typescript
import { generateJaypieKey, hashJaypieKey, validateJaypieKey } from "@jaypie/testkit/mock";
```

- `generateJaypieKey` returns `"sk_MOCK00000000000000000000000000_abcd"`
- `hashJaypieKey` returns `"0".repeat(64)` (64 zeroes)
- `validateJaypieKey` returns `true`

## Infrastructure

Use with the generated secrets pattern for `PROJECT_SALT` and `PROJECT_ADMIN_SEED`:

```typescript
import { isProductionEnv } from "@jaypie/kit";

// PROJECT_SALT — used by hashJaypieKey to HMAC hash keys for storage.
// If this value is lost, all stored key hashes become unverifiable.
new JaypieEnvSecret(this, "ProjectSalt", {
  envKey: "PROJECT_SALT",
  generateSecretString: {
    excludePunctuation: true,
    includeSpace: false,
    passwordLength: 64,
  },
  // Preserve this value if production stack is deleted
  removalPolicy: isProductionEnv(),
});

// PROJECT_ADMIN_SEED — used by generateJaypieKey({ seed }) to derive the bootstrap owner key.
new JaypieEnvSecret(this, "ProjectAdminSeed", {
  envKey: "PROJECT_ADMIN_SEED",
  generateSecretString: {
    excludePunctuation: true,
    includeSpace: false,
    passwordLength: 64,
  },
});
```

See `~secrets` for the full secrets management pattern.

## DynamoDB Storage Pattern

Store API keys in DynamoDB keyed on a deterministic id derived from the plaintext. Both patterns preserve direct `get-item` lookup (no GSI).

### Preferred: UUIDv5 from hash (id safe to expose)

```typescript
const APIKEY_NAMESPACE = "b85e1a7a-5c7e-4e7b-9b8e-7c3a9d2f4e5b";

// model = "apikey", id = uuidv5(hash, namespace) — standard UUID, safe to surface
{ model: "apikey", id: jaypieApiKeyId(key, { namespace: APIKEY_NAMESPACE }), ownerId: "user_123", createdAt: "..." }
```

Use this when the id will appear in API responses, UI, or resource URLs. Auth stays a single `getEntity({ model: "apikey", id: jaypieApiKeyId(presented, { namespace }) })`.

### Alternative: Raw hash id (hidden presentation)

```typescript
// model = "apikey", id = hash — a 64-char hex string, functional but not ergonomic
{ model: "apikey", id: hashJaypieKey(key), ownerId: "user_123", createdAt: "..." }
```

Use when presentation does not matter — internal-only tables, throwaway tooling, or when you are already storing a separate public identifier.

Both patterns use the `JaypieDynamoDb` default key convention (`model`/`id`). See `skill("dynamodb")` for table setup and query patterns.

### Why not `xid = hash` with a GSI?

Another common pattern is `{ id: randomUUID(), xid: hashJaypieKey(key) }` with a GSI on `xid`. It works, but every auth lookup becomes a `query` against a GSI instead of a `get-item`, and you pay the per-deploy cost of an extra index. The UUIDv5 derivation sidesteps both by keeping the id deterministic.

## See Also

- **`skill("cdk")`** - CDK constructs for Lambda with secrets and tables
- **`skill("dynamodb")`** - DynamoDB key conventions and query patterns
- **`skill("secrets")`** - Generated secrets for PROJECT_SALT and PROJECT_ADMIN_SEED
- **`skill("recipe-api-server")`** - End-to-end guide for API server with DynamoDB + API keys
