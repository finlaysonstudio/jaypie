---
sidebar_position: 4
---

# LLM Integration

**Use this page when:** integrating large language models into Jaypie applications, creating tools for LLM function calling, or streaming LLM responses.

**Prerequisites:**
- `npm install @jaypie/llm`
- API key for at least one provider (Anthropic, OpenAI, Google, or OpenRouter)

## Overview

`@jaypie/llm` provides a unified interface for calling multiple LLM providers.
The `Llm` class handles provider-specific implementations while exposing a consistent API for operate, stream, and tool calling.

## Quick Reference

### Supported Providers

| Provider | Models | Env Variable |
|----------|--------|--------------|
| Anthropic | claude-sonnet-4, claude-opus-4, claude-haiku | `ANTHROPIC_API_KEY` |
| OpenAI | gpt-4o, gpt-4o-mini, o1-mini, o3-mini | `OPENAI_API_KEY` |
| Google | gemini-2.0-flash, gemini-1.5-pro | `GOOGLE_API_KEY` |
| OpenRouter | Any supported model | `OPENROUTER_API_KEY` |

### Core Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `Llm.operate()` | Single prompt/response | string |
| `Llm.stream()` | Streaming response | AsyncGenerator |
| `llm.operate()` | Instance method with history | string |

## Basic Usage

### Static Method (Recommended for single calls)

```typescript
import Llm from "@jaypie/llm";

// Provider auto-detected from model
const response = await Llm.operate("What is 2+2?", {
  model: "claude-sonnet-4",
});
console.log(response); // "4"
```

### Instance Method (For conversations)

```typescript
import Llm from "@jaypie/llm";

const llm = new Llm("anthropic", {
  model: "claude-sonnet-4",
  system: "You are a helpful assistant.",
});

const response1 = await llm.operate("My name is Alice.");
const response2 = await llm.operate("What is my name?");
// Maintains conversation history
```

## Model Selection

### By Model Name

```typescript
// Anthropic models
await Llm.operate(prompt, { model: "claude-sonnet-4" });
await Llm.operate(prompt, { model: "claude-opus-4" });
await Llm.operate(prompt, { model: "claude-haiku" });

// OpenAI models
await Llm.operate(prompt, { model: "gpt-4o" });
await Llm.operate(prompt, { model: "gpt-4o-mini" });

// Google models
await Llm.operate(prompt, { model: "gemini-2.0-flash" });
```

### Explicit Provider

```typescript
const llm = new Llm("openai", {
  model: "gpt-4o",
});
```

## Streaming

### Basic Streaming

```typescript
for await (const chunk of Llm.stream("Tell me a story")) {
  process.stdout.write(chunk.content || "");
}
```

### Express SSE Streaming

```typescript
import { expressStreamHandler, createExpressStream } from "jaypie";
import Llm from "@jaypie/llm";

export default expressStreamHandler(async (req, res, context) => {
  const stream = createExpressStream(context);

  for await (const chunk of Llm.stream(req.body.prompt)) {
    stream.write(chunk.content || "");
  }

  stream.end();
});
```

### Lambda Response Streaming

```typescript
import { lambdaStreamHandler } from "jaypie";
import Llm from "@jaypie/llm";

export const handler = awslambda.streamifyResponse(
  lambdaStreamHandler(async (event, context) => {
    for await (const chunk of Llm.stream(event.prompt)) {
      context.responseStream.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
  }, {
    contentType: "text/event-stream",
  })
);
```

## Tool Calling

### Creating Tools

```typescript
import Llm, { Toolkit } from "@jaypie/llm";

const toolkit = new Toolkit([
  {
    name: "get_weather",
    description: "Get current weather for a city",
    parameters: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "City name",
        },
      },
      required: ["city"],
    },
    call: async ({ city }) => {
      // Actual implementation
      return `Weather in ${city}: sunny, 72F`;
    },
  },
]);

const response = await Llm.operate("What's the weather in NYC?", {
  model: "claude-sonnet-4",
  tools: toolkit,
});
```

### Zod Schema Tools

