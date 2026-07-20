# @jaypie/llm

LLM provider abstraction for multi-provider support with unified API.

## Package Overview

`@jaypie/llm` provides a unified interface for interacting with multiple LLM providers (OpenAI, Anthropic, Google, OpenRouter, xAI). It supports multi-turn conversations, tool calling, structured output, streaming, and retry logic.

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
│   │   ├── GoogleAdapter.ts
│   │   ├── OpenAiAdapter.ts
│   │   ├── FireworksAdapter.ts
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
│   ├── google/
│   │   ├── GoogleProvider.class.ts
│   │   └── utils.ts
│   ├── openai/
│   │   ├── OpenAiProvider.class.ts
│   │   └── utils.ts
│   ├── fireworks/
│   │   ├── FireworksProvider.class.ts
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

// The constructor's first arg may be a provider name OR a model name —
// a model name auto-detects the provider and is retained
const claude = new Llm("claude-sonnet-4-6"); // -> anthropic, claude-sonnet-4-6
```

### Reasoning Effort

The `effort` option (`lowest | low | medium | high | highest`, exported as
`LLM.EFFORT` / type `LlmEffort`) is a provider-neutral reasoning control — a
five-point relative scale (only the anchored `medium` borrows a provider word).
Each adapter's `buildRequest` translates it to the provider's native knob via
`src/util/effort.ts` (OpenAI/Grok `reasoning.effort`, Anthropic
`output_config.effort`, Gemini 3 `thinkingLevel`, Gemini 2.5 `thinkingBudget`,
OpenRouter `reasoning.effort`, Fireworks `reasoning_effort`), spreading the
scale across the provider's range.
It is threaded through `OperateRequest` by both loops and is gated per provider
so unsupported models silently ignore it. Omitting `effort` leaves the provider
default untouched, so it is safe across a fallback chain. Bedrock is not yet
wired. First-class `effort` wins over a raw `providerOptions.reasoning`.

Each mapper returns `{ value, papered }`. `papered` is `true` when the neutral
level had no distinct native rung and was collapsed or clamped onto a neighbor
(e.g. `highest` → Grok `high`, or `highest` → OpenAI `high` on a model that
predates `xhigh`); adapters `log.debug` those so a papered-over request is on
the record. OpenAI availability is version-gated: `xhigh` (`highest`) only for
gpt-5.2+, `minimal` (`lowest`) only for gpt-5.4+ (its history is non-monotonic —
present on 5/5.1, dropped at 5.2, back on the current line); outside those
windows the end clamps to `high`/`low`.

### Output Token Limits

Anthropic and Google requests resolve a default output-token limit from the
model's documented maximum output (`src/util/maxOutputTokens.ts`), so long
generations do not silently truncate:

- **Non-streaming** (`operate()`, `send()`): capped at
  `PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT` (16,384) — larger non-streaming
  responses risk HTTP timeouts; stream instead
- **Streaming** (`stream()`): the model maximum — 128,000 for current Claude
  models (64,000 for Haiku 4.5), 65,536 for Gemini 2.5/3.x

The `stream` flag on `OperateRequest` (set by `StreamLoop`) tells adapters
which transport the request uses. Callers override per call via
`providerOptions` (`max_tokens` for Anthropic, `maxOutputTokens` for Google).
OpenAI, xAI, and OpenRouter leave the limit unset. When adding models, update
the table in `src/util/maxOutputTokens.ts`.

### Prompt Caching

`operate()` and `stream()` cache the stable request prefix (the system prompt
and the tool list) **by default**, so re-sending the same system prompt across
calls — and across every turn of a tool-calling loop — is billed at the
provider's cache-read rate (~0.1x input) after the first write.

Control it with the scalar `cache` option (`LlmCache = boolean | 0 | "5m" | "1h"`):

```typescript
await Llm.operate(input, { system: SYSTEM });            // cached @ 5m (default)
await Llm.operate(input, { system: SYSTEM, cache: "1h" }); // cached @ 1h
await Llm.operate(input, { system: SYSTEM, cache: false }); // opt out
```

- `true` / omitted → enabled at the default `"5m"` TTL
- `false` / `0` → disabled
- `"5m"` / `"1h"` → enabled at that TTL

Threaded via `OperateRequest.cache`; each adapter's `buildRequest` resolves it
with `resolveCache` (`src/util/cacheControl.ts`) and applies the provider-native
mechanism:

| Provider | Mechanism | TTL |
|----------|-----------|-----|
| Anthropic | `cache_control: {type:"ephemeral"}` on the system block + last tool | 5m / 1h |
| Bedrock | `cachePoint` blocks after `system` and `toolConfig.tools`; model-gated (unsupported models are denylisted after a 400 and the request transparently retried without cachePoints) | 5m only |
| OpenAI / xAI | automatic server-side caching + a stable `prompt_cache_key` derived from the prefix | provider default |
| OpenRouter | `cache_control` breakpoint on the system message (forwarded to Anthropic/Gemini backends, ignored by others) | 5m / 1h |
| Google | **implicit** context caching only (automatic on Gemini 2.5+); explicit `cachedContent` is not wired — pass `providerOptions.cachedContent` to manage it yourself | provider default |

Below a provider's minimum cacheable prefix, annotations silently no-op. Cache
tokens are surfaced on `LlmUsageItem` as `cacheRead` / `cacheWrite`, flow into
the exchange envelope `usageTotals`, and appear in the handler report tally.

The cached prefix must stay byte-identical to hit — keep the system prompt
static (no interpolated timestamps/IDs), which callers already do.

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

### Error Handling

When a request cannot be completed, `operate()`/`stream()` throw a normalized,
provider-agnostic `LlmError` (extends `JaypieError`) instead of a bare gateway
error. Consumers catch a stable type regardless of which provider failed; the
original provider error is preserved on `.cause`, and `.provider`/`.model` name
the failed call.

| Class | `category` | `status` | When |
|-------|-----------|----------|------|
| `LlmRateLimitError` | `rate_limit` | 429 | Short-term rate limit; carries `retryAfterMs` |
| `LlmQuotaError` | `quota` | 402 | Quota exhausted or insufficient funds; `reason: "quota" \| "billing"` |
| `LlmUnrecoverableError` | `unrecoverable` | 502 | Bad request / auth / not found |
| `LlmTransientError` | `retryable` | 504 | A transient/unknown error survived the retry budget |

```typescript
import { Llm, LlmQuotaError, LlmRateLimitError } from "@jaypie/llm";

