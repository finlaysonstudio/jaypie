---
description: Using @jaypie/llm for unified LLM access
related: fabric, streaming, tests, tools
---

# @jaypie/llm

Unified interface for calling LLM providers with multi-turn conversations, tool calling, streaming, and structured output.

## Quick Start

```typescript
import Llm from "@jaypie/llm";

// Auto-detect provider from model name
const response = await Llm.operate("What is 2+2?", { model: "claude-sonnet-4" });
console.log(response.content); // "4"
```

## Providers and Models

| Provider | Match Keywords | Default Model |
|----------|----------------|---------------|
| OpenAI | "openai", "gpt", /^o\d/ | gpt-5.4 |
| Anthropic | "anthropic", "claude", "haiku", "opus", "sonnet" | claude-sonnet-4-6 |
| Google | "google", "gemini" | gemini-3.1-pro-preview |
| OpenRouter | "openrouter" | anthropic/claude-sonnet-4-6 |
| xAI | "xai", "grok" | grok-latest |

The provider name for Gemini models is `"google"` — `"gemini"` is accepted as a deprecated alias.

```typescript
// Provider auto-detected from model
await Llm.operate(input, { model: "gpt-5.1" });      // OpenAI
await Llm.operate(input, { model: "claude-opus-4" }); // Anthropic
await Llm.operate(input, { model: "gemini-3" });     // Google
```

## Core Methods

### operate() - Multi-turn with Tools

The primary method for complex interactions:

```typescript
const response = await Llm.operate(input, {
  model: "gpt-5.1",
  system: "You are a helpful assistant",
  tools: toolkit,
  turns: 5, // Allow up to 5 conversation turns
});

// Response structure
response.content;    // string | object (structured output)
response.history;    // LlmHistory - for follow-up calls
response.usage;      // Token usage per turn
response.reasoning;  // Extended thinking (if available)
response.status;     // "completed" | "incomplete" | "in_progress"
```

### send() - Simple Completions

For single-shot text completions:

```typescript
const response = await Llm.send("Explain REST APIs", {
  model: "claude-sonnet-4",
  system: "You are a technical writer",
});
```

### stream() - Streaming Responses

For real-time output:

```typescript
for await (const chunk of Llm.stream("Tell me a story", { model: "gpt-5.1" })) {
  switch (chunk.type) {
    case "text":
      process.stdout.write(chunk.content);
      break;
    case "tool_call":
      console.log(`Tool: ${chunk.toolCall.name}`);
      break;
    case "done":
      console.log("Usage:", chunk.usage);
      break;
  }
}
```

## Tool Calling

### Define Tools with Toolkit

```typescript
import Llm, { Toolkit } from "@jaypie/llm";

const toolkit = new Toolkit([
  {
    name: "get_weather",
    description: "Get current weather for a city",
    type: "function",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name" },
      },
      required: ["city"],
    },
    call: async ({ city }) => {
      // Actual implementation
      return { temp: 72, conditions: "sunny" };
    },
  },
]);

const response = await Llm.operate("What's the weather in NYC?", {
  model: "gpt-5.1",
  tools: toolkit,
});
```

### Built-in Tools

```typescript
import Llm, { tools, JaypieToolkit } from "@jaypie/llm";

// Use individual tools
const response = await Llm.operate("Roll 2d6", {
  model: "gpt-5.1",
  tools,  // Includes: random, roll, time, weather
});

// Or use the pre-configured toolkit
const toolkit = new JaypieToolkit();
```

### Fabric Services as Tools

```typescript
import { fabricLlmTool } from "@jaypie/fabric";

const greetTool = fabricLlmTool(greetService);
const toolkit = new Toolkit([greetTool]);
```

### Explain Mode

Explain mode adds transparency to tool calling by requiring the LLM to state its reasoning when invoking tools.

```typescript
// Enable via Toolkit constructor
const toolkit = new Toolkit([myTool], { explain: true });

// Or via operate options
const response = await Llm.operate("What's the weather?", {
  model: "gpt-5.1",
  tools: myTools,
  explain: true,
});
```

When enabled:
- Each tool receives an `__Explanation` parameter requiring the model to state why it's calling the tool
- The explanation is stripped before the tool executes (tools receive clean arguments)
- Useful for debugging and understanding LLM decision-making

### Tool Messages

Tools may define a `message` — a human-readable status line for the call, either a static string or a function of the parsed arguments:

```typescript
const toolkit = new Toolkit([
  {
    name: "get_weather",
    description: "Get current weather for a city",
    type: "function",
    parameters: { type: "object", properties: { city: { type: "string" } } },
    call: async ({ city }) => ({ temp: 72 }),
    message: ({ city }) => `Checking weather in ${city}`,
  },
]);
```

