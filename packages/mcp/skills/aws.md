---
description: AWS integration and cloud services code patterns
related: cdk, dynamodb, secrets, logs, tools-aws
---

# AWS Integration

Jaypie integrates with AWS services through the `@jaypie/aws` package and CDK constructs.

## MCP Tools

For interactive AWS tools (Lambda, S3, SQS, CloudWatch, Step Functions, CloudFormation), see **tools-aws**.

## @jaypie/aws Package

The `@jaypie/aws` package provides SDK utilities:

```typescript
import { getSecret, sendMessage } from "@jaypie/aws";

// Get secret from Secrets Manager
const apiKey = await getSecret("my-api-key");

// Send SQS message
await sendMessage(queueUrl, { action: "process", id: "123" });
```

### Available Functions

| Function | Description |
|----------|-------------|
| `getSecret(name)` | Retrieve secret from Secrets Manager |
| `sendMessage(queueUrl, body)` | Send message to SQS queue |
| `textract(bucket, key)` | Extract text from document |

## Environment-Based Configuration

Use CDK environment variables in Lambda:

| Variable | Description |
|----------|-------------|
| `CDK_ENV_BUCKET` | S3 bucket name |
| `CDK_ENV_QUEUE_URL` | SQS queue URL |
| `CDK_ENV_SNS_TOPIC_ARN` | SNS topic ARN |
| `CDK_ENV_SNS_ROLE_ARN` | SNS role ARN |

```typescript
import { sendMessage } from "@jaypie/aws";

// Use environment variable for queue URL
await sendMessage(process.env.CDK_ENV_QUEUE_URL, {
  action: "process",
  documentId: "doc-123",
});
```

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

Lambda functions automatically receive credentials via the IAM role. Use CDK to grant permissions:

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
import { getSecret } from "@jaypie/aws";
import { ConfigurationError, log } from "jaypie";

async function getApiKey() {
  try {
    return await getSecret("my-api-key");
  } catch (error) {
    log.error("Failed to retrieve API key", { error });
    throw new ConfigurationError("API key not configured");
  }
}
```

## Testing

Mock AWS functions in tests:

```typescript
import { getSecret, sendMessage } from "@jaypie/aws";
import { vi } from "vitest";

vi.mock("@jaypie/aws");

describe("Handler", () => {
  it("sends message to queue", async () => {
    vi.mocked(sendMessage).mockResolvedValue({ MessageId: "123" });

    await handler({ documentId: "doc-123" });

    expect(sendMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ documentId: "doc-123" })
    );
  });
});
```

