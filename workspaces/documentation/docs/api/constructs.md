# @jaypie/constructs

AWS CDK constructs for serverless patterns.

## Overview

`@jaypie/constructs` provides AWS CDK constructs that encode best practices for common serverless patterns.

## Installation

```bash
npm install @jaypie/constructs
```

## Key Features

### JaypieLambda

Base Lambda construct with secrets, Datadog, and environment variables:

```typescript
import { JaypieLambda } from "@jaypie/constructs";

const lambda = new JaypieLambda(this, "MyLambda", {
  code: lambda.Code.fromAsset("dist"),
  handler: "index.handler",
});
```

### JaypieQueuedLambda

Lambda + SQS queue pattern:

```typescript
import { JaypieQueuedLambda } from "@jaypie/constructs";

const worker = new JaypieQueuedLambda(this, "Worker", {
  code: lambda.Code.fromAsset("dist"),
  handler: "index.handler",
  batchSize: 10,
});
```

### JaypieBucketQueuedLambda

S3 bucket + SQS + Lambda pattern:

```typescript
import { JaypieBucketQueuedLambda } from "@jaypie/constructs";

const processor = new JaypieBucketQueuedLambda(this, "Processor", {
  code: lambda.Code.fromAsset("dist"),
  handler: "index.handler",
});
```

## API Documentation

_API documentation will be generated from TypeScript definitions._

## Related Packages

- [@jaypie/lambda](./lambda) - AWS Lambda integration
- [@jaypie/aws](./aws) - AWS service integrations
