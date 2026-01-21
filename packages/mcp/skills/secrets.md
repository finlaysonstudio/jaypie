---
description: Secret management with AWS Secrets Manager
related: aws, cdk, variables
---

# Secret Management

Jaypie uses AWS Secrets Manager for secure credential storage, with environment-aware resolution that works seamlessly in both local development and Lambda.

## Basic Usage

Use `getEnvSecret` for environment-aware secret resolution:

```typescript
import { getEnvSecret } from "jaypie";

const apiKey = await getEnvSecret("ANTHROPIC_API_KEY");
const dbUri = await getEnvSecret("MONGODB_URI");
```

### How getEnvSecret Works

`getEnvSecret` checks environment variables in order:

1. `SECRET_{name}` - If found, fetches from AWS Secrets Manager
2. `{name}_SECRET` - If found, fetches from AWS Secrets Manager
3. `{name}` - Returns direct value without AWS call

This allows the same code to work locally (with direct env values) and in Lambda (with secret references).

## Loading Multiple Secrets

Use `loadEnvSecrets` during handler initialization:

```typescript
import { loadEnvSecrets } from "jaypie";

// Load secrets and set in process.env
await loadEnvSecrets("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "MONGODB_URI");

// Now available as process.env.ANTHROPIC_API_KEY, etc.
```

## CDK Configuration

Reference secrets via environment variables in CDK:

```typescript
const handler = new JaypieLambda(this, "Handler", {
  environment: {
    // SECRET_ prefix triggers AWS Secrets Manager fetch
    SECRET_MONGODB_URI: "my-project/mongodb-uri",
    SECRET_API_KEY: "my-project/third-party-api-key",
  },
});
```

In code:

```typescript
// getEnvSecret sees SECRET_MONGODB_URI and fetches from Secrets Manager
const mongoUri = await getEnvSecret("MONGODB_URI");
```

## Direct Secret Access

Use `getSecret` when you need to fetch by exact AWS secret name:

```typescript
import { getSecret } from "jaypie";

// Fetch by exact AWS secret name
const secret = await getSecret("my-project/production/api-key");
```

Note: `getSecret` requires `AWS_SESSION_TOKEN` and always calls Secrets Manager. Prefer `getEnvSecret` for typical use cases.

## Creating Secrets

### Via CDK

```typescript
import { Secret } from "aws-cdk-lib/aws-secretsmanager";

const secret = new Secret(this, "ApiKey", {
  secretName: `${projectKey}/api-key`,
  description: "Third-party API key",
});

// Grant read access
secret.grantRead(lambdaFunction);
```

### Via AWS CLI

```bash
aws secretsmanager create-secret \
  --name "my-project/api-key" \
  --secret-string "sk_live_abc123"
```

## Secret Naming Convention

Use project-prefixed names:

```
{project-key}/{secret-name}

Examples:
- my-api/mongodb-uri
- my-api/stripe-key
- my-api/auth0-secret
```

## JSON Secrets

Store structured data:

```bash
aws secretsmanager create-secret \
  --name "my-project/db-credentials" \
  --secret-string '{"username":"admin","password":"secret123"}'
```

Retrieve in code:

```typescript
const credentialsJson = await getEnvSecret("DB_CREDENTIALS");
const credentials = JSON.parse(credentialsJson);
```

## Caching

Secrets are cached by default to reduce API calls:

```typescript
// First call: fetches from Secrets Manager
const key1 = await getEnvSecret("API_KEY");

// Second call: returns cached value
const key2 = await getEnvSecret("API_KEY");
```

Cache is scoped to Lambda execution context (warm starts reuse cache).

## Rotation

Configure automatic rotation for supported secrets:

```typescript
const secret = new Secret(this, "DbPassword", {
  secretName: "my-project/db-password",
  generateSecretString: {
    excludePunctuation: true,
    passwordLength: 32,
  },
});

secret.addRotationSchedule("Rotation", {
  automaticallyAfter: Duration.days(30),
  rotationLambda: rotationFunction,
});
```

## Local Development

For local development, set environment variables directly:

```bash
# .env.local (not committed)
ANTHROPIC_API_KEY=sk-ant-test123
MONGODB_URI=mongodb://localhost:27017/dev
API_KEY=test_key_123
```

`getEnvSecret` automatically returns these values without AWS calls since there's no `SECRET_` prefix.

## IAM Permissions

Lambda needs `secretsmanager:GetSecretValue`:

```typescript
secret.grantRead(lambdaFunction);

// Or via policy
lambdaFunction.addToRolePolicy(new PolicyStatement({
  actions: ["secretsmanager:GetSecretValue"],
  resources: [secret.secretArn],
}));
```

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
