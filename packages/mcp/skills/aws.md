---
description: AWS integration and cloud services code patterns
related: cdk, dynamodb, secrets, logs, tools-aws
---

# AWS Integration

Jaypie integrates with AWS services through the `@jaypie/aws` package and CDK constructs.
Access `@jaypie/aws` through the main `jaypie` package.

## MCP Tools

For interactive AWS tools (Lambda, S3, SQS, CloudWatch, Step Functions, CloudFormation), see **tools-aws**.

## @jaypie/aws Package

The `@jaypie/aws` package provides SDK utilities for Secrets Manager, SQS, S3, Textract, and streaming.

```typescript
import {
  getEnvSecret,
  getMessages,
  getS3FileBuffer,
  loadEnvSecrets,
  sendBatchMessages,
  sendMessage,
} from "@jaypie/aws";
```

### Available Functions

| Function | Description |
|----------|-------------|
| **Secrets** | |
| `getEnvSecret(name, { env? })` | Preferred: Fetch secret using env var patterns |
| `loadEnvSecrets(...names)` | Load multiple secrets into `process.env` |
| `getSecret(name)` | Internal: Direct fetch by AWS secret name |
| **SQS Messaging** | |
| `sendMessage(body, { queueUrl?, ... })` | Send single message to SQS |
| `sendBatchMessages({ messages, queueUrl?, ... })` | Send multiple messages (batched in groups of 10) |
| `getMessages(event)` | Parse SQS/SNS event into array of message bodies |
| `getSingletonMessage(event)` | Get exactly one message or throw `BadGatewayError` |
| **S3** | |
| `getS3FileBuffer({ bucket, key })` | Fetch S3 file as Buffer |
| **Textract** | |
| `sendTextractJob({ bucket, key, ... })` | Start async Textract job |
| `getTextractJob(jobId)` | Get results of completed Textract job |
| **Streaming** | |
| `JaypieStream` | Class wrapping async iterable with streaming methods |
| `createJaypieStream(source)` | Factory for JaypieStream |
| `createLambdaStream(stream, writer)` | Stream to Lambda response writer |
| `createExpressStream(stream, res)` | Stream to Express response |

## Secrets Management

### getEnvSecret (Preferred)

Use `getEnvSecret` for environment-aware secret resolution. It checks environment variables in order:

1. `SECRET_{name}` - Explicit secret reference (fetches from Secrets Manager)
2. `{name}_SECRET` - Alternative secret reference (fetches from Secrets Manager)
3. `{name}` - Returns direct value without AWS call

```typescript
import { getEnvSecret } from "@jaypie/aws";

// If SECRET_ANTHROPIC_API_KEY="arn:aws:secretsmanager:..." exists, fetches from AWS
// Otherwise returns process.env.ANTHROPIC_API_KEY directly
const apiKey = await getEnvSecret("ANTHROPIC_API_KEY");
```

This pattern allows the same code to work locally (with direct env values) and in Lambda (with secret references).

### loadEnvSecrets

Load multiple secrets at once during handler initialization:

```typescript
import { loadEnvSecrets } from "@jaypie/aws";

// Load secrets and set in process.env
await loadEnvSecrets("ANTHROPIC_API_KEY", "OPENAI_API_KEY");

// Now available as process.env.ANTHROPIC_API_KEY, etc.
```

### getSecret (Internal Use)

Direct fetch by AWS secret name. Requires `AWS_SESSION_TOKEN`. Prefer `getEnvSecret` unless you need to fetch a secret by its exact AWS name:

```typescript
import { getSecret } from "@jaypie/aws";

// Fetch by exact AWS secret name
const secret = await getSecret("my-project/production/api-key");
```

## SQS Messaging

### sendMessage

Send a single message to SQS. Uses `CDK_ENV_QUEUE_URL` by default:

```typescript
import { sendMessage } from "@jaypie/aws";

// Simple usage with default queue
await sendMessage({ action: "process", documentId: "doc-123" });

// With explicit queue URL
await sendMessage({ action: "process" }, { queueUrl: "https://sqs..." });

// With options
await sendMessage(
  { action: "process" },
  {
    delaySeconds: 30,
    messageAttributes: { Priority: { DataType: "String", StringValue: "high" } },
    queueUrl: process.env.CDK_ENV_QUEUE_URL,
  }
);
```

### sendBatchMessages

Send multiple messages, automatically batched in groups of 10:

```typescript
import { sendBatchMessages } from "@jaypie/aws";

const messages = items.map((item) => ({ action: "process", id: item.id }));
await sendBatchMessages({ messages });
```

### getMessages and getSingletonMessage

Parse incoming SQS/SNS events:

```typescript
import { getMessages, getSingletonMessage } from "@jaypie/aws";

// Get all messages from event
const messages = getMessages(event); // Returns array

// Get exactly one message or throw BadGatewayError
const message = getSingletonMessage(event);
```

## S3 Operations

### getS3FileBuffer

Fetch a file from S3 as a Buffer:

```typescript
import { getS3FileBuffer } from "@jaypie/aws";

const buffer = await getS3FileBuffer({
  bucket: process.env.CDK_ENV_BUCKET,
  key: "documents/report.pdf",
});
```

## Textract

### Document Processing

```typescript
import { sendTextractJob, getTextractJob } from "@jaypie/aws";

// Start async job
const { JobId } = await sendTextractJob({
  bucket: process.env.CDK_ENV_BUCKET,
  key: "documents/scan.pdf",
});

// Later, retrieve results
const results = await getTextractJob(JobId);
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AWS_SESSION_TOKEN` | Required for secrets access in Lambda |
| `CDK_ENV_BUCKET` | Default S3 bucket name |
| `CDK_ENV_QUEUE_URL` | Default SQS queue URL |
| `CDK_ENV_SNS_TOPIC_ARN` | SNS topic ARN |
| `CDK_ENV_SNS_ROLE_ARN` | SNS role ARN |
| `PROJECT_KEY` | Used for FIFO queue message group ID |

## Credential Management

### Local Development

Configure credentials via environment or files:

```bash
# Set default profile
export AWS_PROFILE=development

# Or use named profiles
export AWS_PROFILE=production
```

Credential chain priority:
1. Environment variables (`AWS_ACCESS_KEY_ID`, etc.)
2. `~/.aws/credentials` and `~/.aws/config`
3. SSO sessions via `aws sso login`

### Lambda Runtime

Lambda functions automatically receive credentials via IAM role. Use CDK to grant permissions:

```typescript
import { JaypieLambda } from "@jaypie/constructs";

const handler = new JaypieLambda(this, "Handler", {
  entry: "src/handler.ts",
});

// Grant S3 access
bucket.grantReadWrite(handler);

// Grant SQS access
queue.grantSendMessages(handler);

// Grant Secrets Manager access
secret.grantRead(handler);
```

## Error Handling

Handle AWS errors with Jaypie patterns:

```typescript
import { getEnvSecret } from "@jaypie/aws";
import { ConfigurationError, log } from "jaypie";

async function getApiKey() {
  try {
    return await getEnvSecret("API_KEY");
  } catch (error) {
    log.error("Failed to retrieve API key", { error });
    throw new ConfigurationError("API key not configured");
  }
}
```

## Testing

Mock AWS functions in tests:

```typescript
import { getEnvSecret, sendMessage } from "@jaypie/testkit/mock";
import { vi } from "vitest";

vi.mock("@jaypie/aws");

describe("Handler", () => {
  it("sends message to queue", async () => {
    vi.mocked(sendMessage).mockResolvedValue({ MessageId: "123" });

    await handler({ documentId: "doc-123" });

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: "doc-123" })
    );
  });

  it("fetches secret from environment", async () => {
    vi.mocked(getEnvSecret).mockResolvedValue("test-api-key");

    const key = await getApiKey();

    expect(key).toBe("test-api-key");
  });
});
```