The resolved message surfaces in three places during `operate()`/`stream()`:
- The Toolkit's `log` option: `new Toolkit(tools, { log: (message, { name, args }) => ... })`
- The `beforeEachTool`, `afterEachTool`, and `onToolError` hooks as `message`
- The `tool_call` progress event as `tool.message` (`operate()` only)

Resolve one directly with `toolkit.resolveMessage({ name, arguments })` — returns the resolved string, or `undefined` when the tool is missing or defines no message; it never throws.

## Structured Output

### Natural Schema

```typescript
const result = await Llm.operate("Extract contact info from: John Doe, john@example.com, 555-1234", {
  model: "gpt-5.1",
  format: {
    name: String,
    email: String,
    phone: String,
  },
});
// result.content = { name: "John Doe", email: "john@example.com", phone: "555-1234" }
```

#### Declared arrays always present

A declared `format` is a schema contract. `operate()` guarantees every array field declared in `format` is present in `content` as an array — an empty list surfaces as `[]`, never `undefined` or a dropped key. This holds across providers/models, including those that omit empty array fields, so `content.someArray.length` is always safe without defensive normalization. The backfill recurses into nested objects and arrays of objects.

```typescript
const res = await Llm.operate(message, {
  format: {
    "Merchant Request": String,
    "Merchant Attachments": [String],
    "Recommended Actions": [String],
  },
});
// Even when the model returns no recommendations:
// res.content["Recommended Actions"] === []  (never undefined)
```

### Zod Schema

```typescript
import { z } from "zod";

const PersonSchema = z.object({
  name: z.string(),
  age: z.number(),
  hobbies: z.array(z.string()),
});

const result = await Llm.operate("Parse: Alice is 30 and likes hiking and reading", {
  model: "gpt-5.1",
  format: PersonSchema,
});
```

### Bare JSON Schema

`format` also duck-types a bare JSON Schema object node — `{ type: "object", properties: {...} }` — without needing the OpenAI-style `{ type: "json_schema", ... }` envelope. `required` is honored.

```typescript
const result = await Llm.operate("Analyze this chargeback", {
  model: "gpt-5.1",
  format: {
    type: "object",
    properties: {
      code: { type: "string", description: "The chargeback reason code" },
      cardBrand: { type: "string", description: "Visa, Mastercard, etc." },
    },
    required: ["code"],
  },
});
```

### Converting between Natural Schema and JSON Schema

```typescript
import { jsonSchemaToNaturalSchema, naturalSchemaToJsonSchema } from "@jaypie/llm";

naturalSchemaToJsonSchema({ name: String, age: Number });
// { type: "object", properties: { name: { type: "string" }, age: { type: "number" } }, required: ["name", "age"] }

jsonSchemaToNaturalSchema({
  type: "object",
  properties: { name: { type: "string" } },
  required: ["name"],
});
// { name: String }
```

`naturalSchemaToJsonSchema` is lossless — Natural Schema is a strict subset of JSON Schema. `jsonSchemaToNaturalSchema` is lossy: JSON Schema constraints, descriptions, defaults, unions, and optionality have no Natural Schema equivalent and are dropped. It never throws; every dropped keyword is logged at `log.debug` with the keyword name and JSON path.

## Conversation History

Continue conversations across calls:

```typescript
const first = await Llm.operate("My name is Alice", { model: "gpt-5.1" });

const second = await Llm.operate("What's my name?", {
  model: "gpt-5.1",
  history: first.history,
});
// second.content = "Your name is Alice"
```

## Input with Files and Images

```typescript
const response = await Llm.operate([
  "Analyze these documents",
  { file: "report.pdf", bucket: "my-bucket" },
  { image: "chart.png" },
], {
  model: "claude-sonnet-4",
});
```

## Placeholders and Data

Substitute data into prompts:

```typescript
const response = await Llm.operate("Summarize the article about {{topic}}", {
  model: "gpt-5.1",
  data: { topic: "climate change" },
  placeholders: { input: true },
});
```

## Lifecycle Hooks

Monitor and react to LLM operations:

```typescript
const response = await Llm.operate(input, {
  model: "gpt-5.1",
  hooks: {
    beforeEachModelRequest: ({ providerRequest }) => {
      console.log("Sending request...");
    },
    afterEachModelResponse: ({ content, usage }) => {
      console.log(`Tokens: ${usage.total}`);
    },
    beforeEachTool: ({ toolName, args, message }) => {
      console.log(message ?? `Calling ${toolName} with ${args}`);
    },
    afterEachTool: ({ result, toolName, message }) => {
      console.log(`${toolName} returned:`, result);
    },
    onToolError: ({ error, toolName, message }) => {
      console.error(`${toolName} failed:`, error);
    },
  },
});
```

