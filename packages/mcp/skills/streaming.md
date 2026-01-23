---
description: Response streaming for Lambda and Express with SSE and NLJSON formats
related: lambda, express, handlers, llm
---

# Streaming

Jaypie provides response streaming for real-time data delivery. Three handler patterns support different deployment scenarios.

## Quick Reference

| Handler | Package | Use Case |
|---------|---------|----------|
| `lambdaStreamHandler` | `@jaypie/lambda` | Pure Lambda Function URL streaming |
| `expressStreamHandler` | `@jaypie/express` | Express routes with SSE |
| `createLambdaStreamHandler` | `@jaypie/express` | Express app on Lambda with streaming |

## Stream Formats

| Format | Content-Type | Use Case |
|--------|--------------|----------|
| `sse` (default) | `text/event-stream` | Browser EventSource, real-time UI |
| `nljson` | `application/x-ndjson` | Machine-to-machine, log processing |

## Lambda Streaming

```typescript
import { lambdaStreamHandler } from "jaypie";

export const handler = lambdaStreamHandler(async (event, context) => {
  const { responseStream } = context;

  responseStream.write("event: start\ndata: {}\n\n");
  responseStream.write("event: data\ndata: {\"count\": 1}\n\n");
  responseStream.write("event: done\ndata: {}\n\n");
}, {
  name: "streamWorker",
  format: "sse",  // or "nljson"
  secrets: ["API_KEY"],
});
```

## Express Streaming

```typescript
import { expressStreamHandler } from "jaypie";

app.get("/stream", expressStreamHandler(async (req, res) => {
  res.write("event: message\ndata: {\"text\": \"Hello\"}\n\n");
}));
```

## LLM Streaming

```typescript
import { lambdaStreamHandler, createLambdaStream, Llm } from "jaypie";

export const handler = lambdaStreamHandler(async (event, context) => {
  const llm = new Llm("anthropic");
  const stream = llm.stream(event.prompt);
  await createLambdaStream(stream, context.responseStream);
}, {
  secrets: ["ANTHROPIC_API_KEY"],
});
```

## Streaming Utilities

| Function | Purpose |
|----------|---------|
| `createLambdaStream(stream, writer)` | Pipe async iterable to Lambda |
| `createExpressStream(stream, res)` | Pipe async iterable to Express |
| `createJaypieStream(source)` | Wrapper with `.toLambda()` / `.toExpress()` |
| `formatSse(chunk)` | Format chunk as SSE string |
| `formatNljson(chunk)` | Format chunk as NLJSON string |

## CDK Configuration

```typescript
import { JaypieLambda, JaypieDistribution } from "@jaypie/constructs";

const streamingLambda = new JaypieLambda(this, "Stream", {
  entry: "src/stream.ts",
});

new JaypieDistribution(this, "Api", {
  handler: streamingLambda,
  streaming: true,  // Enables RESPONSE_STREAM invoke mode
  host: "api.example.com",
});
```

## Error Handling

Errors are written to the stream in the configured format:

**SSE:**
```
event: error
data: {"errors":[{"status":500,"title":"Internal Error"}]}
```

**NLJSON:**
```json
{"error":{"errors":[{"status":500,"title":"Internal Error"}]}}
```

Use `throw: true` option to re-throw instead of streaming errors.

## Types

```typescript
import type {
  LambdaStreamHandlerOptions,
  ExpressStreamHandlerOptions,
  ResponseStream,
  StreamFormat,
  StreamHandlerContext,
} from "jaypie";
```
