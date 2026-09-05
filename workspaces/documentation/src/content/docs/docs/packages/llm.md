---
title: "@jaypie/llm"
---


**Prerequisites:** `npm install @jaypie/llm` and API key for provider

## Overview

`@jaypie/llm` provides a unified interface for calling Anthropic, Fireworks, Google, Mistral, OpenAI, OpenRouter, and xAI models with consistent API patterns.

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

Models are listed as `LLM.MODEL.*` names rather than ids. The alias is stable
across releases; the id behind it moves whenever the provider ships a successor.

| Provider | Models | Env Variable |
|----------|--------|--------------|
| `anthropic` | `MODEL.SONNET`, `MODEL.OPUS`, `MODEL.HAIKU`, `MODEL.FABLE` | `ANTHROPIC_API_KEY` |
| `bedrock` | `MODEL.NOVA_PRO`, `MODEL.NOVA_LITE` | (AWS credentials) |
| `fireworks` | `MODEL.FIREWORKS.*` (`DEEPSEEK`, `GLM`, `GPT_OSS`, `INKLING`, `KIMI`, `MINIMAX`, `NEMOTRON`, `QWEN`) | `FIREWORKS_API_KEY` |
| `google` | `MODEL.GEMINI_FLASH`, `MODEL.GEMINI_FLASH_LITE`, `MODEL.GEMINI_PRO` | `GOOGLE_API_KEY` |
| `mistral` | `MODEL.MISTRAL.*` (`LARGE`, `SMALL`, `OCR`) | `MISTRAL_API_KEY` |
| `openai` | `MODEL.ASTRA`, `MODEL.SOL`, `MODEL.LUNA`, `MODEL.TERRA` | `OPENAI_API_KEY` |
| `openrouter` | `MODEL.OPENROUTER.*` (`GLM`, `LUNA`, `SONNET`) | `OPENROUTER_API_KEY` |
| `xai` | `MODEL.GROK` | `XAI_API_KEY` |

## Llm.operate

Static method for single prompt/response.

```typescript
import Llm, { LLM } from "@jaypie/llm";

const response = await Llm.operate("What is 2+2?", {
  model: LLM.MODEL.SONNET,
});
// Returns: "4"
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `fallback` | `LlmFallbackConfig[] \| false` | Fallback provider chain |
| `format` | `NaturalSchema \| JSONSchema \| ZodSchema` | Structured output schema |
| `maxTokens` | `number` | Maximum response tokens |
| `model` | `string` | Model identifier |
| `system` | `string` | System prompt |
| `temperature` | `number` | Response randomness (0-1) |
| `tools` | `Toolkit` | Available tools |

## Llm.stream

Async generator for streaming responses.

```typescript
import Llm from "@jaypie/llm";

for await (const chunk of Llm.stream("Tell me a story")) {
  process.stdout.write(chunk.content || "");
}
```

## Fallback Providers

Configure a chain of fallback providers that automatically retry failed calls when the primary provider fails.

```typescript
import Llm, { LLM } from "@jaypie/llm";

// Instance-level configuration
const llm = new Llm("anthropic", {
  model: LLM.MODEL.SONNET,
  fallback: [
    { provider: "openai", model: LLM.MODEL.SOL },
    { provider: "google", model: LLM.MODEL.GEMINI_FLASH },
  ],
});

// Per-call override
const response = await llm.operate(input, {
  fallback: [{ provider: "openai", model: LLM.MODEL.SOL }],
});

// Disable fallback for specific call
const response = await llm.operate(input, { fallback: false });

// Static method with fallback
const response = await Llm.operate(input, {
  model: LLM.MODEL.SONNET,
  fallback: [{ provider: "openai", model: LLM.MODEL.SOL }],
});
```

### Fallback Response Metadata

| Property | Type | Description |
|----------|------|-------------|
| `provider` | `string` | Which provider handled the request |
| `fallbackUsed` | `boolean` | Whether a fallback was used |
| `fallbackAttempts` | `number` | Number of providers tried |

## Instance Methods

For multi-turn conversations with history:

```typescript
import Llm, { LLM } from "@jaypie/llm";

const llm = new Llm("anthropic", {
  model: LLM.MODEL.SONNET,
  system: "You are a helpful assistant.",
});

await llm.operate("My name is Alice.");
await llm.operate("What is my name?");
// Maintains conversation history

// Access history
console.log(llm.history);
```

The first constructor argument may be a provider name **or** a model name. When a model name is passed, the provider is auto-detected and the model is retained:

```typescript
import Llm, { LLM } from "@jaypie/llm";

