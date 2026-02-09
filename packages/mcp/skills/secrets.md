---
description: Secret management with AWS Secrets Manager
related: aws, cdk, variables
---

# Secret Management

Jaypie uses AWS Secrets Manager for secure credential storage. The `JaypieEnvSecret` construct creates secrets at deploy time from environment variables, and `getEnvSecret` retrieves them at runtime.

## The Pattern

1. **Deploy time**: Set environment variables in CI/CD (e.g., `MONGODB_URI=mongodb+srv://...`)
2. **CDK**: `JaypieEnvSecret` reads the env var and creates/updates an AWS secret
3. **Runtime**: `getEnvSecret("MONGODB_URI")` fetches from Secrets Manager

This keeps secrets out of code and config files while enabling environment-specific values.

## CDK: Creating Secrets with JaypieEnvSecret

The simplest pattern uses the environment variable name as the construct ID:

```typescript
import { JaypieEnvSecret, JaypieLambda } from "@jaypie/constructs";

// Creates secret from process.env.MONGODB_URI at deploy time
const mongoSecret = new JaypieEnvSecret(this, "MONGODB_URI");
const anthropicSecret = new JaypieEnvSecret(this, "ANTHROPIC_API_KEY");

// Lambda with secrets array (auto-creates JaypieEnvSecret instances)
new JaypieLambda(this, "Handler", {
  code: "dist/lambda",
  handler: "index.handler",
  secrets: ["MONGODB_URI", "ANTHROPIC_API_KEY"],
});
```

When the construct ID matches an environment variable name, `JaypieEnvSecret` automatically:
- Uses that env var's value as the secret content
- Sets `envKey` to the ID for later reference

### CI/CD Setup

Set secrets as environment variables in your deployment pipeline:

```yaml
# GitHub Actions example
jobs:
  deploy:
    env:
      MONGODB_URI: ${{ secrets.MONGODB_URI }}
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    steps:
      - run: npx cdk deploy
```

## Runtime: Retrieving Secrets

Use `getEnvSecret` to fetch secrets in Lambda:

```typescript
import { getEnvSecret } from "jaypie";

const mongoUri = await getEnvSecret("MONGODB_URI");
const apiKey = await getEnvSecret("ANTHROPIC_API_KEY");
```

### Loading Multiple Secrets

Use `loadEnvSecrets` during handler initialization to populate `process.env`:

```typescript
import { loadEnvSecrets } from "jaypie";

await loadEnvSecrets("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "MONGODB_URI");

// Now available as process.env.ANTHROPIC_API_KEY, etc.
```

## Provider/Consumer Pattern

For shared secrets across environments (e.g., sandbox providing to personal builds):

```typescript
// Sandbox stack (provider) - exports the secret name
new JaypieEnvSecret(this, "SHARED_API_KEY", { provider: true });

// Personal build (consumer) - imports from sandbox
new JaypieEnvSecret(this, "SHARED_API_KEY"); // consumer auto-detected
```

The construct auto-detects consumer mode for personal/ephemeral environments (`PROJECT_ENV=personal` or `CDK_ENV_PERSONAL=true`).

## Generated Secrets

For secrets that don't come from an external source, use `generateSecretString`. CloudFormation generates the value on the **first deploy only** and preserves it across subsequent deploys. The value is never visible in templates, logs, or CI/CD output — it exists only inside AWS Secrets Manager and is retrievable at runtime.

```typescript
new JaypieEnvSecret(this, "DB_PASSWORD", {
  generateSecretString: {
    excludePunctuation: true,
    passwordLength: 32,
  },
});
```

This is the preferred pattern for any secret that can be randomly generated. No GitHub secret or workflow variable is needed — the CDK deploy creates and manages the value automatically.

### Base62 Generated Secrets

For secrets that must be base62-safe (`0-9A-Za-z` only), such as seeds and signing keys:

```typescript
new JaypieEnvSecret(this, "AdminSeed", {
  envKey: "PROJECT_ADMIN_SEED",
  generateSecretString: {
    excludePunctuation: true,
    includeSpace: false,
    passwordLength: 64,
  },
});
```

With `excludePunctuation: true` and `includeSpace: false`, the generated value contains only base62 characters.

## Seeds and API Keys in Workflows

Seeds are secrets used to derive deterministic values (like API keys) at runtime. The generated-secret pattern is ideal for seeds because:

1. **Set once**: CloudFormation generates the value on the first deploy. Subsequent deploys do not regenerate it.
2. **Never known**: No human ever sees the seed value. It exists only in Secrets Manager.
3. **Retrievable at runtime**: `loadEnvSecrets("PROJECT_ADMIN_SEED")` populates `process.env` for the handler to derive keys from.
4. **Environment-isolated**: Each environment (sandbox, development, production) generates its own independent seed.