try {
  await Llm.operate(input, { model: "claude-sonnet-5" });
} catch (error) {
  if (error instanceof LlmQuotaError) {
    // terminal: exhausted quota or unbillable account (error.reason)
  } else if (error instanceof LlmRateLimitError) {
    // back off error.retryAfterMs and retry
  }
}
```

Classification lives in each provider adapter's `classifyError`, which first
consults the shared `classifyProviderError` pass so that cross-provider
conditions agree: retryable structured-output compile timeouts (e.g. Anthropic
`Grammar compilation timed out.`, issue #422), exhausted quota, and billing
failures classify the same everywhere. A daily-quota `429` is classified as
`Quota` (terminal), not `RateLimit`. Rate-limit and quota errors are **not**
auto-retried within the request budget; they throw immediately as typed errors
so the caller decides.

**Model array sugar:**

`model` (constructor, static/instance `operate`/`send`/`stream`, and per-call
`operate` options) accepts a preference-ordered `string[]`. Index `0` is the
primary; each later entry becomes a fallback with its provider auto-detected via
`determineModelProvider` (exactly as the constructor's first argument does). Any
explicit `fallback` is appended after the array-derived chain. An empty array
throws `ConfigurationError`. `send` has no fallback machinery, so it uses the
primary and ignores the rest.

```typescript
// Preference-ordered chain (provider auto-detected per entry)
await Llm.operate(input, {
  model: [LLM.MODEL.GEMINI_FLASH, LLM.MODEL.SONNET, LLM.MODEL.LUNA],
});

