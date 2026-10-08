---
title: "@jaypie/llm"
---

**Prerequisites:** `npm install @jaypie/llm` and API key for provider

## Overview

`@jaypie/llm` provides a unified interface for calling Anthropic, Fireworks, Google, Meta, Mistral, OpenAI, OpenRouter, and xAI models with consistent API patterns.

## Installation

```bash
npm install @jaypie/llm
```

## Quick Reference

### Exports

| Export      | Purpose                                                                 |
| ----------- | ----------------------------------------------------------------------- |
| `Llm`       | Main LLM class (default export): `operate`, `stream`, `ocr`, `question` |
| `Toolkit`   | Tool collection for function calling                                    |
| `LlmTool`   | Tool type definition                                                    |
| `LLM`       | Constants: `MODEL`, `PROVIDER`, `COST`, `PAGE_COST`                     |
| `tokenCost` | USD for `response.usage` from `LLM.COST`                                |

### Providers

Models are listed as `LLM.MODEL.*` names rather than ids. The alias is stable
across releases; the id behind it moves whenever the provider ships a successor.

| Provider     | Models                                                                                                                              | Env Variable                        |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `anthropic`  | `MODEL.SONNET`, `MODEL.OPUS`, `MODEL.HAIKU`, `MODEL.FABLE`                                                                          | `ANTHROPIC_API_KEY`                 |
| `bedrock`    | `MODEL.NOVA_PRO`, `MODEL.NOVA_LITE`                                                                                                 | (AWS credentials)                   |
| `fireworks`  | `MODEL.FIREWORKS.*` (`DEEPSEEK`, `DEEPSEEK_FLASH`, `GLM`, `GLM_FLASH`, `GPT_OSS`, `INKLING`, `KIMI`, `MINIMAX`, `NEMOTRON`, `QWEN`) | `FIREWORKS_API_KEY`                 |
| `google`     | `MODEL.GEMINI_FLASH`, `MODEL.GEMINI_FLASH_LITE`, `MODEL.GEMINI_PRO`                                                                 | `GOOGLE_API_KEY`                    |
| `meta`       | `MODEL.MUSE_SPARK`, `MODEL.MUSE_SPARK_CONTRIBUTOR`                                                                                  | `META_API_KEY` (or `MODEL_API_KEY`) |
| `mistral`    | `MODEL.MISTRAL.*` (`LARGE`, `SMALL`, `OCR`)                                                                                         | `MISTRAL_API_KEY`                   |
| `openai`     | `MODEL.ASTRA`, `MODEL.SOL`, `MODEL.LUNA`, `MODEL.TERRA`                                                                             | `OPENAI_API_KEY`                    |
| `openrouter` | `MODEL.OPENROUTER.*` (`GLM`, `LUNA`, `SONNET`)                                                                                      | `OPENROUTER_API_KEY`                |
| `xai`        | `MODEL.GROK`                                                                                                                        | `XAI_API_KEY`                       |

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

| Option        | Type                                       | Description                                                                   |
| ------------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| `cache`       | `boolean \| 0 \| "5m" \| "1h"`             | Prompt caching; on by default at `"1h"`                                       |
| `fallback`    | `LlmFallbackConfig[] \| false`             | Fallback provider chain                                                       |
| `format`      | `NaturalSchema \| JSONSchema \| ZodSchema` | Structured output schema                                                      |
| `incomplete`  | `"return" \| "throw"`                      | A cut-off answer returns the partial (default) or throws `LlmIncompleteError` |
| `maxTokens`   | `number`                                   | Maximum response tokens                                                       |
| `model`       | `string`                                   | Model identifier                                                              |
| `system`      | `string`                                   | System prompt                                                                 |
| `temperature` | `number`                                   | Response randomness (0-1)                                                     |
| `timeout`     | `number \| false`                          | Per-attempt deadline in ms; idle timeout for `stream`                         |
| `tools`       | `Toolkit`                                  | Available tools                                                               |

## Llm.stream

Async generator for streaming responses.

```typescript
import Llm from "@jaypie/llm";

for await (const chunk of Llm.stream("Tell me a story")) {
  process.stdout.write(chunk.content || "");
}
```

## Llm.ocr

