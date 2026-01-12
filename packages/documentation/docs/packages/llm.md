---
sidebar_position: 5
---

# @jaypie/llm


**Prerequisites:** `npm install @jaypie/llm` and API key for provider

## Overview

`@jaypie/llm` provides a unified interface for calling Anthropic, OpenAI, Google, and OpenRouter models with consistent API patterns.

## Installation

```bash
npm install @jaypie/llm
```

## Quick Reference

### Exports

| Export | Purpose |
|--------|---------|
| `Llm` | Main LLM class (default export) |
| `Toolkit` | Tool collection for function calling |
| `LlmTool` | Tool type definition |

### Providers

| Provider | Models | Env Variable |
|----------|--------|--------------|
| `anthropic` | claude-sonnet-4, claude-opus-4, claude-haiku | `ANTHROPIC_API_KEY` |
| `openai` | gpt-4o, gpt-4o-mini, o1-mini, o3-mini | `OPENAI_API_KEY` |
| `google` | gemini-2.0-flash, gemini-1.5-pro | `GOOGLE_API_KEY` |
| `openrouter` | Various | `OPENROUTER_API_KEY` |

## Llm.operate

Static method for single prompt/response.

```typescript
import Llm from "@jaypie/llm";

const response = await Llm.operate("What is 2+2?", {
  model: "claude-sonnet-4",
});
// Returns: "4"
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `model` | `string` | Model identifier |
| `system` | `string` | System prompt |
| `temperature` | `number` | Response randomness (0-1) |
| `maxTokens` | `number` | Maximum response tokens |
| `tools` | `Toolkit` | Available tools |
| `responseFormat` | `object` | Structured output format |

## Llm.stream

Async generator for streaming responses.

```typescript
import Llm from "@jaypie/llm";

for await (const chunk of Llm.stream("Tell me a story")) {
  process.stdout.write(chunk.content || "");
}
```

## Instance Methods

For multi-turn conversations with history:

```typescript
import Llm from "@jaypie/llm";

const llm = new Llm("anthropic", {
  model: "claude-sonnet-4",
  system: "You are a helpful assistant.",
});

await llm.operate("My name is Alice.");
await llm.operate("What is my name?");
// Maintains conversation history

// Access history
console.log(llm.history);
```

## Toolkit

Collection of tools for function calling.

```typescript
import Llm, { Toolkit } from "@jaypie/llm";

const toolkit = new Toolkit([
  {
    name: "get_weather",
    description: "Get current weather for a city",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name" },
      },
      required: ["city"],
    },
    call: async ({ city }) => {
      return `Weather in ${city}: sunny, 72F`;
    },
  },
]);

const response = await Llm.operate("What's the weather in NYC?", {
  model: "claude-sonnet-4",
  tools: toolkit,
});
```

### Tool Definition

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Tool identifier |
| `description` | `string` | What the tool does |
| `parameters` | `JSONSchema \| ZodSchema` | Input schema |
| `call` | `Function` | Implementation function |

### Zod Schema

```typescript
import { z } from "zod";

const toolkit = new Toolkit([
  {
    name: "create_user",
    description: "Create a new user",
    parameters: z.object({
      name: z.string().describe("User's name"),
      email: z.string().email().describe("User's email"),
    }),
    call: async ({ name, email }) => {
      return { id: uuid(), name, email };
    },
  },
]);
```

## Structured Output

### JSON Schema

```typescript
const response = await Llm.operate(
  "Extract: 'John is 25 years old'",
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

### Zod Response Schema

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
// Returns typed object
```

## Files and Images

### Image Input

```typescript
const response = await Llm.operate("What's in this image?", {
  model: "claude-sonnet-4",
  files: [
    {
      type: "image",
      data: base64ImageData,
      mediaType: "image/png",
    },
  ],
});
```

### URL Image

```typescript
const response = await Llm.operate("Describe this", {
  model: "gpt-4o",
  files: [
    {
      type: "image",
      url: "https://example.com/image.jpg",
    },
  ],
});
```

## Hooks

Lifecycle callbacks for logging and metrics.

```typescript
const response = await Llm.operate(prompt, {
  model: "claude-sonnet-4",
  hooks: {
    beforeCall: (params) => {
      log.trace("[llm] calling");
      log.var({ model: params.model });
    },
    afterCall: (response) => {
      log.trace("[llm] complete");
      log.var({ tokens: response.usage?.totalTokens });
    },
    onError: (error) => {
      log.error("[llm] failed");
    },
  },
});
```

## Express Integration

```typescript
import { expressStreamHandler, createExpressStream } from "jaypie";
import Llm from "@jaypie/llm";

export default expressStreamHandler(async (req, res, context) => {
  const stream = createExpressStream(context);

  for await (const chunk of Llm.stream(req.body.prompt, {
    model: "claude-sonnet-4",
  })) {
    stream.write(chunk.content || "");
  }

  stream.end();
});
```

## Lambda Integration

```typescript
import { lambdaStreamHandler } from "jaypie";
import Llm from "@jaypie/llm";

export const handler = awslambda.streamifyResponse(
  lambdaStreamHandler(async (event, context) => {
    const { prompt } = JSON.parse(event.body);

    for await (const chunk of Llm.stream(prompt)) {
      context.responseStream.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
  }, {
    contentType: "text/event-stream",
  })
);
```

## Error Handling

```typescript
import { BadGatewayError, log } from "jaypie";
import Llm from "@jaypie/llm";

async function askLlm(prompt) {
  try {
    return await Llm.operate(prompt, { model: "claude-sonnet-4" });
  } catch (error) {
    log.error("[askLlm] failed");
    log.var({ error: error.message });
    throw BadGatewayError("AI service unavailable");
  }
}
```

## Related

- [LLM Integration](/docs/guides/llm-integration) - Complete guide
- [Vocabulary LLM](/docs/experimental/vocabulary) - Service handler conversion
- [@jaypie/express](/docs/packages/express) - Streaming handlers