// Equivalent verbose form
await Llm.operate(input, {
  model: LLM.MODEL.GEMINI_FLASH,
  fallback: [
    { provider: "anthropic", model: LLM.MODEL.SONNET },
    { provider: "openai", model: LLM.MODEL.LUNA },
  ],
});
```

The verbose `fallback` form remains for advanced needs (per-entry `apiKey`, or an
explicit provider override that disagrees with the model name).

### Structured Outputs

Pass `format` (or `response` for `provider.send`) with a Natural Schema, Zod, or JSON Schema definition to receive guaranteed-valid JSON.

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

`format` accepts three shapes, all converging on JSON Schema before hitting the provider:
- **Natural Schema** — plain object of type constructors (`{ name: String, age: Number }`), converted via `naturalZodSchema()` → Zod → JSON Schema.
- **Zod schema** (`instanceof z.ZodType`) — converted directly to JSON Schema.
- **JSON Schema** — either the OpenAI-style `{ type: "json_schema", ... }` envelope, or a bare `{ type: "object", properties: {...}, required: [...] }` node (duck-typed via `isJsonSchema`, used as-is with `required` honored).

`naturalSchemaToJsonSchema`/`jsonSchemaToNaturalSchema` (exported from `src/util/jsonSchema.ts`) convert between the first and third forms directly. The Natural→JSON direction is lossless; JSON→Natural is lossy (constraints, descriptions, defaults, unions, and optionality have no Natural Schema equivalent) — it never throws, and every dropped keyword is logged at `log.debug` with the keyword name and JSON path.

**Anthropic notes:**
- Uses Anthropic's native `output_config.format` field (GA 2025-11; Claude 4.5+). The earlier `output_format` field name is deprecated by the API.
- Schema constraints not supported by Anthropic's grammar (`minLength`, `maxLength`, `minimum`, `maximum`, `multipleOf`, regex `pattern`, recursive schemas, `additionalProperties: true`) are stripped at request time and folded into the field's `description`. The caller's Zod schema still validates the response, so all original constraints are enforced client-side.
- `additionalProperties: false` is forced on every object.
- Streaming structured outputs arrive as `LlmStreamChunkType.Text` deltas — concat to assemble JSON, or use `operate()` to get a parsed object directly.
- `stop_reason: "refusal"` and `stop_reason: "max_tokens"` are surfaced as text rather than parsed JSON. `provider.send(..., { response })` throws on these; `operate()` surfaces them via `response.content` as a string.
- A model that rejects `output_config` is cached for the session and transparently retried via the legacy fake-tool emulation. Citations + structured output (a 400 documented as incompatible) and `output_format`-deprecation 400s are **not** retried — those errors propagate so callers can see the real cause.

**Fireworks notes:**
- Uses the OpenAI-style native `response_format: { type: "json_schema", ... }` for format-only requests.
- Format **and** tools combined is rejected by the API ("You cannot specify response format and function call at the same time"), so those requests preemptively use the `structured_output` fake-tool emulation (logged at warn) — same approach as Gemini 2.5.
- A model that 400/422s on `response_format` alone is cached for the session and retried via the emulation path.
- Emulation compliance is enforced by the operate loop: when a format request completes as prose, the loop first tries to parse the text as JSON (fence-stripped), then takes a corrective turn offering **only** the `structured_output` tool (`OperateRequest.structuredOutputRetry`), looping within the `turns` budget. Adapters opt in via `supportsStructuredOutputRetry`; Fireworks is currently the only one.

**OpenRouter notes:**
- Uses the OpenAI-style native `response_format: { type: "json_schema", json_schema: { name, schema, strict: true } }`. OpenRouter routes to a backend provider; many but not all backends support this — the SDK accepts the field on every model, and unsupported routes 4xx.
- `additionalProperties: false` is forced on every object (required for `strict: true`).
- A model that 400/422s on the `response_format` field is cached for the session and transparently retried via the legacy `structured_output` fake-tool emulation. The error message must mention `response_format`/`json_schema`/`structured_output`/`require_parameters` to trigger the fallback — generic 400s propagate.
- For pre-flight enforcement, callers can pass `providerOptions: { provider: { require_parameters: true } }` to force OpenRouter to error rather than silently drop the field on backends that don't honor it.

**Google notes (Gemini models):**
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

Tools may define `message` — a human-readable status line (static string or
function of the parsed args). The operate/stream loops resolve it once per
call via `Toolkit.resolveMessage()` and surface it in the Toolkit `log`
option, the `beforeEachTool`/`afterEachTool`/`onToolError` hooks (as
`message`), and the `tool_call` progress event (as `tool.message`).

### Progress Events

`operate()` accepts an `onProgress` callback that receives lightweight,
serializable events as the loop runs — suitable for forwarding directly to
websockets, queues, or UI updates:

```typescript
import Llm, { LlmProgressEventType } from "@jaypie/llm";

