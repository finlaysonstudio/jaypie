# @jaypie/llm

LLM provider abstraction for multi-provider support with unified API.

## Package Overview

`@jaypie/llm` provides a unified interface for interacting with multiple LLM providers (OpenAI, Anthropic, Gemini, OpenRouter, xAI). It supports multi-turn conversations, tool calling, structured output, streaming, and retry logic.

## Directory Structure

```
src/
├── Llm.ts                    # Main facade class
├── constants.ts              # Provider/model constants
├── index.ts                  # Package exports
├── operate/                  # Core operation loop
│   ├── OperateLoop.ts        # Multi-turn conversation orchestrator
│   ├── StreamLoop.ts         # Streaming variant
│   ├── adapters/             # Provider-specific adapters
│   │   ├── AnthropicAdapter.ts
│   │   ├── GeminiAdapter.ts
│   │   ├── OpenAiAdapter.ts
│   │   ├── OpenRouterAdapter.ts
│   │   ├── XaiAdapter.ts
│   │   └── ProviderAdapter.interface.ts
│   ├── hooks/                # Lifecycle hooks
│   │   └── HookRunner.ts
│   ├── input/                # Input processing
│   │   └── InputProcessor.ts
│   ├── response/             # Response building
│   │   └── ResponseBuilder.ts
│   ├── retry/                # Retry logic
│   │   ├── RetryExecutor.ts
│   │   ├── RetryPolicy.ts
│   │   └── isTransientNetworkError.ts  # Network error detection
│   └── types.ts              # Internal types
├── providers/                # Provider implementations
│   ├── anthropic/
│   │   ├── AnthropicProvider.class.ts
│   │   └── utils.ts
│   ├── gemini/
│   │   ├── GeminiProvider.class.ts
│   │   └── utils.ts
│   ├── openai/
│   │   ├── OpenAiProvider.class.ts
│   │   └── utils.ts
│   ├── openrouter/
│   │   ├── OpenRouterProvider.class.ts
│   │   └── utils.ts
│   └── xai/
│       ├── XaiProvider.class.ts
│       └── utils.ts
├── tools/                    # Tool system
│   ├── Toolkit.class.ts      # Tool container with logging
│   ├── index.ts              # JaypieToolkit with built-in tools
│   ├── random.ts             # Built-in: random number
│   ├── roll.ts               # Built-in: dice roll
│   ├── time.ts               # Built-in: current time
│   └── weather.ts            # Built-in: weather lookup
├── types/                    # Type definitions
│   ├── LlmProvider.interface.ts
│   ├── LlmStreamChunk.interface.ts
│   └── LlmTool.interface.ts
└── util/                     # Utilities
    ├── determineModelProvider.ts
    ├── formatOperateInput.ts
    ├── formatOperateMessage.ts
    ├── naturalZodSchema.ts
    └── random.ts
```

## Architecture

### Template Method + Strategy Pattern

The package uses a Template Method + Strategy pattern:

1. **OperateLoop** - Orchestrates multi-turn conversations (template)
2. **ProviderAdapter** - Handles provider-specific API differences (strategy)
3. **Provider Classes** - Manage client lifecycle and expose `operate()` method

```
Provider Class → OperateLoop → ProviderAdapter → Provider API
```

### Key Components

- **Llm** (`Llm.ts`): Main facade that auto-selects provider based on model name
- **OperateLoop** (`operate/OperateLoop.ts`): Handles multi-turn conversations, tool execution, retry logic (non-streaming)
- **StreamLoop** (`operate/StreamLoop.ts`): Streaming variant with automatic tool execution, retry for transient network errors (yields chunks as they arrive)
- **ProviderAdapter** (`operate/adapters/`): Translates between standardized format and provider APIs
- **Toolkit** (`tools/Toolkit.class.ts`): Container for LlmTool definitions with call execution

## Usage

### Basic Usage

```typescript
import Llm from "@jaypie/llm";

// Auto-detect provider from model
const response = await Llm.operate("Hello", { model: "claude-sonnet-4" });

// Or specify provider explicitly
const llm = new Llm("openai", { model: "gpt-4o" });
const result = await llm.operate("What is 2+2?");
```

### Fallback Providers

