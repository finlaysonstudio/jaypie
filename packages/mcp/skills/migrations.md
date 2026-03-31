---
description: DynamoDB migration custom resources that run on every CDK deploy
related: cdk, dynamodb, lambda, secrets
---

# Migrations

Jaypie provides `JaypieMigration` for running DynamoDB migrations as CloudFormation custom resources. Migrations execute automatically on every `cdk deploy`.

## Overview

`JaypieMigration` wraps a `JaypieLambda` in a CloudFormation custom resource provider. The Lambda runs during stack create/update, making it ideal for data migrations, seed scripts, and schema changes.

## Usage

```typescript
import { JaypieDynamoDb, JaypieMigration } from "@jaypie/constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";

const table = new JaypieDynamoDb(this, "myApp");

new JaypieMigration(this, "SeedData", {
  code: "dist/migrations/seed",     // Pre-built bundle directory
  handler: "index.handler",
  tables: [table],
  dependencies: [table],            // Ensures table exists first
});
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `code` | `lambda.Code \| string` | *required* | Path to bundled migration code or CDK Code object |
| `dependencies` | `Construct[]` | `[]` | Constructs that must be created before the migration runs |
| `environment` | `Record<string, string> \| (Record<string, string> \| string)[]` | - | Environment variables for the migration Lambda |
| `handler` | `string` | `"index.handler"` | Lambda entry point |
| `secrets` | `SecretsArrayItem[]` | `[]` | Secrets to make available to the Lambda |
| `tables` | `dynamodb.ITable[]` | `[]` | DynamoDB tables to grant read/write access |

## Behavior

- **Timeout**: 5 minutes (vs 30s for API Lambdas) to accommodate long-running migrations
- **Role**: Tagged as `CDK.ROLE.PROCESSING`
- **Execution**: Runs on every deploy via CloudFormation custom resource (uses a deploy nonce to force re-invocation even when only Lambda code changes)
- **Dependencies**: Use `dependencies` to ensure tables and other resources exist before the migration executes

## Migration Lambda Handler

The migration Lambda receives a CloudFormation custom resource event. Return a result to signal success; throw to signal failure and roll back the stack.

```typescript
// src/migrations/seed/index.ts
import { initClient, seedEntities, APEX } from "@jaypie/dynamodb";

export const handler = async (event: any) => {
  await initClient();

  await seedEntities([
    { alias: "config-main", model: "config", name: "Main Config", scope: APEX },
    { alias: "vocab-en", model: "vocabulary", name: "English", scope: APEX },
  ]);

  return { status: "complete" };
};
```

## Building Migration Code

Bundle migrations separately using esbuild, then reference the output directory:

```typescript
// CDK stack
new JaypieMigration(this, "SeedData", {
  code: "../api/dist/migrations/seed",
  handler: "index.handler",
  tables: [table],
  dependencies: [table],
});
```

Or use `lambda.Code.fromAsset()` for more control:

```typescript
import * as lambda from "aws-cdk-lib/aws-lambda";

new JaypieMigration(this, "SeedData", {
  code: lambda.Code.fromAsset("../api/dist/migrations/seed"),
  tables: [table],
  dependencies: [table],
});
```

## With Secrets

Pass secrets when the migration needs external service access (e.g., MongoDB):

```typescript
new JaypieMigration(this, "DataMigration", {
  code: "dist/migrations/migrate-to-dynamo",
  secrets: ["MONGODB_URI"],
  tables: [table],
  dependencies: [table],
});
```

## Construct Internals

`JaypieMigration` creates three resources:

1. **`JaypieLambda`** - The migration function (exposed as `migration.lambda`)
2. **`cr.Provider`** - CloudFormation custom resource provider wrapping the Lambda
3. **`cdk.CustomResource`** - The custom resource that triggers on every deploy

Dependencies are attached to the custom resource so the migration waits for prerequisite resources.

## See Also

- **`skill("cdk")`** - CDK constructs and deployment patterns
- **`skill("dynamodb")`** - DynamoDB key design, entity operations, and seed utilities
- **`skill("lambda")`** - Lambda handler wrappers and lifecycle
- **`skill("secrets")`** - Secret management with JaypieEnvSecret