Turns a document into per-page markdown. Mistral OCR (`MODEL.MISTRAL.OCR`, the default) and LlamaParse (`MODEL.LLAMAPARSE.*`, `LLAMA_CLOUD_API_KEY`) answer natively; any other model answers through emulation. A `model` array is a fallback chain.

```typescript
import Llm, { LLM } from "@jaypie/llm";

const { content, markdown, pages, usage } = await Llm.ocr(
  "./scans/intake.pdf",
  {
    format: {
      category: ["deed", "invoice", "medical intake", "other"],
      description: String,
    },
    instructions: "Classify the document and describe it in one sentence.",
    model: [LLM.MODEL.MISTRAL.OCR, LLM.MODEL.HAIKU],
  },
);
content.category; // "medical intake"
```

`instructions` and `format` put the answer on `content`. Mistral answers in the same call; past its 8-page annotation limit, and on emulated engines, one text-only `operate()` over the markdown answers instead. LlamaParse does not support either option and fails over.

Mistral markdown is self-contained: tables are inlined, every image is described in its alt text (and on `images[].description` and `.type`), and typed blocks render, so a signature reads `[Signature: Jane Q Doe]`. Annotation bills at `LLM.PAGE_COST_ANNOTATED`; pass `providerOptions.bbox_annotation_format: null` to disable it.

## Fallback Providers

Configure a chain of fallback providers. Any error (rate limit, 5xx, network flake, bad request) moves to the next entry at once, with no retry or wait. When every entry has failed, the primary runs once more with its full retry policy; if that fails, the call throws. A caller abort (`LlmAbortError`) never falls over. `operate`, `ocr`, and `question` share this behavior.

In `operate`, a response the provider cut short (an output token ceiling, a content filter) also moves to the next entry. When no entry finishes, the latest incomplete response is returned, or `LlmIncompleteError` is thrown with `incomplete: "throw"`. Jaypie 2 will default to `"throw"`. An incomplete `content` is the raw partial string even when `format` was requested; check `status` before reading it as the formatted object. A `format` request answered with no content fails over the same way, and throws `LlmIncompleteError` when every entry comes back empty.

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

### Model Options in a Chain

`modelOptions` sets provider-specific request fields per model, and every attempt (primary, fallback, linger pass) resolves it against its own model. Keys match as in effort maps: exact model id, `MODEL` catalog key, provider (or the alias `gemini`), `default`. Every matching key merges, least to most specific; objects merge deeply, arrays and scalars replace. First-class `effort`, `temperature`, and `format` still win.

```typescript
const response = await llm.operate(input, {
  model: LLM.MODEL.SOL,
  fallback: [{ provider: "google", model: LLM.MODEL.GEMINI_FLASH }],
  effort: { gemini_flash: "low", default: "medium" },
  modelOptions: {
    openai: { reasoning: { summary: "detailed" } },
    gemini_flash: { thinkingConfig: { includeThoughts: true } },
  },
});
```

`resolveModelOptions({ model, modelOptions })` returns the merged options for one model and the keys that matched. The exchange records the options each attempt sent.

`providerOptions` is deprecated and removed in 2.0. It reaches the primary only, a fallback receives its own entry's `providerOptions`, and both are ignored when `modelOptions` is set.

### Effort in a Chain

`effort` accepts a per-model map so each attempt (primary, fallback, linger pass) runs at its own level. The first match wins: exact model id, a `MODEL` catalog key whose value is exactly the model (`sol`, `gemini_flash`), the provider (`openai`, `anthropic`, `google`, or the alias `gemini`), then `default`. No match leaves the provider default. An entry's own `effort` replaces the call's.

```typescript
const response = await llm.operate(input, {
  model: LLM.MODEL.GEMINI_FLASH,
  fallback: [
    { provider: "openai", model: LLM.MODEL.SOL },
    { provider: "anthropic", model: LLM.MODEL.OPUS, effort: "highest" },
  ],
  effort: { gemini: "low", sol: "medium", default: "high" },
});
```

`resolveEffort({ model, effort })` returns the resolved level and the native request fragment the provider would receive, e.g. `{ thinkingConfig: { thinkingLevel: "LOW" } }`, or no `native` when the model has no reasoning control.

### Attempt Timeout

