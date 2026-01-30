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

### JaypieDistribution

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

### JaypieNextJs Streaming

For Next.js applications with `JaypieNextJs`, streaming requires **two** configurations:

1. **CDK** - Set `streaming: true` in the construct
2. **Next.js App** - Create `open-next.config.ts` with the streaming wrapper

```typescript
// CDK Stack
import { JaypieNextJs } from "@jaypie/constructs";

new JaypieNextJs(this, "App", {
  nextjsPath: "../nextjs",
  streaming: true,
});
```

```typescript
// nextjs/open-next.config.ts (required for streaming)
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

**Important:** Without `open-next.config.ts`, the Lambda returns a JSON envelope `{ statusCode, headers, body }` instead of streaming HTML. This is because `cdk-nextjs-standalone` configures the Lambda Function URL with `RESPONSE_STREAM` invoke mode, but OpenNext also needs to be configured to use the streaming wrapper.

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