Configure a chain of fallback providers that automatically retry failed calls when the primary provider fails with an unrecoverable error.

```typescript
import Llm from "@jaypie/llm";

// Instance-level fallback configuration
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

**Response metadata:**
- `provider`: Which provider actually handled the request
- `fallbackUsed`: `true` if a fallback provider was used
- `fallbackAttempts`: Number of providers tried (1 = primary only)

### Structured Outputs

Pass `format` (or `response` for `provider.send`) with a Zod or JSON-Schema definition to receive guaranteed-valid JSON.

```typescript
import { z } from "zod/v4";
import Llm from "@jaypie/llm";

const Greeting = z.object({
  salutation: z.string(),
  name: z.string(),
});

const response = await Llm.operate("Greet the world", {
  model: "claude-opus-4-7",
  format: Greeting,
});
// response.content is parsed JSON: { salutation: "Hello", name: "World" }
```

**Anthropic notes:**
- Uses Anthropic's native `output_config.format` field (GA 2025-11; Claude 4.5+). The earlier `output_format` field name is deprecated by the API.
- Schema constraints not supported by Anthropic's grammar (`minLength`, `maxLength`, `minimum`, `maximum`, `multipleOf`, regex `pattern`, recursive schemas, `additionalProperties: true`) are stripped at request time and folded into the field's `description`. The caller's Zod schema still validates the response, so all original constraints are enforced client-side.
- `additionalProperties: false` is forced on every object.
- Streaming structured outputs arrive as `LlmStreamChunkType.Text` deltas — concat to assemble JSON, or use `operate()` to get a parsed object directly.
- `stop_reason: "refusal"` and `stop_reason: "max_tokens"` are surfaced as text rather than parsed JSON. `provider.send(..., { response })` throws on these; `operate()` surfaces them via `response.content` as a string.
- A model that rejects `output_config` is cached for the session and transparently retried via the legacy fake-tool emulation. Citations + structured output (a 400 documented as incompatible) and `output_format`-deprecation 400s are **not** retried — those errors propagate so callers can see the real cause.

**OpenRouter notes:**
- Uses the OpenAI-style native `response_format: { type: "json_schema", json_schema: { name, schema, strict: true } }`. OpenRouter routes to a backend provider; many but not all backends support this — the SDK accepts the field on every model, and unsupported routes 4xx.
- `additionalProperties: false` is forced on every object (required for `strict: true`).
- A model that 400/422s on the `response_format` field is cached for the session and transparently retried via the legacy `structured_output` fake-tool emulation. The error message must mention `response_format`/`json_schema`/`structured_output`/`require_parameters` to trigger the fallback — generic 400s propagate.
- For pre-flight enforcement, callers can pass `providerOptions: { provider: { require_parameters: true } }` to force OpenRouter to error rather than silently drop the field on backends that don't honor it.

**Gemini notes:**
- Format-only requests use native `responseMimeType: "application/json"` + `responseSchema` (OpenAPI 3.0) by default, or `responseJsonSchema` (standard JSON Schema) when `providerOptions.useJsonSchema: true`.
- Format **and** tools combined: native `responseJsonSchema` + tools is supported only on Gemini 3 (preview) and is enabled automatically when the model id matches `^gemini-3`. Gemini 2.5 (including thinking) and earlier fall back to the `structured_output` fake-tool emulation with a system-prompt nudge.
- A Gemini 3 model that 400s the combo is cached for the session and transparently retried via the fake-tool path. The error message must mention `responseJsonSchema`/`responseSchema`/`responseMime`/`function_call`/`tools` to trigger the fallback.

### With Tools

```typescript
import Llm, { Toolkit } from "@jaypie/llm";

const toolkit = new Toolkit([
  {
    name: "get_weather",
    description: "Get current weather",
    parameters: { type: "object", properties: { city: { type: "string" } } },
    call: async ({ city }) => `Weather in ${city}: sunny`,
  },
]);

const response = await Llm.operate("What's the weather in NYC?", {
  tools: toolkit,
});
```

### Streaming with Automatic Tool Execution

The `stream()` method provides real-time streaming while **automatically executing tools** - combining the responsiveness of streaming with the full tool-calling lifecycle of `operate()`.

```typescript
import Llm, { Toolkit, LlmStreamChunkType } from "@jaypie/llm";

