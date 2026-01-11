---
description: Template files for creating a CDK subpackage in a Jaypie monorepo
---

# CDK Subpackage Templates

Templates for creating a CDK (AWS Cloud Development Kit) subpackage in a Jaypie monorepo.

## bin/cdk.ts

```typescript
#!/usr/bin/env node

import cdk from "aws-cdk-lib";
import { AppStack } from "../lib/cdk-app.ts";
import { InfrastructureStack } from "../lib/cdk-infrastructure.ts";

const app = new cdk.App();

new InfrastructureStack(app, "InfrastructureStack");

new AppStack(app, "AppStack");
```

> **Important:** The second argument to `new AppStack(app, "AppStack")` is the stack ID used by CloudFormation. This must exactly match the `stack-name` parameter in your GitHub Actions deploy workflows. If you customize this value (e.g., `"MyProjectAppStack"`), update `.github/workflows/deploy-*.yml` accordingly.

## lib/cdk-app.ts

```typescript
import {
  JaypieAppStack,
  JaypieApiGateway,
  JaypieExpressLambda,
  JaypieMongoDbSecret,
  JaypieLambda,
} from "@jaypie/constructs";

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";

export class AppStack extends JaypieAppStack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const mongoConnectionString = new JaypieMongoDbSecret(this);

    const expressLambda = new JaypieExpressLambda(this, "expressLambda", {
      code: lambda.Code.fromAsset("../express"),
      handler: "dist/index.expressLambda",
      secrets: [mongoConnectionString],
    });

    new JaypieApiGateway(this, "apiGateway", {
      handler: expressLambda,
      host: "api.example.com",
      zone: "example.com",
    });

    new JaypieLambda(
      this,
      "lambdaWorker",
      {
        code: lambda.Code.fromAsset("../lambda"),
        handler: "dist/index.lambdaWorker",
        secrets: [mongoConnectionString],
      },
    );
  }
}
```

## lib/cdk-infrastructure.ts

```typescript
import {
  JaypieInfrastructureStack,
  JaypieWebDeploymentBucket,
} from "@jaypie/constructs";

export class InfrastructureStack extends JaypieInfrastructureStack {
  constructor(scope, id, props = {}) {
    super(scope, id, props);

    new JaypieWebDeploymentBucket(this, "DeploymentBucket", {
      // * host is not needed if CDK_ENV_WEB_SUBDOMAIN and CDK_ENV_WEB_HOSTED_ZONE or CDK_ENV_HOSTED_ZONE
      // * zone is not needed if CDK_ENV_WEB_HOSTED_ZONE or CDK_ENV_HOSTED_ZONE
    });
  }
}
```

## cdk.json

```json
{
  "app": "npx ts-node --prefer-ts-exts bin/cdk.ts",
  "watch": {
    "include": [
      "**"
    ],
    "exclude": [
      "README.md",
      "cdk*.json",
      "**/*.d.ts",
      "**/*.js",
      "tsconfig.json",
      "package*.json",
      "yarn.lock",
      "node_modules",
      "test"
    ]
  }
}
```
