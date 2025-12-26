# @jaypie/llm

LLM provider abstraction for multi-provider support with unified API.

## Package Overview

`@jaypie/llm` provides a unified interface for interacting with multiple LLM providers (OpenAI, Anthropic, Gemini, OpenRouter). It supports multi-turn conversations, tool calling, structured output, streaming, and retry logic.

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
│   │   └── ProviderAdapter.interface.ts
│   ├── hooks/                # Lifecycle hooks
│   │   └── HookRunner.ts
│   ├── input/                # Input processing
│   │   └── InputProcessor.ts
│   ├── response/             # Response building
│   │   └── ResponseBuilder.ts
│   ├── retry/                # Retry logic
│   │   ├── RetryExecutor.ts
│   │   └── RetryPolicy.ts
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
│   └── openrouter/
│       ├── OpenRouterProvider.class.ts
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
- **OperateLoop** (`operate/OperateLoop.ts`): Handles multi-turn conversations, tool execution, retry logic
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

### Streaming

```typescript
for await (const chunk of Llm.stream("Tell me a story")) {
  console.log(chunk);
}
```

## Provider SDKs

Provider SDKs are peer dependencies (optional except for the provider you use):

- `openai` - OpenAI (required dependency)
- `@anthropic-ai/sdk` - Anthropic (peer)
- `@google/genai` - Gemini (peer)
- `@openrouter/sdk` - OpenRouter (peer)

## Environment Variables

- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `GOOGLE_API_KEY` - Gemini API key
- `OPENROUTER_API_KEY` - OpenRouter API key

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
export { GeminiProvider, OpenRouterProvider };
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