const toolkit = new Toolkit([
  {
    name: "get_weather",
    description: "Get current weather",
    parameters: { type: "object", properties: { city: { type: "string" } } },
    call: async ({ city }) => `Weather in ${city}: sunny, 72°F`,
  },
]);

// Stream with tools - tools are executed automatically
for await (const chunk of Llm.stream("What's the weather in NYC?", { tools: toolkit })) {
  switch (chunk.type) {
    case LlmStreamChunkType.Text:
      // Real-time text as tokens arrive
      process.stdout.write(chunk.content);
      break;
    case LlmStreamChunkType.ToolCall:
      // Tool was requested (informational - already being executed)
      console.log(`\n[Calling ${chunk.toolCall.name}...]`);
      break;
    case LlmStreamChunkType.ToolResult:
      // Tool finished executing
      console.log(`[Result: ${JSON.stringify(chunk.toolResult.result)}]`);
      break;
    case LlmStreamChunkType.Done:
      // Stream complete, usage available
      console.log(`\n[Tokens: ${chunk.usage.reduce((sum, u) => sum + u.total, 0)}]`);
      break;
    case LlmStreamChunkType.Error:
      console.error(`Error: ${chunk.error.title}`);
      break;
  }
}
```

**Key behaviors:**
- Text chunks stream in real-time as tokens are generated
- When the LLM requests a tool, `stream()` executes it automatically
- Tool results are fed back to the LLM and streaming continues
- Multi-turn conversations work seamlessly (use `turns` option)
- All lifecycle hooks (`beforeEachTool`, `afterEachTool`, etc.) are supported

**Stream chunk types:**
| Type | Description |
|------|-------------|
| `text` | Streamed text content |
| `tool_call` | LLM requested a tool (informational) |
| `tool_result` | Tool execution completed |
| `done` | Stream finished with usage stats |
| `error` | Error occurred |

**Simple streaming (no tools):**
```typescript
for await (const chunk of Llm.stream("Tell me a story")) {
  if (chunk.type === LlmStreamChunkType.Text) {
    process.stdout.write(chunk.content);
  }
}
```

## Provider SDKs

Provider SDKs are peer dependencies (optional except for the provider you use):

- `openai` - OpenAI and xAI (required dependency; xAI uses the OpenAI SDK with a custom base URL)
- `@anthropic-ai/sdk` - Anthropic (peer)
- `@google/genai` - Gemini (peer)
- `@openrouter/sdk` - OpenRouter (peer)

## Environment Variables

- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `GOOGLE_API_KEY` - Gemini API key
- `OPENROUTER_API_KEY` - OpenRouter API key
- `XAI_API_KEY` - xAI (Grok) API key

Keys are resolved via `getEnvSecret` from `@jaypie/aws` (supports AWS Secrets Manager).

## Adding New Providers

See `GUIDE.md` for detailed instructions on adding new LLM providers.

## Exports

```typescript
// Main class
export { default as Llm } from "./Llm.js";
export * as LLM from "./constants.js";

// Types
export type {
  LlmHistory,
  LlmInputMessage,
  LlmOperateOptions,
  LlmOperateResponse,
  LlmProvider,
  LlmTool,
  LlmStreamChunk,
};

// Enums
export { LlmMessageRole, LlmMessageType, LlmStreamChunkType };

// Tools
export { JaypieToolkit, toolkit, Toolkit, tools };

// Providers (for direct use)
export { GeminiProvider, OpenRouterProvider, XaiProvider };
```

## Used By

- `packages/jaypie` - Re-exports LLM functionality

## Testing

```bash
npm run test -w packages/llm     # Unit tests
npm run typecheck -w packages/llm
```

Integration tests in `test/` directory require API keys:
- `test/client.ts` - Real API calls
- `test/joke.ts` - Streaming test

## Commands

```bash
npm run build -w packages/llm    # Build package
npm run test -w packages/llm     # Run tests
npm run lint -w packages/llm     # Lint code
npm run format -w packages/llm   # Fix lint issues
npm run typecheck -w packages/llm
```