`timeout` sets a per-attempt deadline in milliseconds. Without it, a provider that accepts the connection but never answers holds the chain until the runtime gives up (undici waits 300 s for response headers). A stalled attempt is aborted and throws `LlmTimeoutError` (a `LlmTransientError`, status 504). Down a chain it moves to the next entry at once; on a single model or the linger pass it retries with the same deadline. An entry's own `timeout` replaces the call's. No default applies. `stream()` treats it as an idle timeout, restarted by every chunk.

```typescript
const response = await llm.operate(input, {
  fallback: [
    { provider: "openai", model: LLM.MODEL.SOL },
    { provider: "anthropic", model: LLM.MODEL.OPUS, timeout: 180_000 },
  ],
  timeout: 60_000,
});
```

### Fallback Response Metadata

| Property           | Type            | Description                                                                                                     |
| ------------------ | --------------- | --------------------------------------------------------------------------------------------------------------- |
| `provider`         | `string`        | Which provider handled the request                                                                              |
| `fallbackUsed`     | `boolean`       | Whether a fallback was used                                                                                     |
| `fallbackAttempts` | `number`        | Number of providers tried                                                                                       |
| `stopReason`       | `LlmStopReason` | Why the final model call stopped: `end_turn`, `max_tokens`, `content_filter`, `refusal`, `tool_use`, or `other` |

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

const llm = new Llm("claude-sonnet-4-6"); // -> anthropic, retained verbatim
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

| Property      | Type                      | Description                            |
| ------------- | ------------------------- | -------------------------------------- |
| `name`        | `string`                  | Tool identifier                        |
| `description` | `string`                  | What the tool does                     |
| `parameters`  | `JSONSchema \| ZodSchema` | Input schema                           |
| `call`        | `Function`                | Implementation function                |
| `readOnly`    | `boolean`                 | Declares the tool free of side effects |

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

Google converts tool parameters to Gemini's OpenAPI 3.0 subset, stripping `$schema`, `$defs`, `$ref`, `additionalProperties`, and `const` at every depth. Literal and `$ref` constraints do not reach Gemini; spell them out in `description` or `enum` when they matter.

### Read-Only Tools

