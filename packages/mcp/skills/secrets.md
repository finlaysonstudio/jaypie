---
description: Secret management with AWS Secrets Manager
related: aws, cdk, variables
---

# Secret Management

Jaypie uses AWS Secrets Manager for secure credential storage.

## Basic Usage

```typescript
import { getSecret } from "jaypie";

const apiKey = await getSecret("my-api-key");
const dbUri = await getSecret("mongodb-connection-string");
```

## Environment Variables

Reference secrets via environment variables in CDK:

```typescript
const handler = new JaypieLambda(this, "Handler", {
  environment: {
    SECRET_MONGODB_URI: "mongodb-connection-string",
    SECRET_API_KEY: "third-party-api-key",
  },
});
```

In code:

```typescript
const secretName = process.env.SECRET_MONGODB_URI;
const mongoUri = await getSecret(secretName);
```

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
const credentialsJson = await getSecret("my-project/db-credentials");
const credentials = JSON.parse(credentialsJson);
```

## Caching

Secrets are cached by default to reduce API calls:

```typescript
// First call: fetches from Secrets Manager
const key1 = await getSecret("api-key");

// Second call: returns cached value
const key2 = await getSecret("api-key");
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

For local development, use environment variables:

```bash
# .env.local (not committed)
MONGODB_URI=mongodb://localhost:27017/dev
API_KEY=test_key_123
```

In code, check for direct value first:

```typescript
const mongoUri = process.env.MONGODB_URI || await getSecret(process.env.SECRET_MONGODB_URI);
```

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

