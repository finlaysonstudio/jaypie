---
description: Task-oriented guide for building a Jaypie API server with DynamoDB and API keys
related: apikey, cdk, dynamodb, express, secrets, variables
---

# Recipe: API Server with DynamoDB + API Keys

Step-by-step guide for creating a Jaypie API server stack with DynamoDB storage, generated secrets, and API key authentication.

## 1. Create the DynamoDB Table

```typescript
import { JaypieDynamoDb } from "@jaypie/constructs";

const table = new JaypieDynamoDb(this, "myApi");
// Default keys: model (partition), id (sort)
// Billing: PAY_PER_REQUEST
// Removal: DESTROY (non-prod), RETAIN (prod)
```

No indexes needed initially. API key hashes are stored with `model: "apikey"` and `id: <hash>`, giving direct lookup by hash without a GSI.

See `skill("dynamodb")` for key conventions and query patterns.

## 2. Create Generated Secrets

Two secrets support API key workflows:

```typescript
import { JaypieEnvSecret } from "@jaypie/constructs";
import { isProductionEnv } from "@jaypie/kit";

// PROJECT_SALT — HMAC salt for hashing keys before storage
// If lost, all stored key hashes become unverifiable
const salt = new JaypieEnvSecret(this, "ProjectSalt", {
  envKey: "PROJECT_SALT",
  generateSecretString: {
    excludePunctuation: true,
    includeSpace: false,
    passwordLength: 64,
  },
  removalPolicy: isProductionEnv(),
});

// PROJECT_ADMIN_SEED — derives the bootstrap owner key deterministically
const adminSeed = new JaypieEnvSecret(this, "ProjectAdminSeed", {
  envKey: "PROJECT_ADMIN_SEED",
  generateSecretString: {
    excludePunctuation: true,
    includeSpace: false,
    passwordLength: 64,
  },
});
```

**Personal environment note:** If deploying to a personal environment (`CDK_ENV_PERSONAL=true`), these generated secrets auto-detect as consumers and try to import from sandbox. Since they don't exist there, the deploy fails with `No export named env-sandbox-...`. Fix by adding `consumer: false`:

```typescript
new JaypieEnvSecret(this, "ProjectSalt", {
  envKey: "PROJECT_SALT",
  consumer: false,  // Create in this stack, don't import
  generateSecretString: { /* ... */ },
});
```

See `skill("secrets")` for the full provider/consumer pattern.

## 3. Create the Lambda

```typescript
import { JaypieExpressLambda } from "@jaypie/constructs";

new JaypieExpressLambda(this, "ApiLambda", {
  code: "../api/dist",
  handler: "index.handler",
  tables: [table],     // Auto-grants read/write, sets DYNAMODB_TABLE_NAME
  secrets: [salt, adminSeed, "ANTHROPIC_API_KEY"],
});
```

The `tables` prop:
- Calls `grantReadWriteData()` automatically
- Sets `DYNAMODB_TABLE_NAME` when exactly 1 table is passed

The `secrets` prop accepts both construct instances and string env var names.

See `skill("cdk")` for full Lambda configuration options.

## 4. Express Routes

### Key Generation Endpoint

```typescript
import { expressHandler, generateJaypieKey, hashJaypieKey } from "jaypie";

app.post("/api/keys", expressHandler(async (req, res) => {
  const key = generateJaypieKey({ issuer: "myapi" });
  const hash = hashJaypieKey(key); // Uses process.env.PROJECT_SALT

  // Store hash in DynamoDB
  await dynamoClient.send(new PutItemCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME,
    Item: {
      model: { S: "apikey" },
      id: { S: hash },
      ownerId: { S: req.userId },
      createdAt: { S: new Date().toISOString() },
    },
  }));

  // Return plaintext key to user (only time it's visible)
  return { key };
}));
```

### Key Validation Middleware

```typescript
import { validateJaypieKey, hashJaypieKey, ForbiddenError } from "jaypie";

async function authenticateApiKey(req, res, next) {
  const key = req.headers["x-api-key"];

  if (!key || !validateJaypieKey(key, { issuer: "myapi" })) {
    throw new ForbiddenError("Invalid API key");
  }

  const hash = hashJaypieKey(key);
  const result = await dynamoClient.send(new GetItemCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME,
    Key: { model: { S: "apikey" }, id: { S: hash } },
  }));

  if (!result.Item) {
    throw new ForbiddenError("API key not found");
  }

  req.apiKeyOwner = result.Item.ownerId.S;
  next();
}
```

### Seed-Derived Bootstrap Key

On first startup, derive the admin key from the seed:

```typescript
import { expressHandler, generateJaypieKey, hashJaypieKey, loadEnvSecrets } from "jaypie";

export default expressHandler(handler, {
  secrets: ["PROJECT_SALT", "PROJECT_ADMIN_SEED"],
  setup: async () => {
    // Derive the bootstrap key (deterministic — same every time)
    const adminKey = generateJaypieKey({
      seed: process.env.PROJECT_ADMIN_SEED,
      issuer: "myapi",
    });
    const hash = hashJaypieKey(adminKey);

    // Auto-provision if not exists
    await dynamoClient.send(new PutItemCommand({
      TableName: process.env.DYNAMODB_TABLE_NAME,
      Item: {
        model: { S: "apikey" },
        id: { S: hash },
        ownerId: { S: "admin" },
        createdAt: { S: new Date().toISOString() },
      },
      ConditionExpression: "attribute_not_exists(id)",
    })).catch(() => {}); // Ignore if already exists
  },
});
```

See `skill("apikey")` for full key generation/validation/hashing documentation.

## 5. Deploy

```bash
# First deploy creates secrets and table
PROJECT_ENV=sandbox PROJECT_NONCE=dev npx cdk deploy
```

No workflow secrets needed for generated values — CloudFormation creates them on first deploy and preserves them on subsequent deploys.

## Jaypie Defaults vs CDK Defaults

| Setting | Value | Source |
|---------|-------|--------|
| DynamoDB keys: `model`/`id` | Jaypie construct | Jaypie |
| DynamoDB billing: PAY_PER_REQUEST | Jaypie construct | Jaypie |
| DynamoDB removal: env-aware | Jaypie construct | Jaypie |
| DynamoDB PITR: enabled | Jaypie construct | Jaypie |
| DynamoDB encryption: AWS-owned | CDK default | CDK |
| Secret consumer auto-detect | Jaypie construct | Jaypie |
| Lambda `DYNAMODB_TABLE_NAME` | Jaypie construct (1 table) | Jaypie |

## See Also

- **`skill("apikey")`** - Key generation, validation, hashing, and seed options
- **`skill("cdk")`** - CDK constructs, tables, and secrets integration
- **`skill("dynamodb")`** - Key conventions, queries, and local development
- **`skill("express")`** - Express handler and Lambda adapter
- **`skill("secrets")`** - Secret management and personal environment gotchas
- **`skill("variables")`** - Environment variables reference
