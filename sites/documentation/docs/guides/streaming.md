---
sidebar_position: 6
---

# Streaming

Jaypie provides comprehensive streaming support for real-time responses, LLM streaming, and Server-Sent Events (SSE). This guide covers the three streaming patterns and when to use each.

## Overview

Streaming enables real-time data delivery to clients without waiting for the entire response. Common use cases include:

- **LLM Responses**: Stream AI-generated text as it's produced
- **Progress Updates**: Send status updates during long-running operations
- **Live Data**: Push real-time events to connected clients
- **Large Responses**: Avoid timeouts by streaming large datasets

## Architecture Comparison

| Handler | Package | Express Required | Deployment Target |
|---------|---------|------------------|-------------------|
| `lambdaStreamHandler` | `@jaypie/lambda` | No | Lambda Function URL |
| `expressStreamHandler` | `@jaypie/express` | Yes | Express server (non-Lambda) |
| `createLambdaStreamHandler` | `@jaypie/express` | Yes | Express app on Lambda |

### Decision Flowchart

1. **Is this a pure Lambda function (no Express)?**
   - Yes: Use `lambdaStreamHandler`

2. **Is this an Express app deployed to Lambda?**
   - Yes: Use `createLambdaStreamHandler`

3. **Is this an Express app not on Lambda?**
   - Yes: Use `expressStreamHandler`

## Lambda Response Streaming

For pure Lambda functions without Express, use `lambdaStreamHandler`. This enables AWS Lambda Response Streaming through Function URLs.

### Basic Example

```typescript
import { lambdaStreamHandler } from "jaypie";
import type { StreamHandlerContext } from "@jaypie/lambda";

const handler = lambdaStreamHandler(
  async (event, context: StreamHandlerContext) => {
    const { responseStream } = context;

    responseStream.write("event: start\ndata: {}\n\n");

    for (let i = 0; i < 5; i++) {
      responseStream.write(`event: progress\ndata: {"step": ${i}}\n\n`);
      await processStep(i);
    }

    responseStream.write("event: complete\ndata: {}\n\n");
  },
  { name: "progressHandler" }
);

// Wrap for Lambda streaming
declare const awslambda: { streamifyResponse: <T>(h: T) => T };
export default awslambda.streamifyResponse(handler);
```

### With LLM

```typescript
import { lambdaStreamHandler, createLambdaStream, Llm } from "jaypie";

const handler = lambdaStreamHandler(
  async (event, context) => {
    const llm = new Llm("anthropic");
    const stream = llm.stream(event.prompt);
    await createLambdaStream(stream, context.responseStream);
  },
  {
    name: "llmChat",
    secrets: ["ANTHROPIC_API_KEY"],
  }
);

declare const awslambda: { streamifyResponse: <T>(h: T) => T };
export default awslambda.streamifyResponse(handler);
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Handler name for logging |
| `contentType` | `string` | Response content type (default: `text/event-stream`) |
| `secrets` | `string[]` | AWS Secrets Manager secrets to load |
| `setup` | `Function[]` | Setup functions |
| `teardown` | `Function[]` | Teardown functions (always run) |
| `validate` | `Function[]` | Validation functions |
| `throw` | `boolean` | Re-throw errors instead of SSE error |

## Express SSE Streaming

For Express applications not running on Lambda, use `expressStreamHandler`.

### Basic Example

```typescript
import { expressStreamHandler } from "jaypie";

const streamRoute = expressStreamHandler(async (req, res) => {
  res.write("event: message\ndata: {\"text\": \"Hello\"}\n\n");
  res.write("event: message\ndata: {\"text\": \"World\"}\n\n");
});

app.get("/stream", streamRoute);
```

### With LLM

```typescript
import { expressStreamHandler, createExpressStream, Llm } from "jaypie";

const chatRoute = expressStreamHandler(async (req, res) => {
  const llm = new Llm("anthropic");
  const stream = llm.stream(req.body.prompt);
  await createExpressStream(stream, res);
});

app.post("/chat", chatRoute);
```

### Automatic Headers

`expressStreamHandler` sets these headers:

| Header | Value |
|--------|-------|
| `Content-Type` | `text/event-stream` |
| `Cache-Control` | `no-cache` |
| `Connection` | `keep-alive` |
| `X-Accel-Buffering` | `no` |

## Express on Lambda Streaming

For Express applications deployed to Lambda with streaming support, use `createLambdaStreamHandler`.

### Example

```typescript
import express from "express";
import {
  createLambdaStreamHandler,
  expressHandler,
  expressStreamHandler,
  cors,
} from "jaypie";