const llm = new Llm("claude-sonnet-4-6");      // -> anthropic, retained verbatim
const flash = new Llm(LLM.MODEL.GEMINI_FLASH); // -> google, whatever the alias names
```

## Toolkit

Collection of tools for function calling.

```typescript
import Llm, { LLM, Toolkit } from "@jaypie/llm";

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
  model: LLM.MODEL.SONNET,
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
| `readOnly` | `boolean` | Declares the tool free of side effects |

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

### Read-Only Tools

Tools may declare `readOnly: true` (mirroring MCP's `readOnlyHint`) to state they carry no side effects. `filter` derives a new Toolkit from the annotation, so a verification or critique pass can check facts without repeating side effects.

```typescript
const toolkit = new Toolkit([
  { name: "search_docs", readOnly: true, /* ... */ },
  { name: "post_message", /* ... */ },
]);

const verification = toolkit.filter({ readOnly: true }); // search_docs only
const effectful = toolkit.filter({ readOnly: false });   // post_message only
const custom = toolkit.filter((tool) => tool.name.startsWith("search_"));
```

- Tools are side-effecting unless annotated, so new tools stay excluded from the read set by default
- The derived Toolkit shares the same tool implementations and inherits `explain` and `log`; extending either toolkit leaves the other unchanged
- `readOnly` never reaches the provider payload
- The built-in tools (`random`, `roll`, `time`, `weather`) are annotated read-only
- `fabricService({ readOnly: true })` propagates through `fabricTool` to the tool

### Explain Mode

Explain mode adds transparency to tool calling by requiring the LLM to state its reasoning when invoking tools.

```typescript
// Enable via Toolkit constructor
const toolkit = new Toolkit([myTool], { explain: true });

// Or via operate options
const response = await Llm.operate("What's the weather?", {
  model: LLM.MODEL.SOL,
  tools: myTools,
  explain: true,
});
```

When enabled:
- Each tool receives an `__Explanation` parameter requiring the model to state why it's calling the tool
- The explanation is stripped before the tool executes (tools receive clean arguments)
- Useful for debugging and understanding LLM decision-making

## Structured Output

Pass `format` to receive guaranteed-valid JSON. `format` accepts Jaypie's natural schema syntax (preferred), a raw JSON Schema, or a Zod schema. (`provider.send` uses `response` for the same purpose.)

### Natural Schema

```typescript
const response = await Llm.operate(
  "Extract: 'John is 25 years old'",
  {
    model: LLM.MODEL.SOL,
    format: {
      name: String,
      age: Number,
    },
  }
);
// Returns: { name: "John", age: 25 }
```

Declared array fields are always present in the response as arrays — an empty result surfaces as `[]`, never `undefined`.

### JSON Schema

Both the OpenAI-style `{ type: "json_schema", ... }` envelope and a bare `{ type: "object", properties: {...} }` node are accepted; `required` is honored.

```typescript
const response = await Llm.operate(prompt, {
  model: LLM.MODEL.SOL,
  format: {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name"],
  },
});
// Returns: { name: "John", age: 25 }
```

Convert between Natural Schema and JSON Schema directly with `naturalSchemaToJsonSchema` (lossless) and `jsonSchemaToNaturalSchema` (lossy — constraints, descriptions, defaults, unions, and optionality have no Natural Schema equivalent and are dropped with a `log.debug` per keyword, never thrown):

```typescript
import { naturalSchemaToJsonSchema, jsonSchemaToNaturalSchema } from "@jaypie/llm";

naturalSchemaToJsonSchema({ name: String, age: Number });
// { type: "object", properties: { name: { type: "string" }, age: { type: "number" } }, required: ["name", "age"] }
```

### Zod Schema

```typescript
import { z } from "zod";

const PersonSchema = z.object({
  name: z.string(),
  age: z.number(),
});

const response = await Llm.operate(prompt, {
  model: LLM.MODEL.SOL,
  format: PersonSchema,
});
// Returns typed object
```

## Files and Images

### Image Input

```typescript
const response = await Llm.operate("What's in this image?", {
  model: LLM.MODEL.SONNET,
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
  model: LLM.MODEL.SOL,
  files: [
    {
      type: "image",
      url: "https://example.com/image.jpg",
    },
  ],
});
```

## Hooks

Lifecycle callbacks with full provider request/response payloads.

```typescript
const response = await Llm.operate(prompt, {
  model: LLM.MODEL.SONNET,
  hooks: {
    beforeEachModelRequest: ({ providerRequest }) => {
      log.trace("[llm] calling model");
    },
    afterEachModelResponse: ({ content, usage }) => {
      log.trace("[llm] response received");
      log.var({ tokens: usage[usage.length - 1]?.total });
    },
    beforeEachTool: ({ toolName, args, message }) => {
      // message is the tool's resolved LlmTool.message, when defined
      log.trace(message ?? `[llm] calling ${toolName}`);
    },
    afterEachTool: ({ result, toolName, message }) => {
      log.trace(`[llm] ${toolName} returned`);
    },
    onToolError: ({ error, toolName, message }) => {
      log.warn(`[llm] ${toolName} failed`);
      log.var({ error: error.message });
    },
    onRetryableModelError: ({ error }) => {
      log.warn("[llm] model call failed, retrying");
    },
    onUnrecoverableModelError: ({ error }) => {
      log.error("[llm] model call failed");
      log.var({ error });
    },
  },
});
```

## Progress Events

For progress reporting (UI updates, websockets, queue notifications), prefer a single `onProgress` callback over wiring individual hooks. It receives lightweight, serializable events as the operate loop runs:

```typescript
const response = await Llm.operate(prompt, {
  model: LLM.MODEL.SONNET,
  tools: toolkit,
  onProgress: (event) => {
    // event.type: start, model_request, model_response,
    //             tool_call, tool_result, tool_error, retry, done
    websocket.send(JSON.stringify(event));
  },
});
```

Fields carried by each event (`turn` is 1-indexed):

| Event | Fields |
|-------|--------|
| `start` | `model`, `provider`, `maxTurns` |
| `model_request` | `turn`, `model` |
| `model_response` | `turn`, `content` (text, if any), `toolCalls` (`[{ name, arguments }]`, if any), `usage` (this turn) |
| `tool_call` | `turn`, `tool: { name, arguments, message }` — fires before the tool runs; `arguments` is the JSON string; `message` is the resolved `LlmTool.message`, when the tool defines one |
| `tool_result` | `turn`, `tool: { name }` — the result value is deliberately omitted (it can be arbitrarily large); use the `afterEachTool` hook to receive it |
| `tool_error` | `turn`, `tool: { name }`, `error` (message string) |
| `retry` | `turn`, `error` (message string) |
| `done` | `turn` (total turns used), `content` (final text or structured output), `usage` (cumulative) |

Errors thrown by the callback are logged and never interrupt the loop. `stream()` communicates progress through its chunks; `onProgress` applies to `operate()`.

## Express Integration

```typescript
import { expressStreamHandler, createExpressStream } from "jaypie";
import Llm, { LLM } from "@jaypie/llm";

export default expressStreamHandler(async (req, res, context) => {
  const stream = createExpressStream(context);

  for await (const chunk of Llm.stream(req.body.prompt, {
    model: LLM.MODEL.SONNET,
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

## Report Totals

Inside a Jaypie handler, `operate()` and `stream()` tally totals onto the logger's report session automatically. The report emitted at teardown includes an `llm` key with no code changes:

```json
{
  "llm": {
    "operates": 2,
    "toolCalls": 3,
    "tools": { "get_weather": 2, "roll": 1 },
    "turns": 5,
    "usage": {
      "anthropic:claude-sonnet-4-6": { "input": 1840, "output": 912, "reasoning": 0, "total": 2752 }
    }
  }
}
```

Repeated calls in one request combine (numbers sum). `usage` is keyed `provider:model`, so fallback providers appear as separate keys. Outside a handler session the tally is a silent no-op.

## Error Handling

```typescript
import { BadGatewayError, log } from "jaypie";
import Llm, { LLM } from "@jaypie/llm";

async function askLlm(prompt) {
  try {
    return await Llm.operate(prompt, { model: LLM.MODEL.SONNET });
  } catch (error) {
    log.error("[askLlm] failed");
    log.var({ error: error.message });
    throw BadGatewayError("AI service unavailable");
  }
}
```

### Loop Stops

The loop settles `status: "incomplete"` with an error of its own when a policy budget runs out. Those errors carry `error.reason` (`LlmResponseErrorReason`) because status alone cannot identify them: an exhausted turn budget is a 429, exactly like a provider rate limit.

| `reason` | Status | Meaning |
|----------|--------|---------|
| `max_turns` | 429 | The model asked for another tool call after `turns` ran out. Nothing failed; the run did not converge. |
| `tool_errors` | 502 | Tool execution failed six times in a row and the loop stopped. |

```typescript
import { LlmResponseErrorReason } from "@jaypie/llm";

const response = await Llm.operate(input, { tools: toolkit, turns: 12 });
if (response.error?.reason === LlmResponseErrorReason.MaxTurns) {
  // Retry with a larger budget rather than reporting a capability failure
}
```

## Related

- [LLM Integration](/docs/guides/llm-integration/) - Complete guide
- [Fabric](/docs/experimental/fabric/) - Service handler conversion
- [@jaypie/express](/docs/packages/express/) - Streaming handlers
