---
description: SQS messaging patterns, queue constructs, and event parsing
related: aws, cdk, lambda, variables
---

# SQS Messaging

Jaypie provides SQS utilities through `@jaypie/aws` and CDK constructs through `@jaypie/constructs`.

## Sending Messages

```typescript
import { sendMessage, sendBatchMessages } from "@jaypie/aws";

// Simple usage with default queue (CDK_ENV_QUEUE_URL)
await sendMessage({ action: "process", documentId: "doc-123" });

// With explicit queue URL and options
await sendMessage(
  { action: "process" },
  {
    delaySeconds: 30,
    messageAttributes: { Priority: { DataType: "String", StringValue: "high" } },
    queueUrl: "https://sqs...",
  }
);

// Batch send (automatically batched in groups of 10)
const messages = items.map((item) => ({ action: "process", id: item.id }));
await sendBatchMessages({ messages });
```

## Receiving Messages

Parse incoming SQS/SNS events in Lambda handlers:

```typescript
import { getMessages, getSingletonMessage } from "@jaypie/aws";

// Get all messages from event
const messages = getMessages(event); // Returns array of parsed bodies

// Get exactly one message or throw BadGatewayError
const message = getSingletonMessage(event);
```

## CDK: JaypieQueue

SQS queue with DLQ and Lambda trigger:

```typescript
import { JaypieQueue } from "@jaypie/constructs";

const queue = new JaypieQueue(this, "ProcessQueue", {
  visibilityTimeout: Duration.seconds(60),
  retentionPeriod: Duration.days(7),
});

// Connect to Lambda
queue.addEventSource(handler);
```

### Wiring Queue URL to Lambda

```typescript
import { JaypieLambda, JaypieQueue } from "@jaypie/constructs";

const queue = new JaypieQueue(this, "ProcessQueue");

const handler = new JaypieLambda(this, "Handler", {
  entry: "src/handler.ts",
  environment: {
    CDK_ENV_QUEUE_URL: queue.queueUrl,
  },
});

queue.grantSendMessages(handler);
```

### Resource Naming

Queue names are account-global. Always include `PROJECT_ENV` and `PROJECT_NONCE` to avoid collisions:

```typescript
// Bad
queueName: `${prefix}-process`

// Good
queueName: `${prefix}-process-${PROJECT_ENV}-${PROJECT_NONCE}`
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CDK_ENV_QUEUE_URL` | Default SQS queue URL |
| `PROJECT_KEY` | Used for FIFO queue message group ID |

## Testing

```typescript
import { sendMessage } from "@jaypie/testkit/mock";
import { vi } from "vitest";

vi.mock("@jaypie/aws");

it("sends message to queue", async () => {
  vi.mocked(sendMessage).mockResolvedValue({ MessageId: "123" });

  await handler({ documentId: "doc-123" });

  expect(sendMessage).toHaveBeenCalledWith(
    expect.objectContaining({ documentId: "doc-123" })
  );
});
```

## Debugging

```bash
# Check queue depth
aws_sqs_get_queue_attributes --queueUrl "https://..."

# Peek at messages
aws_sqs_receive_message --queueUrl "https://..." --maxNumberOfMessages 5
```

## See Also

- **`skill("aws")`** - Full AWS integration reference
- **`skill("cdk")`** - CDK constructs and deployment patterns
- **`skill("lambda")`** - Lambda handler wrappers and lifecycle
- **`skill("variables")`** - Environment variables reference