const app = express();
app.use(express.json());
app.use(cors());

// Regular endpoint
app.get("/api/data", expressHandler(async (req, res) => {
  return { message: "Hello" };
}));

// Streaming endpoint
app.get("/api/stream", expressStreamHandler(async (req, res) => {
  for (let i = 0; i < 10; i++) {
    res.write(`event: tick\ndata: {"count": ${i}}\n\n`);
    await delay(100);
  }
}));

export const handler = createLambdaStreamHandler(app);
```

## Streaming Utilities

Jaypie provides utilities for working with streams across different targets.

### createLambdaStream

Pipes an async iterable to a Lambda response writer:

```typescript
import { createLambdaStream, Llm } from "jaypie";

const llm = new Llm("anthropic");
const stream = llm.stream("Hello");
await createLambdaStream(stream, context.responseStream);
```

### createExpressStream

Pipes an async iterable to an Express response with SSE headers:

```typescript
import { createExpressStream, Llm } from "jaypie";

const llm = new Llm("anthropic");
const stream = llm.stream("Hello");
await createExpressStream(stream, res);
```

### JaypieStream

A wrapper class that can target either Lambda or Express:

```typescript
import { createJaypieStream, Llm } from "jaypie";

const llm = new Llm("anthropic");
const stream = createJaypieStream(llm.stream("Hello"));

// Choose target at runtime
if (isLambda) {
  await stream.toLambda(responseStream);
} else {
  await stream.toExpress(res);
}
```

### formatSSE

Format a chunk as an SSE event string:

```typescript
import { formatSSE } from "jaypie";

const chunk = { type: "message", content: "Hello" };
const sse = formatSSE(chunk);
// "event: message\ndata: {\"type\":\"message\",\"content\":\"Hello\"}\n\n"
```

### streamToSSE

Convert an async iterable to SSE-formatted strings:

```typescript
import { streamToSSE } from "jaypie";

for await (const event of streamToSSE(dataStream)) {
  responseStream.write(event);
}
```

## CDK/Infrastructure Setup

Enable Lambda Response Streaming in CDK:

```typescript
import { JaypieLambda } from "@jaypie/constructs";
import { FunctionUrlAuthType, InvokeMode } from "aws-cdk-lib/aws-lambda";
import { Duration } from "aws-cdk-lib";

const streamingFunction = new JaypieLambda(this, "StreamingFunction", {
  code: "dist",
  handler: "index.handler",
  timeout: Duration.minutes(5), // Streaming may need longer timeout
});

// Add Function URL with streaming mode
streamingFunction.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE, // or AWS_IAM
  invokeMode: InvokeMode.RESPONSE_STREAM,
});
```

## Error Handling

Errors in streaming handlers are written as SSE error events:

```
event: error
data: {"errors":[{"status":500,"title":"Internal Error"}]}
```

For `lambdaStreamHandler`, use the `throw` option to re-throw errors instead:

```typescript
const handler = lambdaStreamHandler(fn, {
  throw: true, // Re-throw instead of SSE error
});
```

## Testing Streaming Handlers

### Unit Testing

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("jaypie", async () => {
  const testkit = await import("@jaypie/testkit/mock");
  return testkit;
});

import { handler } from "./streamHandler.js";

describe("Streaming Handler", () => {
  it("streams expected events", async () => {
    const writes: string[] = [];
    const mockStream = {
      write: vi.fn((chunk) => writes.push(chunk)),
      end: vi.fn(),
    };

    await handler({ prompt: "test" }, { responseStream: mockStream });

    expect(mockStream.write).toHaveBeenCalled();
    expect(writes.some((w) => w.includes("event:"))).toBe(true);
  });
});
```

### Local Testing

Use Docker and SAM CLI in `packages/express/docker/` to test Lambda streaming locally.

## Related

- [@jaypie/express](/docs/packages/express) - Express handler documentation
- [@jaypie/lambda](/docs/packages/lambda) - Lambda handler documentation
- [LLM Integration](/docs/guides/llm-integration) - Using LLM providers
- [CDK Infrastructure](/docs/guides/cdk-infrastructure) - Deploying Lambda functions
