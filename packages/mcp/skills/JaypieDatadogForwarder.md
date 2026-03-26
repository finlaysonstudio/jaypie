---
description: JaypieDatadogForwarder CDK construct for deploying and importing the Datadog log forwarder
related: cdk, datadog, aws
---

# JaypieDatadogForwarder

CDK construct that wraps Datadog's official CloudFormation forwarder template. Deploys a Lambda that forwards logs to Datadog.

## Import

```typescript
import { JaypieDatadogForwarder, resolveDatadogForwarderFunction } from "@jaypie/constructs";
```

## Creating the Forwarder (Provider Stack)

```typescript
const forwarder = new JaypieDatadogForwarder(this);
```

Uses environment variables for defaults and automatically exports the Lambda ARN as a CloudFormation output.

### Constructor Signatures

```typescript
new JaypieDatadogForwarder(scope);
new JaypieDatadogForwarder(scope, props);
new JaypieDatadogForwarder(scope, id, props);
```

### Props

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `id` | string | `"DatadogForwarder"` | Construct ID |
| `datadogApiKey` | string | `CDK_ENV_DATADOG_API_KEY` | Datadog API key |
| `account` | string | `CDK_ENV_ACCOUNT` | Account identifier for tags |
| `reservedConcurrency` | string | `"10"` | Lambda reserved concurrency (must be string) |
| `additionalTags` | string | undefined | Extra Datadog tags (comma-separated) |
| `service` | string | `"datadog"` | Service tag value |
| `project` | string | undefined | Project tag value |
| `enableCloudFormationEvents` | boolean | `true` | EventBridge rule for CF events |
| `enableRoleExtension` | boolean | `true` | Extend Datadog IAM role permissions |
| `createOutput` | boolean | `true` | Export forwarder ARN as CfnOutput |
| `exportName` | string | `"account-datadog-forwarder"` | Export name for cross-stack reference |

### Resources Created

1. **Nested CloudFormation Stack** — deploys Datadog's official forwarder template
2. **EventBridge Rule** — forwards CloudFormation events to Datadog (on by default)
3. **CfnOutput** — exports forwarder Lambda ARN with name `"account-datadog-forwarder"`
4. **Extended IAM Permissions** — adds `budgets:ViewBudget`, `logs:DescribeLogGroups` to Datadog role (if `CDK_ENV_DATADOG_ROLE_ARN` is set)

### Public Properties

```typescript
forwarder.cfnStack          // CfnStack — the nested CloudFormation stack
forwarder.forwarderFunction // IFunction — the Datadog forwarder Lambda
forwarder.eventsRule        // Rule | undefined — EventBridge rule (if enabled)
```

## Importing from Another Stack

Use the `resolveDatadogForwarderFunction` helper:

```typescript
import { resolveDatadogForwarderFunction } from "@jaypie/constructs";

const forwarderFunction = resolveDatadogForwarderFunction(this);
```

This imports the Lambda via `Fn.importValue("account-datadog-forwarder")` and caches per scope (WeakMap), so multiple calls in the same stack return the same reference.

### For Log Subscription Filters

Use `resolveDatadogLoggingDestination` to get a `LambdaDestination`:

```typescript
import { resolveDatadogLoggingDestination } from "@jaypie/constructs";

new SubscriptionFilter(this, "DatadogSubscription", {
  logGroup,
  destination: resolveDatadogLoggingDestination(this),
  filterPattern: FilterPattern.allEvents(),
});
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `CDK_ENV_DATADOG_API_KEY` | Default Datadog API key |
| `CDK_ENV_ACCOUNT` | Default account identifier for tagging |
| `CDK_ENV_DATADOG_ROLE_ARN` | Optional: Datadog IAM role ARN to extend permissions |

## Tags

All resources tagged with: `role=monitoring`, `service=datadog`, `vendor=datadog`, and optionally `project`.
