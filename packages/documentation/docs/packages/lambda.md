---
sidebar_position: 3
---

# @jaypie/lambda

**Use this page when:** building AWS Lambda functions with Jaypie patterns, or processing SQS/SNS events.

**Prerequisites:** `npm install jaypie` or `npm install @jaypie/lambda`

## Overview

`@jaypie/lambda` provides Lambda handler wrappers with lifecycle management, event parsing, and automatic error handling.

## Installation

```bash
npm install jaypie
# or
npm install @jaypie/lambda
```

## Quick Reference

### Exports

| Export | Purpose |
|--------|---------|
| `lambdaHandler` | Standard Lambda handler wrapper |
| `lambdaStreamHandler` | Response streaming handler wrapper |

### Event Helpers (from jaypie)

| Export | Purpose |
|--------|---------|
| `getMessages` | Parse SQS/SNS events into message bodies |
| `getSingletonMessage` | Get exactly one message or throw |

## lambdaHandler

### Basic Usage

```typescript
import { lambdaHandler } from "jaypie";

export const handler = lambdaHandler(async (event, context) => {
  return { processed: true };
});
```

### With Options

```typescript
import { lambdaHandler, log } from "jaypie";

export const handler = lambdaHandler(
  async (event, context) => {
    log.trace("[process] handling event");
    return { success: true };
  },
  {
    name: "processEvent",
    secrets: ["API_KEY", "MONGODB_URI"],
    validate: [(event) => event.Records?.length > 0],
    setup: [async () => await initializeResources()],
    teardown: [async () => await cleanupResources()],
  }
);
```

### Options Reference

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Handler name for logging |
| `secrets` | `string[]` | Secrets to load from AWS Secrets Manager |
| `validate` | `Function[]` | Validation functions |
| `setup` | `Function[]` | Setup functions |
| `teardown` | `Function[]` | Teardown functions (always run) |

## Processing SQS Events

### Multiple Messages

```typescript
import { lambdaHandler, getMessages, log } from "jaypie";

export const handler = lambdaHandler(
  async (event) => {
    const messages = getMessages(event);

    for (const message of messages) {
      log.trace("[process] handling message");
      log.var({ messageId: message.id });
      await processMessage(message);
    }

    return { processed: messages.length };
  },
  {
    name: "queueProcessor",
  }
);
```

### Single Message (Throw if Multiple)

```typescript
import { lambdaHandler, getSingletonMessage } from "jaypie";

export const handler = lambdaHandler(async (event) => {
  // Throws BadGatewayError if not exactly one message
  const message = getSingletonMessage(event);
  return await processMessage(message);
});
```

### Message Parsing

`getMessages` automatically parses:

| Event Type | Parsing |
|------------|---------|
| SQS | Parses `Records[].body` as JSON |
| SNS | Parses `Records[].Sns.Message` as JSON |
| Direct | Returns event as single-item array |

## lambdaStreamHandler

For AWS Lambda Response Streaming:

```typescript
import { lambdaStreamHandler } from "jaypie";

export const handler = awslambda.streamifyResponse(
  lambdaStreamHandler(
    async (event, context) => {
      context.responseStream.write("Starting...\n");

      for (const item of items) {
        await processItem(item);
        context.responseStream.write(`Done: ${item.id}\n`);
      }
    },
    {
      contentType: "text/plain",
    }
  )
);
```

### SSE Streaming

```typescript
export const handler = awslambda.streamifyResponse(
  lambdaStreamHandler(
    async (event, context) => {
      context.responseStream.write("event: start\ndata: {}\n\n");

      for await (const data of dataStream) {
        const sse = `event: data\ndata: ${JSON.stringify(data)}\n\n`;
        context.responseStream.write(sse);
      }

      context.responseStream.write("event: end\ndata: {}\n\n");
    },
    {
      contentType: "text/event-stream",
    }
  )
);
```

### With LLM Streaming

```typescript
import { lambdaStreamHandler } from "jaypie";
import Llm from "@jaypie/llm";

export const handler = awslambda.streamifyResponse(
  lambdaStreamHandler(
    async (event, context) => {
      const { prompt } = JSON.parse(event.body);

      for await (const chunk of Llm.stream(prompt)) {
        const content = chunk.content || "";
        context.responseStream.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    },
    {
      contentType: "text/event-stream",
    }
  )
);
```

## S3 Event Processing

```typescript
import { lambdaHandler, log } from "jaypie";

export const handler = lambdaHandler(async (event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key);

    log.trace("[process] processing S3 object");
    log.var({ bucket });
    log.var({ key });

    await processS3Object(bucket, key);
  }
});
```

## Error Handling

Errors are logged and re-thrown (Lambda handles retry):

```typescript
import { lambdaHandler, BadGatewayError, log } from "jaypie";

export const handler = lambdaHandler(async (event) => {
  try {
    return await externalService.call(event);
  } catch (error) {
    log.error("External service failed");
    log.var({ error: error.message });
    throw BadGatewayError();
  }
});
```

## Testing

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("jaypie", async () => {
  const testkit = await import("@jaypie/testkit/mock");
  return testkit;
});

import { handler } from "./index.js";

describe("Lambda Handler", () => {
  it("processes SQS event", async () => {
    const event = {
      Records: [
        { body: JSON.stringify({ id: "123" }) },
      ],
    };

    const result = await handler(event, {});

    expect(result).toEqual({ processed: 1 });
  });

  it("handles empty event", async () => {
    const event = { Records: [] };
    const result = await handler(event, {});
    expect(result).toEqual({ processed: 0 });
  });
});
```

## Build Configuration

For Lambda deployment with Rollup/Vite:

```typescript
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: [
        /^@aws-sdk/,
        /^jaypie/,
        /^@jaypie/,
      ],
    },
    outDir: "dist",
  },
});
```

## Related

- [Handler Lifecycle](/docs/core/handler-lifecycle) - Lifecycle phases
- [Error Handling](/docs/core/error-handling) - Error types
- [CDK Infrastructure](/docs/guides/cdk-infrastructure) - Lambda deployment
- [Testing](/docs/guides/testing) - Testing handlers
