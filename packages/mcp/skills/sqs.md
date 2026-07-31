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

## CDK: JaypieQueuedLambda

Queue and worker Lambda in one construct. FIFO by default; the queue URL is
injected as `CDK_ENV_QUEUE_URL` and the Lambda is granted send and consume.

```typescript
import { JaypieQueuedLambda } from "@jaypie/constructs";

const worker = new JaypieQueuedLambda(this, "ProcessWorker", {
  code: "../api/dist",
  handler: "process.handler",
  batchSize: 1,
  visibilityTimeout: Duration.seconds(360),
});
```

`JaypieBucketQueuedLambda` extends it with an S3 bucket whose `OBJECT_CREATED`
notifications feed the queue (standard, not FIFO — S3 cannot notify a FIFO
queue).

### Dead-Letter Queue

Without a redrive policy a poison message retries until retention lapses, which
pushes consumers into swallowing per-record errors in-handler. That conflates
"this record is bad" with "this record failed transiently", and the transient
case then drops silently. `dlq` adds the dead-letter queue and redrive policy:

```typescript
new JaypieQueuedLambda(this, "Worker", { code: "dist", dlq: true }); // maxReceiveCount 3
new JaypieQueuedLambda(this, "Worker", { code: "dist", dlq: 5 });    // maxReceiveCount 5
new JaypieQueuedLambda(this, "Worker", {
  code: "dist",
  dlq: { maxReceiveCount: 3, retentionPeriod: Duration.days(14) },
});
```

| Value | Meaning |
|-------|---------|
| `true` | Create a DLQ with `maxReceiveCount` 3 and 14-day retention |
| number | Shorthand for `{ maxReceiveCount }` |
| object | `maxReceiveCount`, `retentionPeriod`, or an existing `queue` |

The DLQ matches the source queue's `fifo` setting; SQS rejects a redrive policy
across the FIFO boundary. An existing `queue` must match too.

Alarm on it. A dead-letter queue nobody watches is a place messages go to be
ignored:

```typescript
new cloudwatch.Alarm(this, "WorkerDlqDepth", {
  metric: worker.dlq!.metricApproximateNumberOfMessagesVisible(),
  threshold: 1,
  evaluationPeriods: 1,
});
```

**Naming trap**: `dlq` governs the *queue feeding the Lambda*. The separate
`deadLetterQueue` prop, inherited from `JaypieLambdaProps`, is the Lambda's
*asynchronous-invocation* DLQ and does nothing for SQS event-source failures.

`maxReceiveCount` guidance: pick a number that expires before the work does.
Discord interaction tokens expire in 15 minutes, so 3-5 fits; unlimited
redelivery burns invocations for nothing.

### Wiring Queue URL to a Separate Lambda

```typescript
import { JaypieLambda, JaypieQueuedLambda } from "@jaypie/constructs";

const worker = new JaypieQueuedLambda(this, "ProcessWorker", {
  code: "../api/dist",
  handler: "process.handler",
});

const api = new JaypieLambda(this, "Api", {
  code: "../api/dist",
  handler: "index.handler",
  environment: { CDK_ENV_QUEUE_URL: worker.queueUrl },
});

worker.grantSendMessages(api);
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