The tool hooks receive `message` — the tool's resolved `LlmTool.message`, when the tool defines one (see Tool Messages).

## Progress Events

For progress reporting (UI updates, websockets, queue notifications), prefer `onProgress` over wiring individual hooks. It receives lightweight, serializable events as the loop runs:

```typescript
import { LlmProgressEventType } from "@jaypie/llm";

const response = await Llm.operate(input, {
  model: "gpt-5.1",
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

Errors thrown by the callback are logged and never interrupt the loop. Hooks remain the right choice when you need the full provider request/response payloads. `stream()` communicates progress through its chunks; `onProgress` applies to `operate()`.

## Fallback Providers

Configure a chain of fallback providers that automatically retry failed calls when the primary provider fails:

```typescript
// Instance-level configuration
const llm = new Llm("anthropic", {
  model: "claude-sonnet-4",
  fallback: [
    { provider: "openai", model: "gpt-4o" },
    { provider: "google", model: "gemini-2.0-flash" },
  ],
});

// Per-call override
const response = await llm.operate(input, {
  fallback: [{ provider: "openai", model: "gpt-4o" }],
});

// Disable fallback for specific call
const response = await llm.operate(input, { fallback: false });

// Static method with fallback
const response = await Llm.operate(input, {
  model: "claude-sonnet-4",
  fallback: [{ provider: "openai", model: "gpt-4o" }],
});
```

### Fallback Response Metadata

```typescript
response.provider;        // Which provider handled the request
response.fallbackUsed;    // true if a fallback was used
response.fallbackAttempts; // Number of providers tried (1 = primary only)
```

## Instance Usage

For repeated calls with same configuration:

```typescript
const llm = new Llm("anthropic", {
  model: "claude-sonnet-4",
  system: "You are a code reviewer",
});

const review1 = await llm.operate(code1);
const review2 = await llm.operate(code2);
```

The first constructor argument may be a provider name **or** a model name. When a model name is passed, the provider is auto-detected and the model is retained:

```typescript
import Llm, { LLM } from "@jaypie/llm";

const llm = new Llm("claude-sonnet-4-6");      // -> anthropic, claude-sonnet-4-6
const flash = new Llm(LLM.MODEL.GEMINI_FLASH); // -> google, gemini-3.5-flash
```

## Environment Variables

```bash
ANTHROPIC_API_KEY   # Required for Anthropic
GOOGLE_API_KEY      # Required for Google (Gemini models)
OPENAI_API_KEY      # Required for OpenAI
OPENROUTER_API_KEY  # Required for OpenRouter
XAI_API_KEY         # Required for xAI (Grok)
```

Keys are resolved via `getEnvSecret()` which supports AWS Secrets Manager.

## Report Totals

Inside a Jaypie handler (`expressHandler`, `lambdaHandler`, and stream variants), `operate()` and `stream()` tally totals onto the logger's report session via `log.tally()` (requires `@jaypie/llm` >= 1.3.9 and `@jaypie/logger` >= 1.2.21). The report emitted at teardown includes an `llm` key with no code changes:

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

- `operates` counts loop executions; repeated calls sum every number
- `usage` is keyed `provider:model` — fallback providers appear as separate keys
- `tools` appears only when tools were called
- Outside a handler session the tally is a silent no-op

## LLM Observability (Datadog)

Set `DD_LLMOBS_ENABLED` (any truthy value except `false`/`0`) and `operate()`/`stream()` emit Datadog [LLM Observability](https://docs.datadoghq.com/llm_observability/) spans with **no code changes**:

- Enclosing span per call (`agent` when tools are configured, else `llm`)
- Child `llm` span per model request — annotated with input, output, token metrics
- Child `tool` span per tool execution — annotated with args + result

```bash
DD_LLMOBS_ENABLED=true   # opt in; unset = fully no-op
DD_LLMOBS_ML_APP=my-app  # ML app name (dd-trace standard)
```

Behavior:

- **Opt-in and lazy** — `dd-trace` is resolved at runtime via a computed module specifier, so it is **bundler-safe** (esbuild will not bundle it) and **not** a dependency. Absence is a silent no-op; instrumentation failures never break the LLM call.
- **Parenting is AsyncLocalStorage-based** — spans attach to whatever LLMObs span is active when created. Wrapping a call in a consumer span (e.g. `llmobs.trace({ kind: "workflow" }, () => Llm.operate(...))`) nests ours under it. The Datadog Lambda layer provides APM spans automatically, but not an enclosing *LLMObs* span around an arbitrary handler.
- **`operate()`** spans form a full tree (model + tool nest under the enclosing span).
- **`stream()`** spans attach to any active enclosing span, but within a single stream the `llm` and `tool` spans are **siblings** — the streamed model span is held open across `yield` boundaries, so it is not the active span when tools run.

For esbuild-bundled Lambda handlers that also want dd-trace auto-instrumentation, wire the `dd-trace/esbuild` plugin with `keepNames: true`; the spans above do not require it.

### Availability

Span emission ships in the **`@jaypie/llm` 1.2.x line** (current `latest`). Note that the `1.3.0` build published to npm predates this feature and contains **no** LLM Obs code — a `^1.2` range resolves to `1.3.0` and silently loses emission. Until a release **above** `1.3.0` ships with the feature, pin to a `latest` 1.2.x that includes it (grep the installed dist for `llmobs` to confirm).

### Flushing on Lambda

On Lambda the runtime freezes the instant the handler resolves, so buffered LLM Obs spans are dropped unless flushed first. Jaypie handler wrappers flush automatically in teardown — no per-handler code:

- `@jaypie/lambda` — `lambdaHandler`, `lambdaStreamHandler`
- `@jaypie/express` — `createLambdaHandler`, `createLambdaStreamHandler`

Outside those wrappers, flush manually before returning with the bundler-safe `flushLlmObs()` from `@jaypie/datadog`; reach the runtime SDK singleton for manual spans/annotations/`submitEvaluation` via `getLlmObs()`.

```typescript
import { flushLlmObs, getLlmObs } from "@jaypie/datadog";

