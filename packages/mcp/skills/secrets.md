---
description: Secret management with AWS Secrets Manager
related: apikey, aws, cdk, variables
---

# Secret Management

Jaypie uses AWS Secrets Manager for secure credential storage. The `JaypieSecret` and `JaypieEnvSecret` constructs create secrets at deploy time from environment variables, and `getEnvSecret` retrieves them at runtime.

## JaypieSecret vs JaypieEnvSecret

- **`JaypieSecret`** — a plain secret. Always creates a secret in the current stack from `process.env[envKey]`, an explicit `value`, or `generateSecretString`. No cross-stack imports or exports. This is the construct to reach for.
- **`JaypieEnvSecret`** — extends `JaypieSecret` and adds the environment-driven provider/consumer cross-stack pattern (see [Provider/Consumer Pattern](#providerconsumer-pattern) below). **Deprecated; will be removed in 2.0.**

`JaypieEnvSecret` is a `JaypieSecret`, so it is accepted anywhere a `JaypieSecret` is — including the `secrets` array on `JaypieLambda`. Strings in that array still create env-aware `JaypieEnvSecret` instances.

```typescript
import { JaypieSecret } from "@jaypie/constructs";

// Reads process.env.MY_API_KEY at deploy time
// Throws ConfigurationError if unset and no value/generateSecretString given
new JaypieSecret(this, "MY_API_KEY");

// Generated secret, no env var needed
new JaypieSecret(this, "DbPassword", {
  envKey: "DB_PASSWORD",
  generateSecretString: { excludePunctuation: true, passwordLength: 32 },
});
```

Everything below that uses `JaypieEnvSecret` works the same on `JaypieSecret`, except the provider/consumer cross-stack behavior, which is `JaypieEnvSecret`-only.

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

When the construct ID is a SCREAMING_SNAKE_CASE string (or matches an environment variable name with a non-empty value), `JaypieEnvSecret` automatically:
- Treats the ID as the `envKey`
- Uses the env var's value as the secret content
- Namespaces the CDK construct id as `EnvSecret_${envKey}`

If the shorthand env var is missing at deploy time and no `value` or `generateSecretString` is provided, construction throws `ConfigurationError`. Supply a `value` or `generateSecretString` when the env var may be absent.

### Empty Secret Guard

Synth fails fast whenever a declared secret source produces no secret string, so a blank credential never reaches runtime. A source is declared by `envKey` or by passing a `value` key, and an empty string counts as empty:

```typescript
new JaypieSecret(this, "ApiKey", { value: process.env.MISSING }); // throws ConfigurationError
new JaypieSecret(this, "ApiKey", { envKey: "MISSING" });          // throws ConfigurationError
new JaypieSecret(this, "Placeholder");                            // allowed: CDK generates a random value
```

`JaypieEnvSecret` applies the same guard, except in consumer environments, where the secret is imported rather than created.

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

An env-sourced value is written into the synthesized template. Copies persist in the deployed stack template, the CDK assets bucket, `cdk.out`, and `cdk diff` output. Use [External Secrets](#external-secrets) for credentials that must stay out of those places.

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

### Auto-Detection

The construct auto-detects consumer mode when any of these conditions is true:

| Condition | Trigger |
|-----------|---------|
| `PROJECT_ENV=personal` | Personal environment |
| `CDK_ENV_PERSONAL=true` | Personal environment flag |
| `CDK_ENV_EPHEMERAL=true` | Legacy ephemeral flag |

When consumer mode is active, the construct **imports** a secret from the sandbox stack via CloudFormation exports instead of creating a new one. The export name follows the pattern: `env-sandbox-{PROJECT_KEY}-{SecretName}`.

### Personal Environment Gotcha

**When adding new generated secrets in a personal environment**, the consumer auto-detection can cause deploy failures:

```
No export named env-sandbox-myproject-ProjectSalt found
```

This happens because the personal stack tries to import from sandbox, but sandbox has no such export yet (the secret is new).

**Fix**: Set `consumer: false` for secrets that should be created per-stack:

```typescript
new JaypieEnvSecret(this, "ProjectSalt", {
  envKey: "PROJECT_SALT",
  consumer: false,  // Create in this stack, don't import from sandbox
  generateSecretString: {
    excludePunctuation: true,
    includeSpace: false,
    passwordLength: 64,
  },
});
```

**When to use `consumer: false`:**
- Generated secrets (`generateSecretString`) that don't need to be shared
- Secrets unique to each environment (salts, seeds)

**When to let consumer auto-detect (default):**
- Shared vendor credentials (API keys, database URIs) that exist in sandbox
- Secrets that must be identical across sandbox and personal stacks

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

## External Secrets

`external: true` creates an empty secret (no `SecretString` or `GenerateSecretString`), so the value never enters the template, the assets bucket, `cdk.out`, or `cdk diff`. CI sets the value after deploy. `envKey` still names the runtime variable (`SECRET_ANTHROPIC_API_KEY`) but is never read at synth. Combining `external` with `value` or `generateSecretString` throws `ConfigurationError`.

```typescript
const anthropicSecret = new JaypieSecret(this, "ANTHROPIC_API_KEY", {
  external: true,
});

new JaypieLambda(this, "Handler", {
  code: "dist/lambda",
  handler: "index.handler",
  secrets: [anthropicSecret],
});
```

The construct outputs the secret ARN with the `envKey` (or construct id) as the output description. Set the value in a step after `cdk deploy`, and keep the value out of the deploy step's environment:

```yaml
- name: Set external secrets
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    STACK_NAME: my-stack
  run: |
    ARN=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
      --query "Stacks[0].Outputs[?Description=='ANTHROPIC_API_KEY'].OutputValue" \
      --output text)
    printf '%s' "$ANTHROPIC_API_KEY" > "$RUNNER_TEMP/secret"
    aws secretsmanager put-secret-value --secret-id "$ARN" \
      --secret-string "file://$RUNNER_TEMP/secret" > /dev/null
    rm -f "$RUNNER_TEMP/secret"
```

- A new external secret has no value until the step runs; `getEnvSecret` fails until then.
- CloudFormation never writes the value, so a hand-rotated secret is not overwritten by a later deploy.
- Switching an existing secret to `external` removes `SecretString` from the template. Run the value step in the same workflow.
- Each `put-secret-value` creates a secret version. Compare with `get-secret-value` first to skip unchanged writes.
- In `JaypieEnvSecret` consumer environments the secret is imported; set the value on the provider stack.

### SSOSync Credentials

`JaypieSsoSyncApplication` writes `googleCredentials` and `scimEndpointAccessToken` into the template and warns at synth (`@jaypie/constructs:ssoSyncLiteralCredentials`). Pass secrets instead:

```typescript
new JaypieSsoSyncApplication(this, "SsoSync", {
  googleCredentialsSecret: new JaypieSecret(this, "SsoSyncGoogleCredentials", {
    external: true,
  }),
  scimEndpointAccessTokenSecret: new JaypieSecret(this, "SsoSyncScimToken", {
    external: true,
  }),
});
```

- The application deploys SSOSync as "App only". The construct creates secrets for the admin email, SCIM endpoint URL, region, and identity store ID (still read from `CDK_ENV_SSOSYNC_*`), then passes all six ARNs in `CrossStackConfig`.
- Both secret props are required together, and neither combines with the literal props.
- Secrets need a complete ARN: created in the stack or imported with `Secret.fromSecretCompleteArn`. SSOSync reads them with the AWS managed key.
- Switching an existing application from "App + secrets" deletes the SAR-created `SSOSync*` secrets. Sync fails until CI writes the new secret values. Do not name new secrets `SSOSync*`.
- SSOSync accepts secret ARNs in `us`, `us-gov`, `ap`, `ca`, `cn`, `eu`, and `sa` regions only.

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
    stack-name: JaypieAppStack
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

## See Also

- **`skill("apikey")`** - API key infrastructure using PROJECT_SALT and PROJECT_ADMIN_SEED
- **`skill("cdk")`** - CDK constructs including JaypieLambda secrets integration
- **`skill("variables")`** - Environment variables reference

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
