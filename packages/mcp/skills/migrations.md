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
| `queryInterval` | `cdk.Duration` | `Duration.seconds(60)` | Polling interval between `isCompleteHandler` invocations |
| `secrets` | `SecretsArrayItem[]` | `[]` | Secrets to make available to the Lambda |
| `tables` | `dynamodb.ITable[]` | `[]` | DynamoDB tables to grant read/write access |
| `timeout` | `cdk.Duration` | `Duration.minutes(15)` | Per-invocation Lambda timeout |
| `totalTimeout` | `cdk.Duration` | `Duration.hours(2)` | Maximum wall time across all `isCompleteHandler` invocations |

## Behavior

- **Timeout**: 15 minutes per invocation (Lambda max); `totalTimeout` controls the end-to-end ceiling across all polling invocations (default 2 hours)
- **Role**: Tagged as `CDK.ROLE.PROCESSING`
- **Execution**: Uses `cr.Provider` with both `onEventHandler` and `isCompleteHandler` pointing to the same Lambda. The `onEventHandler` returns `PhysicalResourceId` immediately; the migration code runs in `isCompleteHandler` invocations, which are polled by Step Functions until `IsComplete: true`.
- **Dependencies**: Use `dependencies` to ensure tables and other resources exist before the migration executes
- **Permissions**: Tables passed via `tables` get data-plane (`grantReadWriteData`) plus control-plane access (`DescribeTable`, `UpdateTable`, `UpdateTimeToLive`, `UpdateContinuousBackups`) scoped to the table ARN and its indexes — migrations that add GSIs, toggle TTL, or change backups work without extra IAM

## Migration Lambda Handler

Use `migrationHandler` from `jaypie` so errors propagate as CFN failures and the waiter protocol is handled automatically.

```typescript
// src/migrations/seed/index.ts
import { initClient, seedEntities, APEX } from "@jaypie/dynamodb";
import { migrationHandler } from "jaypie";

export const handler = migrationHandler(async (event) => {
  await initClient();

  await seedEntities([
    { alias: "config-main", model: "config", name: "Main Config", scope: APEX },
    { alias: "vocab-en", model: "vocabulary", name: "English", scope: APEX },
  ]);

  return { status: "complete" };
});
```

`migrationHandler` is `lambdaHandler` with `throw: true` defaulted. Pass `{ throw: false }` to opt back into soft-fail behavior.

### Multi-step migrations (waiter pattern)

Return `{ pending: true }` to request another invocation after `queryInterval`. The handler runs repeatedly until `pending` is omitted or `false`.

```typescript
export const handler = migrationHandler(async (event) => {
  const remaining = await runNextPendingMigration();
  return { pending: remaining > 0 };
});
```

`migrationHandler` maps the `pending` flag onto CFN's `IsComplete` protocol:
- `pending: true` → `{ IsComplete: false }` — waiter re-invokes after `queryInterval`
- `pending: false` or omitted → `{ IsComplete: true }` — deploy proceeds

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

`JaypieMigration` creates:

1. **`JaypieLambda`** - The migration function (exposed as `migration.lambda`)
2. **`cr.Provider`** - Custom resource provider with `onEventHandler` and `isCompleteHandler` both pointing to the migration Lambda; backed by a Step Functions state machine for the waiter loop
3. **`cdk.CustomResource`** - Triggers on every deploy via a `deployNonce` property

Dependencies are attached to the custom resource so the migration waits for prerequisite resources.

## See Also

- **`skill("cdk")`** - CDK constructs and deployment patterns
- **`skill("dynamodb")`** - DynamoDB key design, entity operations, and seed utilities
- **`skill("lambda")`** - Lambda handler wrappers and lifecycle
- **`skill("secrets")`** - Secret management with JaypieEnvSecret