```typescript
import { z } from "zod";
import Llm, { Toolkit } from "@jaypie/llm";

const toolkit = new Toolkit([
  {
    name: "create_user",
    description: "Create a new user",
    parameters: z.object({
      name: z.string().describe("User's full name"),
      email: z.string().email().describe("User's email"),
      age: z.number().optional().describe("User's age"),
    }),
    call: async ({ name, email, age }) => {
      const user = await db.users.create({ name, email, age });
      return { id: user.id, name, email };
    },
  },
]);
```

### Tool with Validation

```typescript
{
  name: "transfer_money",
  description: "Transfer money between accounts",
  parameters: {
    type: "object",
    properties: {
      from: { type: "string" },
      to: { type: "string" },
      amount: { type: "number" },
    },
    required: ["from", "to", "amount"],
  },
  call: async ({ from, to, amount }) => {
    if (amount <= 0) {
      throw BadRequestError("Amount must be positive");
    }
    // Process transfer
    return { success: true, transactionId: uuid() };
  },
}
```

## Structured Output

### JSON Response

```typescript
const response = await Llm.operate(
  "Extract the person's name and age from: 'John is 25 years old'",
  {
    model: "gpt-4o",
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "person",
        schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            age: { type: "number" },
          },
        },
      },
    },
  }
);
// Returns: { name: "John", age: 25 }
```

### Zod Schema Response

```typescript
import { z } from "zod";

const PersonSchema = z.object({
  name: z.string(),
  age: z.number(),
});

const response = await Llm.operate(prompt, {
  model: "gpt-4o",
  responseSchema: PersonSchema,
});
// Returns typed object matching PersonSchema
```

## Multi-Turn Conversations

```typescript
const llm = new Llm("anthropic", {
  model: "claude-sonnet-4",
  system: "You are a math tutor.",
});

// Conversation history maintained automatically
await llm.operate("What is calculus?");
await llm.operate("Can you give me an example?");
await llm.operate("How is that used in physics?");

// Access history
console.log(llm.history);
```

## Files and Images

### Image Input

```typescript
const response = await Llm.operate(
  "What's in this image?",
  {
    model: "claude-sonnet-4",
    files: [
      {
        type: "image",
        data: base64ImageData,
        mediaType: "image/png",
      },
    ],
  }
);
```

### URL Image

```typescript
const response = await Llm.operate(
  "Describe this image",
  {
    model: "gpt-4o",
    files: [
      {
        type: "image",
        url: "https://example.com/image.jpg",
      },
    ],
  }
);
```

## Hooks

### Lifecycle Hooks

```typescript
const response = await Llm.operate(prompt, {
  model: "claude-sonnet-4",
  hooks: {
    beforeCall: (params) => {
      log.trace("[llm] calling model");
      log.var({ model: params.model });
    },
    afterCall: (response) => {
      log.trace("[llm] response received");
      log.var({ tokens: response.usage?.totalTokens });
    },
    onError: (error) => {
      log.error("[llm] call failed");
      log.var({ error: error.message });
    },
  },
});
```

## Error Handling

```typescript
import { BadGatewayError, log } from "jaypie";
import Llm from "@jaypie/llm";

async function askLlm(prompt) {
  try {
    return await Llm.operate(prompt, { model: "claude-sonnet-4" });
  } catch (error) {
    log.error("[askLlm] LLM call failed");
    log.var({ error: error.message });
    throw BadGatewayError("AI service unavailable");
  }
}
```

## Provider-Specific Options

### Anthropic

```typescript
await Llm.operate(prompt, {
  model: "claude-sonnet-4",
  maxTokens: 4096,
  temperature: 0.7,
});
```

### OpenAI

```typescript
await Llm.operate(prompt, {
  model: "gpt-4o",
  temperature: 0.5,
  topP: 0.9,
});
```

## Related

- [Express on Lambda](/docs/guides/express-lambda) - Building APIs with LLM
- [Handler Lifecycle](/docs/core/handler-lifecycle) - Integrating LLM in handlers
- [@jaypie/llm](/docs/packages/llm) - Full API reference
- [Vocabulary LLM](/docs/experimental/vocabulary) - Service handler to LLM tool conversion