Tools may declare `readOnly: true` (mirroring MCP's `readOnlyHint`) to state they carry no side effects. `filter` derives a new Toolkit from the annotation, so a verification or critique pass can check facts without repeating side effects.

```typescript
const toolkit = new Toolkit([
  { name: "search_docs", readOnly: true /* ... */ },
  { name: "post_message" /* ... */ },
]);

const verification = toolkit.filter({ readOnly: true }); // search_docs only
const effectful = toolkit.filter({ readOnly: false }); // post_message only
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
const response = await Llm.operate("Extract: 'John is 25 years old'", {
  model: LLM.MODEL.SOL,
  format: {
    name: String,
    age: Number,
  },
});
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
import {
  naturalSchemaToJsonSchema,
  jsonSchemaToNaturalSchema,
} from "@jaypie/llm";

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

Anthropic's native structured output accepts at most 16 union-typed parameters per schema, and every `.nullable()` field counts as one. A larger schema is answered through a `structured_output` tool call instead and still returns parsed JSON in `content`.

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

| Event            | Fields                                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start`          | `model`, `provider`, `maxTurns`                                                                                                                                                   |
| `model_request`  | `turn`, `model`                                                                                                                                                                   |
| `model_response` | `turn`, `content` (text, if any), `toolCalls` (`[{ name, arguments }]`, if any), `usage` (this turn)                                                                              |
| `tool_call`      | `turn`, `tool: { name, arguments, message }` — fires before the tool runs; `arguments` is the JSON string; `message` is the resolved `LlmTool.message`, when the tool defines one |
| `tool_result`    | `turn`, `tool: { name }` — the result value is deliberately omitted (it can be arbitrarily large); use the `afterEachTool` hook to receive it                                     |
| `tool_error`     | `turn`, `tool: { name }`, `error` (message string)                                                                                                                                |
| `retry`          | `turn`, `error` (message string)                                                                                                                                                  |
| `done`           | `turn` (total turns used), `content` (final text or structured output), `usage` (cumulative)                                                                                      |

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
  lambdaStreamHandler(
    async (event, context) => {
      const { prompt } = JSON.parse(event.body);

      for await (const chunk of Llm.stream(prompt)) {
        context.responseStream.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    },
    {
      contentType: "text/event-stream",
    },
  ),
);
```

## Usage and Cost

`response.usage` lists token usage per model call. Every provider reports it the same way, on `operate()` and `stream()` alike:

| Field           | Meaning                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `input`         | All prompt tokens, including cache reads and writes                                             |
| `output`        | All billed output tokens, including reasoning (thinking)                                        |
| `reasoning`     | Reasoning tokens; part of `output`                                                              |
| `total`         | `input + output`                                                                                |
| `cacheRead`     | Tokens served from the prompt cache; part of `input`                                            |
| `cacheWrite`    | Tokens written to the prompt cache; part of `input`                                             |
| `cacheWriteTtl` | `cacheWrite` split by TTL (`{ "1h", "5m" }`), when the provider reports it (Anthropic, Bedrock) |

`tokenCost` prices usage in USD from `LLM.COST` (list price per million tokens) and bills each token once:

```typescript
import { Llm, LLM, tokenCost } from "@jaypie/llm";

const response = await Llm.operate("Summarize this", {
  model: LLM.MODEL.SONNET,
});
const dollars = tokenCost(response.usage, { model: LLM.MODEL.SONNET });
```

| Tokens                                    | Rate                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `input` less `cacheRead` and `cacheWrite` | `input`                                                                                             |
| `cacheRead`                               | `cachedInputRead`                                                                                   |
| `cacheWrite`                              | `cachedInputWrite` at the TTL written (from `cacheWriteTtl`, else the `ttl` option, default `"1h"`) |
| `output` less `reasoning`                 | `output`                                                                                            |
| `reasoning`                               | `reasoning`, else `output`                                                                          |

`model` prices any item whose own model id has no `COST` entry. The result is `undefined` when usage is empty or any item is unpriced, so an unknown price never reads as free. `MODEL.OPENROUTER.*` routes are deliberately unpriced.

### Prompt Caching

The system prompt and tool list are cached by default with a one-hour TTL wherever the provider accepts one (Anthropic, OpenRouter, Claude 4.5+ on Bedrock). A one-hour write costs more than a five-minute write, but reads cost the same, so it pays for itself after about three reads. Pass `cache: "5m"` for the shorter TTL (and `ttl: "5m"` to `tokenCost` when the provider does not split writes by TTL) or `cache: false` to opt out.

## Report Totals

Inside a Jaypie handler, `operate()` and `stream()` tally totals onto the logger's report session automatically. The report emitted at teardown includes an `llm` key with no code changes:

```json
{
  "llm": {
    "failures": { "openai:gpt-5.5": { "timeout": 1 } },
    "fallbacks": 1,
    "operates": 2,
    "toolCalls": 3,
    "tools": { "get_weather": 2, "roll": 1 },
    "turns": 5,
    "usage": {
      "anthropic:claude-sonnet-4-6": {
        "input": 1840,
        "output": 912,
        "reasoning": 0,
        "total": 2752
      }
    }
  }
}
```

Repeated calls in one request combine (numbers sum). `usage` is keyed `provider:model`, so fallback providers appear as separate keys. `failures` counts failed provider attempts by `provider:model` and kind (`timeout`, `rate_limit`, `retryable`, `quota`, `unrecoverable`, `unknown`), and `fallbacks` counts hand-offs to another model. A failure that hands off logs at `debug`; only the failure that reaches the caller logs at `warn`. Outside a handler session the tally is skipped entirely (guarded on `log.sessionActive`), so a CLI or script calling `operate()` directly emits nothing.

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

| `reason`      | Status | Meaning                                                                                                                                                                                                                                     |
| ------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `max_turns`   | 429    | The model asked for another tool call after `turns` ran out. Nothing failed; the run did not converge.                                                                                                                                      |
| `tool_errors` | 502    | Tool execution failed six times in a row and the loop stopped.                                                                                                                                                                              |
| `incomplete`  | 502    | The provider cut the model off before it finished (an output token ceiling, a content filter). `content` holds the partial text; `error.detail` names the provider's reason and `stopReason` normalizes it. A fallback chain moves past it. |

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