### CDK Pattern

Create the secret with `generateSecretString` and pass it to the Lambda:

```typescript
import { JaypieEnvSecret, JaypieExpressLambda } from "@jaypie/constructs";

const adminSeed = new JaypieEnvSecret(this, "ProjectAdminSeed", {
  envKey: "PROJECT_ADMIN_SEED",
  generateSecretString: {
    excludePunctuation: true,
    includeSpace: false,
    passwordLength: 64,
  },
});

new JaypieExpressLambda(this, "ApiLambda", {
  code: "dist",
  handler: "index.handler",
  secrets: [adminSeed],
});
```

### Runtime Usage

The handler loads the seed at startup and derives keys:

```typescript
import { expressHandler } from "jaypie";

export default expressHandler(handler, {
  secrets: ["PROJECT_ADMIN_SEED"],
  setup: () => initClient(),
});
```

At runtime, `process.env.PROJECT_ADMIN_SEED` contains the generated seed value. Application code uses it to derive API keys via HMAC, validate presented keys, and auto-provision on first use.

### Workflow Integration

No special workflow steps are needed for generated secrets. The CDK deploy step handles everything:

```yaml
- name: Deploy CDK Stacks
  uses: ./.github/actions/cdk-deploy
  with:
    stack-name: JaypieGardenApi
```

On the first deploy, CloudFormation generates the seed. On subsequent deploys, the seed is preserved. The workflow never needs to generate, store, or pass the seed value.

### Why Not GitHub Secrets?

For externally-provided credentials (API keys from vendors, database URIs), GitHub environment secrets and env vars are the right approach. But for **internally-generated** secrets like seeds:

- `generateSecretString` is simpler — no manual setup per environment
- The value is never exposed to CI/CD logs or GitHub settings
- CloudFormation guarantees idempotent creation — first deploy sets, updates preserve

## Tagging

Apply standard tags for organization:

```typescript
new JaypieEnvSecret(this, "STRIPE_KEY", {
  roleTag: CDK.ROLE.PAYMENT,
  vendorTag: CDK.VENDOR.STRIPE,
});
```

## Local Development

For local development, set environment variables directly in `.env.local`:

```bash
# .env.local (not committed)
ANTHROPIC_API_KEY=sk-ant-test123
MONGODB_URI=mongodb://localhost:27017/dev
```

`getEnvSecret` returns these values directly without AWS calls when no `SECRET_` prefix is present.

## Alternative Approaches

### Explicit Value

Pass a value directly instead of reading from environment:

```typescript
new JaypieEnvSecret(this, "ApiKey", {
  value: "sk_live_abc123", // Not recommended - prefer env vars
});
```

### Manual SECRET_ Linking

For non-JaypieEnvSecret secrets, manually set the `SECRET_` prefix:

```typescript
new JaypieLambda(this, "Handler", {
  environment: {
    SECRET_MONGODB_URI: "my-project/mongodb-uri", // AWS secret name
  },
});
```

At runtime, `getEnvSecret("MONGODB_URI")` sees `SECRET_MONGODB_URI` and fetches from that AWS secret name.

The `_SECRET` suffix also works:

```typescript
environment: {
  MONGODB_URI_SECRET: "my-project/mongodb-uri",
}
```

### Direct Secret Access

Use `getSecret` when you need to fetch by exact AWS secret name:

```typescript
import { getSecret } from "jaypie";

const secret = await getSecret("my-project/production/api-key");
```

Note: `getSecret` requires `AWS_SESSION_TOKEN` and always calls Secrets Manager.

## Caching

Secrets are cached by default to reduce API calls. Cache is scoped to Lambda execution context (warm starts reuse cache).

## IAM Permissions

`JaypieEnvSecret` implements `ISecret`, so grant access directly:

```typescript
const secret = new JaypieEnvSecret(this, "API_KEY");
secret.grantRead(lambdaFunction);
```

Or use the `secrets` array on `JaypieLambda`, which handles permissions automatically.

## Testing

Mock secret functions in tests:

```typescript
import { getEnvSecret } from "@jaypie/testkit/mock";
import { vi } from "vitest";

vi.mock("@jaypie/aws");

describe("Handler", () => {
  it("uses API key from secrets", async () => {
    vi.mocked(getEnvSecret).mockResolvedValue("test-api-key");

    const result = await handler();

    expect(getEnvSecret).toHaveBeenCalledWith("API_KEY");
  });
});
```