getLlmObs()?.trace({ kind: "workflow", name: "my-job" }, async () => {
  await Llm.operate(input);
});
flushLlmObs(); // no-op unless DD_LLMOBS_ENABLED; never throws
```

## Error Handling

The package auto-retries rate limits and transient errors:

```typescript
try {
  const response = await Llm.operate(input, { model: "gpt-5.1" });
  if (response.status !== "completed") {
    console.log("Incomplete:", response.error);
  }
} catch (error) {
  // Unrecoverable errors (auth, validation) throw
}
```

## Testing Pattern

```typescript
import { describe, expect, it, vi } from "vitest";
import Llm, { Toolkit } from "@jaypie/llm";

describe("LLM Integration", () => {
  it("calls tool and returns response", async () => {
    const mockTool = {
      name: "calculate",
      description: "Perform calculation",
      type: "function",
      parameters: { type: "object", properties: { expr: { type: "string" } } },
      call: vi.fn().mockResolvedValue("42"),
    };

    const toolkit = new Toolkit([mockTool]);
    const response = await Llm.operate("Calculate 6*7", {
      model: "gpt-5.1",
      tools: toolkit,
    });

    expect(mockTool.call).toHaveBeenCalled();
    expect(response.status).toBe("completed");
  });
});
```

## Best Practices

1. **Use operate() over send()** - More flexible, handles tools and structure
2. **Set turns appropriately** - Default is 1; increase for tool-heavy workflows
3. **Provide clear tool descriptions** - LLMs use these to decide which tool to call
4. **Use structured output** - More reliable than parsing free text
5. **Track usage** - Monitor `response.usage` for cost management
6. **Handle incomplete status** - Check `response.status` for tool errors or limits
7. **Configure fallbacks** - Set up fallback providers for resilience against outages

## Common Options

```typescript
interface LlmOperateOptions {
  data?: Record<string, any>;           // Placeholder substitution data
  effort?: LlmEffort;                   // Provider-neutral reasoning effort (lowest|low|medium|high|highest)
  fallback?: LlmFallbackConfig[] | false; // Fallback provider chain
  format?: NaturalSchema | JsonObject | ZodType; // Structured output schema (natural syntax preferred)
  history?: LlmHistory;                 // Previous conversation
  hooks?: LlmHooks;                     // Lifecycle callbacks
  instructions?: string;                // Additional instructions
  model?: string;                       // Model override
  providerOptions?: JsonObject;         // Provider-specific request fields (passthrough)
  system?: string;                      // System prompt
  temperature?: number;                 // Sampling temperature (0-2)
  tools?: LlmTool[] | Toolkit;         // Available tools
  turns?: boolean | number;             // Max conversation turns
  user?: string;                        // User ID for logging
}