const response = await Llm.operate(input, {
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
| `tool_call` | `turn`, `tool: { name, arguments, message }` — before the tool runs; `arguments` is the JSON string; `message` is the resolved `LlmTool.message`, when the tool defines one |
| `tool_result` | `turn`, `tool: { name }` — result value deliberately omitted; use `afterEachTool` to receive it |
| `tool_error` | `turn`, `tool: { name }`, `error` (message string) |
| `retry` | `turn`, `error` (message string) |
| `done` | `turn` (total turns used), `content` (final), `usage` (cumulative) |

Errors thrown by the callback are logged at warn and never interrupt the
loop. The `hooks` option remains the right choice when the full provider
request/response payloads are needed. `stream()` communicates progress
through its chunks; `onProgress` applies to `operate()`.

### Exchange Capture

`operate()` accepts `onExchange`, fired once per settlement (success or
failure) with a fully serializable `LlmExchangeEnvelope`: `request` (raw
pre-interpolation input, data, placeholders, system, instructions, model,
format as JSON Schema, tool names, turns, temperature, effort,
providerOptions, user), `response` (content, historyDelta, per-call usage +
`usageTotals` keyed `provider:model`, reasoning, status, error, stopReason),
`resolution` (served provider/model, fallbackUsed, fallbackAttempts,
retries), `timing`, and provider response `ids`. Callback errors are logged
and never interrupt the call. The loop assembles the envelope
(`src/operate/exchange/`), attaches it as `response.exchange` (or onto a
thrown error), and the `Llm` facade stamps `resolution` and fires the
callback exactly once per `operate()`. Setting `LLM_EXCHANGE_ENABLED` also
persists each envelope via `@jaypie/dynamodb`'s `storeExchange`
(`src/observability/exchangeStore.ts`, same lazy bundler-safe pattern as
LLMObs; silent no-op when the optional peer is absent).

### Operate Logging

The operate loop logs `operate.input`, `operate.options`, `operate.request`,
and `operate.response` vars at **trace**. Request and response vars are
draconian subsets — the request logs `{ model, turn, messages, latest }` and
the response logs only the text content or the requested tool calls. Full
provider payloads are never logged; use `hooks`
(`beforeEachModelRequest` / `afterEachModelResponse`) or LLM Observability
to capture them.

### Report Tally

On completion, `operate()` and `stream()` tally loop totals onto the root
logger's report session via `log.tally()` (`src/util/tallyOperate.ts`).
Inside a Jaypie handler, the report emitted at teardown includes an `llm`
key: `{ operates, toolCalls, tools?, turns, usage? }`, where `usage` is
keyed `provider:model` and sums `input`/`output`/`reasoning`/`total` and
`tools` is a per-tool-name count (present only when tools were called).
Repeated calls in one request combine (numbers sum). Outside an active
session the tally is a silent no-op.

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

## Provider Clients

The first-class providers talk to their APIs over `fetch` — no provider SDK is
installed. Each has a minimal client under `src/providers/<provider>/client.ts`
that mirrors only the surface the adapters use (request, streaming via SSE, and
HTTP errors shaped to drive `classifyError`):

- OpenAI — `OpenAIClient` (Responses API for `operate`/`stream`, Chat
  Completions for `send`)
- xAI — reuses `OpenAIClient` with `PROVIDER.XAI.BASE_URL` (OpenAI-compatible)
- Anthropic — `AnthropicClient` (Messages API)
- Google — `GoogleClient` (Gemini REST)
- Fireworks — `FireworksClient` (OpenAI-compatible Chat Completions). Images
  are `image_url` parts (vision models only; non-vision models 4xx). File/PDF
  inputs are warned and discarded — Fireworks has no `file` part and rejects
  document `data:` URIs ("Unsupported URL scheme 'data'"; Document Inlining's
  `#transform=inline` did not engage in live testing 2026-07-19)
- OpenRouter — `OpenRouterClient` (OpenAI-compatible Chat Completions)

Bedrock is the one provider that keeps an SDK: `@aws-sdk/client-bedrock-runtime`
is an **optional peer dependency**, loaded lazily via dynamic `import()` only
when the Bedrock provider runs (SigV4 auth + binary eventstream make a hand-
rolled client impractical). Non-Bedrock consumers never need it installed.

Each provider has env-gated live "hot" tests at
`src/providers/<provider>/__tests__/client.hot.spec.ts` — they run automatically
when the matching `*_API_KEY` is set and skip otherwise.

## Environment Variables

- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `GOOGLE_API_KEY` - Google API key
- `FIREWORKS_API_KEY` - Fireworks API key
- `OPENROUTER_API_KEY` - OpenRouter API key
- `XAI_API_KEY` - xAI (Grok) API key
- `LLM_EXCHANGE_ENABLED` - Persist each `operate()` call as an `exchange` entity via `@jaypie/dynamodb` `storeExchange` (optional peer, lazily resolved; silent no-op when absent)

Keys are resolved via `getEnvSecret` from `@jaypie/aws` (supports AWS Secrets Manager).

## LLM Observability (Datadog)

When `DD_LLMOBS_ENABLED` is set to a truthy value (anything but `false`/`0`),
`operate()` and `stream()` emit Datadog [LLM Observability](https://docs.datadoghq.com/llm_observability/)
spans without any code changes:

- An enclosing span per call — `agent` when tools are configured, otherwise `llm`
- A child `llm` span per model request (annotated with input, output, token metrics)
- A child `tool` span per tool execution (annotated with args + result)

Behavior:

- **Opt-in** — entirely no-op unless `DD_LLMOBS_ENABLED` is set.
- **Lazy + bundler-safe** — `dd-trace` is resolved at runtime via a computed
  module specifier (`src/observability/llmobs.ts`), so esbuild does not bundle
  it. It is **not** a dependency; absence is a silent no-op. Instrumentation
  failures never break the underlying LLM call.
- **Parenting** is AsyncLocalStorage-based: every span attaches to whatever
  LLMObs span is active when it is created. If a consumer (or an
  auto-instrumented SDK call) opens an enclosing span — e.g.
  `llmobs.trace({ kind: "workflow" }, () => Llm.operate(...))` — our spans nest
  under it. With no enclosing LLMObs span, ours are LLMObs roots. (The Datadog
  Lambda layer provides APM spans automatically, but not an enclosing *LLMObs*
  span around an arbitrary handler.)
- **`operate()`** spans form a full tree: the enclosing span stays active while
  children run, so model + tool spans nest under it.
- **`stream()`** emits per-turn `llm` spans and per-call `tool` spans that still
  attach to any active enclosing span, but within a single stream they are
  **siblings** (the `tool` span does not nest under the `llm` span). The model
  span is held open across `yield` boundaries, so it is not the active span when
  tools run — a limitation of the callback-based `dd-trace` JS SDK +
  AsyncLocalStorage across async generators.

For esbuild-bundled Lambda handlers, wire the `dd-trace/esbuild` plugin and
`keepNames: true` so dd-trace's own auto-instrumentation survives bundling; the
`@jaypie/llm` spans above do not require it.

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

// Utilities
export { extractReasoning, jsonSchemaToNaturalSchema, naturalSchemaToJsonSchema };

// Providers (for direct use)
export { FireworksProvider, GoogleProvider, OpenRouterProvider, XaiProvider };
// GeminiProvider remains as a deprecated alias of GoogleProvider
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
- `test/format.ts` - Multi-word `format` key fidelity (issue #393); run `tsx test/format.ts`, override providers with `APP_PROVIDER=openai,anthropic,...`

## Commands

```bash
npm run build -w packages/llm    # Build package
npm run test -w packages/llm     # Run tests
npm run lint -w packages/llm     # Lint code
npm run format -w packages/llm   # Fix lint issues
npm run typecheck -w packages/llm
```
