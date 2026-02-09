---
sidebar_position: 6
---

# Streaming

Jaypie provides comprehensive streaming support for real-time responses, LLM streaming, Server-Sent Events (SSE), and newline-delimited JSON (NLJSON). This guide covers the three streaming patterns and when to use each.

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

## Stream Formats

Jaypie supports two stream output formats via the `format` option:

| Format | Content-Type | Use Case |
|--------|--------------|----------|
| `"sse"` (default) | `text/event-stream` | Browser EventSource API, real-time UI |
| `"nljson"` | `application/x-ndjson` | Machine-to-machine, log processing |

### Format Comparison

| Aspect | SSE | NLJSON |
|--------|-----|--------|
| Data format | `event: <type>\ndata: {...}\n\n` | `{...}\n` |
| Error format | `event: error\ndata: {...}\n\n` | `{"error":{...}}\n` |
| Browser support | Native EventSource | Manual parsing |

```typescript
// SSE format (default)
lambdaStreamHandler(handler, { format: "sse" });
expressStreamHandler(handler, { format: "sse" });

// NLJSON format
lambdaStreamHandler(handler, { format: "nljson" });
expressStreamHandler(handler, { format: "nljson" });
```

## Lambda Response Streaming

For pure Lambda functions without Express, use `lambdaStreamHandler`. This enables AWS Lambda Response Streaming through Function URLs.

**Note:** `lambdaStreamHandler` automatically wraps with `awslambda.streamifyResponse()` in the Lambda runtime. You no longer need to wrap manually.

### Basic Example

```typescript
import { lambdaStreamHandler } from "jaypie";
import type { StreamHandlerContext } from "@jaypie/lambda";

// Auto-wrapped with awslambda.streamifyResponse() in Lambda runtime
export const handler = lambdaStreamHandler(
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
```

### With LLM

```typescript
import { lambdaStreamHandler, createLambdaStream, Llm } from "jaypie";

// Auto-wrapped with awslambda.streamifyResponse() in Lambda runtime
export const handler = lambdaStreamHandler(
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
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Handler name for logging |
| `format` | `StreamFormat` | Stream format: `"sse"` (default) or `"nljson"` |
| `contentType` | `string` | Response content type (auto-set from format) |
| `secrets` | `string[]` | AWS Secrets Manager secrets to load |
| `setup` | `Function[]` | Setup functions |
| `teardown` | `Function[]` | Teardown functions (always run) |
| `validate` | `Function[]` | Validation functions |
| `throw` | `boolean` | Re-throw errors instead of streaming error |

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
| `Content-Type` | `text/event-stream` (SSE) or `application/x-ndjson` (NLJSON) |
| `Cache-Control` | `no-cache` |
| `Connection` | `keep-alive` |
| `X-Accel-Buffering` | `no` |

### Options

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Handler name for logging |
| `format` | `StreamFormat` | Stream format: `"sse"` (default) or `"nljson"` |
| `contentType` | `string` | Response content type (auto-set from format) |
| `secrets` | `string[]` | Secrets to load |
| `setup` | `Function[]` | Setup functions |
| `teardown` | `Function[]` | Teardown functions |
| `validate` | `Function[]` | Validation functions |
| `locals` | `object` | Values to set on `req.locals` |

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

### formatSse

Format a chunk as an SSE event string:

```typescript
import { formatSse } from "jaypie";

const chunk = { type: "message", content: "Hello" };
const sse = formatSse(chunk);
// "event: message\ndata: {\"type\":\"message\",\"content\":\"Hello\"}\n\n"
```

### formatNljson

Format a chunk as a newline-delimited JSON string:

```typescript
import { formatNljson } from "jaypie";

const chunk = { type: "message", content: "Hello" };
const nljson = formatNljson(chunk);
// "{\"type\":\"message\",\"content\":\"Hello\"}\n"
```

### formatStreamError

Format an error based on stream format:

```typescript
import { formatStreamError } from "jaypie";

const errorBody = { errors: [{ status: 500, title: "Error" }] };

// SSE format (default)
formatStreamError(errorBody, "sse");
// "event: error\ndata: {...}\n\n"

// NLJSON format
formatStreamError(errorBody, "nljson");
// "{\"error\":{...}}\n"
```

### getContentTypeForFormat

Get the content type for a stream format:

```typescript
import { getContentTypeForFormat } from "jaypie";

getContentTypeForFormat("sse");    // "text/event-stream"
getContentTypeForFormat("nljson"); // "application/x-ndjson"
```

### streamToSse

Convert an async iterable to SSE-formatted strings:

```typescript
import { streamToSse } from "jaypie";

for await (const event of streamToSse(dataStream)) {
  responseStream.write(event);
}
```

## CDK/Infrastructure Setup

Enable Lambda Response Streaming in CDK using `JaypieDistribution`:

```typescript
import { JaypieExpressLambda, JaypieDistribution } from "@jaypie/constructs";
import { Duration } from "aws-cdk-lib";

const streamingFunction = new JaypieExpressLambda(this, "StreamingFunction", {
  code: "dist",
  handler: "index.handler",
  timeout: Duration.minutes(5), // Streaming may need longer timeout
});

// Create distribution with streaming enabled
new JaypieDistribution(this, "Distribution", {
  handler: streamingFunction,
  streaming: true,
  host: "api.example.com",
  zone: "example.com",
});
```

### JaypieNextJs Streaming

For Next.js applications deployed with `JaypieNextJs`, streaming requires configuration in **both** the CDK construct and the Next.js application:

**1. CDK Stack:**

```typescript
import { JaypieNextJs } from "@jaypie/constructs";

new JaypieNextJs(this, "App", {
  domainName: "app.example.com",
  nextjsPath: "../nextjs",
  streaming: true,  // Enables RESPONSE_STREAM invoke mode on Function URL
});
```

**2. Next.js Application:**

Create `open-next.config.ts` at the same level as your `next.config.js`:

```typescript
// nextjs/open-next.config.ts
import type { OpenNextConfig } from "@opennextjs/aws/types/open-next.js";

const config = {
  default: {
    override: {
      wrapper: "aws-lambda-streaming",
    },
  },
} satisfies OpenNextConfig;

export default config;
```

:::warning Why Both Are Required
The `streaming: true` prop configures the Lambda Function URL with `InvokeMode: RESPONSE_STREAM`, but the Lambda handler must also be "streamified" using OpenNext's `aws-lambda-streaming` wrapper.

Without `open-next.config.ts`, the browser receives a JSON envelope `{ statusCode, headers, body }` instead of streamed HTML because the Lambda handler returns a standard response object rather than writing to the response stream.
:::

## Error Handling

Errors in streaming handlers are written to the stream in the configured format:

**SSE format (default):**
```
event: error
data: {"errors":[{"status":500,"title":"Internal Error"}]}

```

**NLJSON format:**
```json
{"error":{"errors":[{"status":500,"title":"Internal Error"}]}}
```

For `lambdaStreamHandler`, use the `throw` option to re-throw errors instead:

```typescript
export const handler = lambdaStreamHandler(fn, {
  throw: true, // Re-throw instead of streaming error
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