interface LlmFallbackConfig {
  provider: string;   // Provider name (e.g., "openai", "anthropic", "google")
  model?: string;     // Model to use (optional, uses provider default)
  apiKey?: string;    // API key (optional, uses environment variable)
}
```

## Reasoning Effort

`effort` is a provider-neutral reasoning control — a five-point relative scale
(`lowest | low | medium | high | highest`, exported as `LLM.EFFORT`) where only
the anchored `medium` borrows a provider word. Each adapter translates it to the
provider's native knob, spreading the scale across that provider's available
range, so one value works across providers and fallback chains. Omitting
`effort` leaves the provider default untouched — it is **safe to set regardless
of which model handles the call**.

```typescript
import Llm, { LLM } from "@jaypie/llm";

await Llm.operate("Solve this step by step", {
  model: "gpt-5.1",
  effort: "high",          // or LLM.EFFORT.HIGH
});
```

Per-provider translation (`medium`/`high` stay aligned across providers; ends
collapse where a provider has fewer rungs):

| `effort`  | OpenAI `reasoning.effort` | Anthropic `output_config.effort` | Gemini 3 `thinkingLevel` | Gemini 2.5 `thinkingBudget` | Grok `reasoning_effort` | OpenRouter `reasoning.effort` |
|-----------|---------------------------|----------------------------------|--------------------------|-----------------------------|-------------------------|-------------------------------|
| `lowest`  | minimal | low    | MINIMAL | 512   | low    | minimal |
| `low`     | low     | low    | LOW     | 4096  | low    | low     |
| `medium`  | medium  | medium | MEDIUM  | 8192  | medium | medium  |
| `high`    | high    | high   | HIGH    | 16384 | high   | high    |
| `highest` | xhigh   | max    | HIGH    | 24576 | high   | xhigh   |

When a neutral level has no distinct native rung and collapses onto a neighbor
(e.g. `highest` → Grok `high`), the adapter logs it at `log.debug` for the
record. OpenAI's extremes are also version-gated: `xhigh` (`highest`) applies
only to gpt-5.2+ and `minimal` (`lowest`) only to gpt-5.4+ (its history is
non-monotonic); older gpt-5 / o-series clamp the end to `high`/`low`.

Gating (effort is silently ignored where reasoning is unavailable, never
erroring):

- **OpenAI** — only reasoning models (`gpt-5+`, `o`-series); merges with the
  auto `reasoning.summary`. `xhigh` requires gpt-5.2+, `minimal` requires
  gpt-5.4+ (else clamped).
- **Anthropic** — only Claude 4.5+ / 5 models (`output_config.effort`); merges
  alongside a structured-output `format` config.
- **Google** — `thinkingLevel` for Gemini 3.x, `thinkingBudget` for Gemini 2.5;
  other models get nothing.
- **xAI** — only models whose name advertises reasoning (e.g.
  `grok-4-1-fast-reasoning`); bare `grok-latest` and `*-non-reasoning` are
  skipped.
- **OpenRouter** — always forwarded; OpenRouter maps to the routed model's
  nearest supported level.
- **Bedrock** — not yet wired; `effort` is ignored.

First-class `effort` takes precedence over a raw `providerOptions.reasoning`
(same convention as `temperature`). For control the neutral scale doesn't
express (an exact token budget, OpenAI `none`), use `providerOptions` directly.

## Provider Options and Output Limits

`providerOptions` passes provider-specific request fields straight through to
the underlying API: Anthropic merges them into the Messages request body;
Google merges them into the generation config.

### Default Output Token Limits

Anthropic and Google requests resolve a default output-token limit from the
model's documented maximum output, so long generations do not silently
truncate:

- **Non-streaming** (`operate()`, `send()`): capped at 16,384 tokens —
  larger non-streaming responses risk HTTP timeouts (stream instead)
- **Streaming** (`stream()`): the model maximum — e.g., 128,000 for current
  Claude models (64,000 for Haiku), 65,536 for Gemini 2.5/3.x

Override per call with `providerOptions`:

```typescript
// Anthropic: max_tokens
await Llm.operate(input, {
  model: "claude-sonnet-4-6",
  providerOptions: { max_tokens: 32000 },
});

// Google: maxOutputTokens
await Llm.operate(input, {
  model: "gemini-3.1-pro-preview",
  providerOptions: { maxOutputTokens: 32000 },
});
```

OpenAI and xAI leave the limit unset (their defaults do not truncate early).
OpenRouter varies by routed model; pass `max_tokens` via `providerOptions`
when needed. A truncated response surfaces `stop_reason: "max_tokens"` —
raise the limit or switch to `stream()`.

## See Also

- **`skill("streaming")`** - Streaming LLM responses to Lambda and Express with `createLambdaStream`
- **`skill("tools")`** - Writing LLM tools with Toolkit and Fabric services
