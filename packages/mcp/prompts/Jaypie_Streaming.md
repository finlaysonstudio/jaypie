---
description: Complete guide to streaming in Jaypie - Lambda, Express, and SSE patterns
globs: packages/express/**, packages/lambda/**, packages/aws/**
---

# Jaypie Streaming Guide

Jaypie provides three distinct streaming patterns for different deployment scenarios. This guide explains when to use each approach and how to implement streaming correctly.

## Quick Reference

| Handler | Package | Express Required | Use Case |
|---------|---------|------------------|----------|
| `lambdaStreamHandler` | `@jaypie/lambda` | No | Pure Lambda Function URL streaming |
| `expressStreamHandler` | `@jaypie/express` | Yes | Express routes with SSE |
| `createLambdaStreamHandler` | `@jaypie/express` | Yes | Express app deployed to Lambda with streaming |

### Decision Guide

- **Building a pure Lambda function?** Use `lambdaStreamHandler`
- **Building an Express app for non-Lambda deployment?** Use `expressStreamHandler`
- **Building an Express app that runs on Lambda?** Use `createLambdaStreamHandler`

## Streaming Utilities

All streaming utilities are exported from `@jaypie/aws` and re-exported through `jaypie`:

| Function | Purpose |
|----------|---------|
| `createLambdaStream(stream, writer)` | Pipe async iterable to Lambda response writer |
| `createExpressStream(stream, res)` | Pipe async iterable to Express response with SSE headers |
| `JaypieStream` | Wrapper class with `.toLambda()` and `.toExpress()` methods |
| `createJaypieStream(source)` | Factory function for JaypieStream |
| `formatSSE(chunk)` | Format a chunk as SSE event string |
| `streamToSSE(stream)` | Convert async iterable to SSE-formatted strings |

### Types

```typescript
import type {
  ExpressStreamResponse,
  LambdaStreamWriter,
  SSEEvent,
  StreamChunk,
} from "jaypie";
```

## Pattern 1: lambdaStreamHandler

Use for pure Lambda functions without Express. Requires AWS Lambda Response Streaming via Function URL.

### Basic Usage

```typescript
import { lambdaStreamHandler } from "jaypie";
import type { StreamHandlerContext } from "@jaypie/lambda";

const streamWorker = lambdaStreamHandler(
  async (event: unknown, context: StreamHandlerContext) => {
    const { responseStream } = context;

    responseStream.write("event: start\ndata: {}\n\n");

    for (let i = 0; i < 5; i++) {
      responseStream.write(`event: data\ndata: {"count": ${i}}\n\n`);
    }

    responseStream.write("event: done\ndata: {}\n\n");
    // Handler automatically calls responseStream.end()
  },
  {
    name: "streamWorker",
    contentType: "text/event-stream",
  }
);

// Wrap with AWS streamifyResponse for Lambda
declare const awslambda: { streamifyResponse: <T>(handler: T) => T };
export const handler = awslambda.streamifyResponse(streamWorker);
```

### With LLM Streaming

```typescript
import { lambdaStreamHandler, createLambdaStream, Llm } from "jaypie";
import type { StreamHandlerContext } from "@jaypie/lambda";

interface PromptEvent {
  prompt?: string;
}

const llmStreamHandler = lambdaStreamHandler(
  async (event: PromptEvent, context: StreamHandlerContext) => {
    const llm = new Llm("anthropic");
    const stream = llm.stream(event.prompt || "Hello");

    // createLambdaStream pipes chunks as SSE events
    await createLambdaStream(stream, context.responseStream);
  },
  {
    name: "llmStream",
    secrets: ["ANTHROPIC_API_KEY"],
  }
);

declare const awslambda: { streamifyResponse: <T>(handler: T) => T };
export const handler = awslambda.streamifyResponse(llmStreamHandler);
```

### Handler Options

```typescript
import type { LambdaStreamHandlerOptions } from "@jaypie/lambda";

const options: LambdaStreamHandlerOptions = {
  name: "myStreamHandler",          // Handler name for logging
  contentType: "text/event-stream", // Response content type (default)
  chaos: "low",                     // Chaos testing level
  secrets: ["API_KEY"],             // AWS secrets to load into process.env
  setup: [],                        // Setup function(s)
  teardown: [],                     // Teardown function(s)
  validate: [],                     // Validation function(s)
  throw: false,                     // Re-throw errors instead of SSE error
  unavailable: false,               // Return 503 if true
};
```

### CDK Configuration

```typescript
import { JaypieLambda } from "@jaypie/constructs";
import { FunctionUrlAuthType, InvokeMode } from "aws-cdk-lib/aws-lambda";

const streamingLambda = new JaypieLambda(this, "StreamingFunction", {
  code: "dist",
  handler: "streamWorker.handler",
  timeout: Duration.minutes(5),
});

// Enable Lambda Response Streaming
streamingLambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  invokeMode: InvokeMode.RESPONSE_STREAM,
});
```

## Pattern 2: expressStreamHandler

Use for Express applications not running on Lambda. Sets SSE headers automatically.

### Basic Usage

```typescript
import { expressStreamHandler } from "jaypie";
import type { Request, Response } from "express";

const streamRoute = expressStreamHandler(async (req: Request, res: Response) => {
  // Write SSE events directly to response
  res.write("event: message\ndata: {\"text\": \"Hello\"}\n\n");
  res.write("event: message\ndata: {\"text\": \"World\"}\n\n");
  // Handler automatically ends the stream
});

app.get("/stream", streamRoute);
```

### With LLM Streaming

```typescript
import { expressStreamHandler, createExpressStream, Llm } from "jaypie";

const llmStreamRoute = expressStreamHandler(async (req: Request, res: Response) => {
  const llm = new Llm("anthropic");
  const stream = llm.stream(req.body.prompt);

  // createExpressStream pipes LLM chunks as SSE events
  await createExpressStream(stream, res);
});

app.post("/chat", llmStreamRoute);
```

### Handler Options

```typescript
import type { ExpressStreamHandlerOptions } from "jaypie";

const options: ExpressStreamHandlerOptions = {
  name: "myStreamHandler",          // Handler name for logging
  contentType: "text/event-stream", // Default SSE content type
  chaos: "low",                     // Chaos testing level
  secrets: ["API_KEY"],             // Secrets to load
  setup: [],                        // Setup function(s)
  teardown: [],                     // Teardown function(s)
  validate: [],                     // Validation function(s)
  locals: {},                       // Values to set on req.locals
  unavailable: false,               // Return 503 if true
};
```

### SSE Headers

`expressStreamHandler` automatically sets these headers:

- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`
- `X-Accel-Buffering: no` (disables nginx buffering)

## Pattern 3: createLambdaStreamHandler

Use for Express applications deployed to AWS Lambda with streaming support.

### Basic Usage

```typescript
import express from "express";
import { createLambdaStreamHandler, expressStreamHandler } from "jaypie";

const app = express();

app.get("/stream", expressStreamHandler(async (req, res) => {
  res.write("event: message\ndata: {\"text\": \"Hello\"}\n\n");
  res.write("event: message\ndata: {\"text\": \"World\"}\n\n");
}));

// Export streaming Lambda handler for Express app
export const handler = createLambdaStreamHandler(app);
```

### Combined Buffered and Streaming

When you need both regular endpoints and streaming endpoints:

```typescript
import express from "express";
import {
  createLambdaHandler,
  createLambdaStreamHandler,
  expressHandler,
  expressStreamHandler,
  cors,
} from "jaypie";

const app = express();
app.use(express.json());
app.use(cors());

// Standard buffered route
app.get("/api/data", expressHandler(async (req, res) => {
  return { data: "buffered response" };
}));

// SSE streaming route
app.get("/api/stream", expressStreamHandler(async (req, res) => {
  for (let i = 0; i < 5; i++) {
    res.write(`event: update\ndata: {"count": ${i}}\n\n`);
  }
}));

// Choose based on needs:
// - createLambdaHandler for buffered-only
// - createLambdaStreamHandler for streaming support
export const handler = createLambdaStreamHandler(app);
```

## Streaming Utilities Deep Dive

### JaypieStream Class

Wraps an async iterable for convenient streaming to different targets:

```typescript
import { JaypieStream, createJaypieStream, Llm } from "jaypie";

const llm = new Llm("anthropic");
const stream = createJaypieStream(llm.stream("Hello"));

// Pipe to Lambda
await stream.toLambda(context.responseStream);

// Or pipe to Express
await stream.toExpress(res);

// Or iterate directly
for await (const chunk of stream) {
  console.log(chunk);
}

// Or convert to SSE strings
for await (const sseEvent of stream.toSSE()) {
  console.log(sseEvent);
}
```

### Manual SSE Formatting

```typescript
import { formatSSE } from "jaypie";

const chunk = { type: "message", content: "Hello" };
const sseString = formatSSE(chunk);
// "event: message\ndata: {\"type\":\"message\",\"content\":\"Hello\"}\n\n"
```

### Converting Async Iterables

```typescript
import { streamToSSE } from "jaypie";

async function* myGenerator() {
  yield { type: "start", data: {} };
  yield { type: "data", value: 42 };
  yield { type: "end", data: {} };
}

for await (const sseEvent of streamToSSE(myGenerator())) {
  responseStream.write(sseEvent);
}
```

## Error Handling

Errors in streaming handlers are written as SSE error events:

```typescript
// Format: event: error\ndata: {"errors":[{"status":500,"title":"Internal Error"}]}\n\n
```

For `lambdaStreamHandler`, set `throw: true` to re-throw errors instead of writing to stream:

```typescript
const handler = lambdaStreamHandler(
  async (event, context) => {
    throw new InternalError("Something went wrong");
  },
  {
    throw: true, // Re-throw instead of SSE error
  }
);
```

## Testing Streaming Handlers

### Mocking for Unit Tests

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("jaypie", async () => {
  const testkit = await import("@jaypie/testkit/mock");
  return testkit;
});

import { handler } from "./streamWorker.js";

describe("Stream Handler", () => {
  it("writes expected events", async () => {
    const writes: string[] = [];
    const mockWriter = {
      write: vi.fn((chunk) => writes.push(chunk)),
      end: vi.fn(),
    };

    const event = { prompt: "test" };
    const context = { responseStream: mockWriter };

    await handler(event, context);

    expect(mockWriter.write).toHaveBeenCalled();
    expect(writes.some(w => w.includes("event:"))).toBe(true);
    expect(mockWriter.end).toHaveBeenCalled();
  });
});
```

### Integration Testing

Use the Docker setup in `packages/express/docker/` for local Lambda streaming tests.

## TypeScript Types

```typescript
// From @jaypie/lambda
import type {
  LambdaStreamHandlerOptions,
  StreamHandlerContext,
  ResponseStream,
  AwsStreamingHandler,
} from "@jaypie/lambda";

// From @jaypie/express (or jaypie)
import type {
  ExpressStreamHandlerOptions,
  ExpressStreamHandlerLocals,
  JaypieStreamHandlerSetup,
  JaypieStreamHandlerTeardown,
  JaypieStreamHandlerValidate,
} from "jaypie";

// From @jaypie/aws (or jaypie)
import type {
  ExpressStreamResponse,
  LambdaStreamWriter,
  SSEEvent,
  StreamChunk,
} from "jaypie";
```
