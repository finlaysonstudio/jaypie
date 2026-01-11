# Adding a New LLM Provider

This guide explains how to add a new LLM provider to `@jaypie/llm`. The package uses a Template Method + Strategy pattern with a shared `OperateLoop` that orchestrates multi-turn conversations while provider-specific adapters handle API differences.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Provider Class                          │
│  (e.g., OpenAiProvider, AnthropicProvider)                  │
│  - Manages client lifecycle                                  │
│  - Exposes operate() method                                  │
│  - Maintains conversation history                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                      OperateLoop                             │
│  - Orchestrates multi-turn conversations                    │
│  - Executes lifecycle hooks                                  │
│  - Handles tool calling                                      │
│  - Manages retry logic via RetryExecutor                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   ProviderAdapter                            │
│  (e.g., OpenAiAdapter, AnthropicAdapter)                    │
│  - Builds provider-specific requests                         │
│  - Parses provider responses                                 │
│  - Classifies errors for retry logic                        │
│  - Handles tool result formatting                            │
└─────────────────────────────────────────────────────────────┘
```

## Step 1: Create the Provider Adapter

The adapter translates between the standardized `OperateLoop` interface and your provider's specific API format.

### File Location

Create your adapter at:
```
src/operate/adapters/YourProviderAdapter.ts
```

### Extend BaseProviderAdapter

```typescript
import { JsonObject, NaturalSchema } from "@jaypie/types";
import { z } from "zod/v4";
import { PROVIDER } from "../../constants.js";
import { Toolkit } from "../../tools/Toolkit.class.js";
import {
  LlmHistory,
  LlmOperateOptions,
  LlmUsageItem,
} from "../../types/LlmProvider.interface.js";
import {
  ClassifiedError,
  ErrorCategory,
  OperateRequest,
  ParsedResponse,
  ProviderToolDefinition,
  StandardToolCall,
  StandardToolResult,
} from "../types.js";
import { BaseProviderAdapter } from "./ProviderAdapter.interface.js";

export class YourProviderAdapter extends BaseProviderAdapter {
  readonly name = "your-provider";
  readonly defaultModel = "your-default-model";

  // ... implement required methods
}

// Export singleton instance
export const yourProviderAdapter = new YourProviderAdapter();
```

### Required Methods

#### 1. Request Building

```typescript
/**
 * Build a provider-specific request from the standardized format.
 * Transform OperateRequest into whatever your API expects.
 */
buildRequest(request: OperateRequest): unknown {
  return {
    model: request.model || this.defaultModel,
    messages: request.messages,
    // Add provider-specific fields
  };
}

/**
 * Convert a Toolkit to provider-specific tool definitions.
 */
formatTools(toolkit: Toolkit, outputSchema?: JsonObject): ProviderToolDefinition[] {
  return toolkit.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters as JsonObject,
  }));
}

/**
 * Format a structured output schema for the provider.
 * Convert Zod/NaturalSchema to provider's expected format.
 */
formatOutputSchema(schema: JsonObject | NaturalSchema | z.ZodType): JsonObject {
  // Provider-specific schema formatting
}
```

#### 2. API Execution

```typescript
/**
 * Execute an API request to the provider.
 * The client is the SDK instance from your provider.
 */
async executeRequest(client: unknown, request: unknown): Promise<unknown> {
  const sdk = client as YourProviderSDK;
  return await sdk.chat.completions.create(request);
}
```

#### 3. Response Parsing

```typescript
/**
 * Parse a provider response into standardized format.
 */
parseResponse(response: unknown, options?: LlmOperateOptions): ParsedResponse {
  const providerResponse = response as YourResponseType;

  return {
    content: this.extractContent(providerResponse),
    hasToolCalls: this.hasToolCalls(providerResponse),
    stopReason: providerResponse.stop_reason,
    usage: this.extractUsage(providerResponse, options?.model || this.defaultModel),
    raw: providerResponse,
  };
}

/**
 * Extract tool calls from a provider response.
 */
extractToolCalls(response: unknown): StandardToolCall[] {
  const providerResponse = response as YourResponseType;
  // Map provider tool calls to StandardToolCall format
  return providerResponse.tool_calls?.map(tc => ({
    callId: tc.id,
    name: tc.function.name,
    arguments: tc.function.arguments,
    raw: tc,
  })) || [];
}

/**
 * Extract usage information from a provider response.
 */
extractUsage(response: unknown, model: string): LlmUsageItem {
  const providerResponse = response as YourResponseType;
  return {
    input: providerResponse.usage?.prompt_tokens || 0,
    output: providerResponse.usage?.completion_tokens || 0,
    reasoning: 0, // If provider supports reasoning tokens
    total: providerResponse.usage?.total_tokens || 0,
    provider: this.name,
    model,
  };
}
```

#### 4. Tool Result Handling

```typescript
/**
 * Format a tool result to append to the conversation.
 */
formatToolResult(toolCall: StandardToolCall, result: StandardToolResult): unknown {
  return {
    role: "tool",
    tool_call_id: toolCall.callId,
    content: result.output,
  };
}

/**
 * Append tool result to the request for the next turn.
 * The OperateLoop calls responseToHistoryItems() first,
 * so you may only need to add the result here.
 */
appendToolResult(
  request: unknown,
  toolCall: StandardToolCall,
  result: StandardToolResult,
): unknown {
  const providerRequest = request as YourRequestType;

  // Add assistant message with tool call (if not already added)
  // Add tool result
  providerRequest.messages.push(this.formatToolResult(toolCall, result));

  return providerRequest;
}
```

#### 5. History Management

```typescript
/**
 * Convert provider response items to LlmHistory format for storage.
 *
 * IMPORTANT: For multi-turn tool calling, this is called BEFORE
 * processing tool calls. Include all items needed for the next
 * request (e.g., OpenAI requires reasoning items to precede
 * function_call items).
 */
responseToHistoryItems(response: unknown): LlmHistory {
  const providerResponse = response as YourResponseType;

  // For tool_use responses, you may return empty and let
  // appendToolResult handle everything, OR return the items
  // and have appendToolResult only add the result.

  return historyItems;
}
```

#### 6. Error Classification

```typescript
/**
 * Classify an error for retry logic.
 */
classifyError(error: unknown): ClassifiedError {
  // Check for rate limit
  if (error instanceof YourRateLimitError) {
    return {
      error,
      category: ErrorCategory.RateLimit,
      shouldRetry: false,
      suggestedDelayMs: 60000,
    };
  }

  // Check for retryable errors (network, server errors)
  if (error instanceof YourConnectionError) {
    return {
      error,
      category: ErrorCategory.Retryable,
      shouldRetry: true,
    };
  }

  // Check for non-retryable errors (auth, bad request)
  if (error instanceof YourAuthError) {
    return {
      error,
      category: ErrorCategory.Unrecoverable,
      shouldRetry: false,
    };
  }

  // Unknown - default to retry
  return {
    error,
    category: ErrorCategory.Unknown,
    shouldRetry: true,
  };
}
```

#### 7. Completion Detection

```typescript
/**
 * Check if a response indicates the model has finished
 * (vs. wanting to use tools).
 */
isComplete(response: unknown): boolean {
  const providerResponse = response as YourResponseType;
  return providerResponse.stop_reason === "end_turn";
}
```

### Optional Methods

The `BaseProviderAdapter` provides default implementations for:

- `isRetryableError(error)` - Uses `classifyError`
- `isRateLimitError(error)` - Uses `classifyError`
- `hasStructuredOutput(response)` - Returns `false`
- `extractStructuredOutput(response)` - Returns `undefined`

Override these if your provider has special handling.

## Step 2: Export the Adapter

Update `src/operate/adapters/index.ts`:

```typescript
export { YourProviderAdapter, yourProviderAdapter } from "./YourProviderAdapter.js";
```

Update `src/operate/index.ts`:

```typescript
export {
  // ... existing exports
  YourProviderAdapter,
  yourProviderAdapter,
} from "./adapters/index.js";
```

## Step 3: Add Provider Constants

Update `src/constants.ts`:

```typescript
export const PROVIDER = {
  // ... existing providers
  YOUR_PROVIDER: {
    NAME: "your-provider",
    API_KEY: "YOUR_PROVIDER_API_KEY",
    MODEL: {
      DEFAULT: "your-default-model",
    },
  },
};
```

## Step 4: Create the Provider Class

Create your provider at:
```
src/providers/your-provider/YourProvider.class.ts
```

```typescript
import { JsonObject } from "@jaypie/types";
import YourSDK from "your-provider-sdk";
import { PROVIDER } from "../../constants.js";
import {
  createOperateLoop,
  OperateLoop,
  yourProviderAdapter,
} from "../../operate/index.js";
import {
  LlmHistory,
  LlmInputMessage,
  LlmOperateOptions,
  LlmOperateResponse,
  LlmProvider,
  LlmHistoryItem,
} from "../../types/LlmProvider.interface.js";
import { initializeClient, getLogger } from "./utils.js";

export class YourProvider implements LlmProvider {
  private model: string;
  private _client?: YourSDK;
  private _operateLoop?: OperateLoop;
  private apiKey?: string;
  private log = getLogger();
  private conversationHistory: LlmHistoryItem[] = [];

  constructor(
    model: string = PROVIDER.YOUR_PROVIDER.MODEL.DEFAULT,
    { apiKey }: { apiKey?: string } = {},
  ) {
    this.model = model;
    this.apiKey = apiKey;
  }

  private async getClient(): Promise<YourSDK> {
    if (this._client) {
      return this._client;
    }

    this._client = await initializeClient({ apiKey: this.apiKey });
    return this._client;
  }

  private async getOperateLoop(): Promise<OperateLoop> {
    if (this._operateLoop) {
      return this._operateLoop;
    }

    const client = await this.getClient();
    this._operateLoop = createOperateLoop({
      adapter: yourProviderAdapter,
      client,
    });
    return this._operateLoop;
  }

  async operate(
    input: string | LlmHistory | LlmInputMessage,
    options: LlmOperateOptions = {},
  ): Promise<LlmOperateResponse> {
    const operateLoop = await this.getOperateLoop();
    const mergedOptions = { ...options, model: options.model ?? this.model };

    // Merge instance history with provided history
    if (this.conversationHistory.length > 0) {
      mergedOptions.history = options.history
        ? [...this.conversationHistory, ...options.history]
        : [...this.conversationHistory];
    }

    // Execute operate loop
    const response = await operateLoop.execute(input, mergedOptions);

    // Update conversation history
    if (response.history && response.history.length > 0) {
      this.conversationHistory = response.history;
    }

    return response;
  }
}
```

### Create Utils File

Create `src/providers/your-provider/utils.ts`:

```typescript
import { getEnvSecret } from "@jaypie/aws";
import { ConfigurationError, log as coreLog, JAYPIE } from "@jaypie/core";
import YourSDK from "your-provider-sdk";
import { PROVIDER } from "../../constants.js";

export function getLogger() {
  return coreLog.lib({ lib: JAYPIE.LIB.LLM });
}

export async function initializeClient({
  apiKey,
}: { apiKey?: string } = {}): Promise<YourSDK> {
  const log = getLogger();

  const key = apiKey || await getEnvSecret(PROVIDER.YOUR_PROVIDER.API_KEY);

  if (!key) {
    log.error("API key not available");
    throw new ConfigurationError(
      "The application could not resolve the required API key",
    );
  }

  const client = new YourSDK({ apiKey: key });
  log.trace("Initialized YourProvider client");

  return client;
}
```

## Step 5: Export the Provider

Update `src/providers/index.ts`:

```typescript
export { YourProvider } from "./your-provider/YourProvider.class.js";
```

Update `src/index.ts`:

```typescript
export { YourProvider } from "./providers/index.js";
```

## Step 6: Write Tests

### Adapter Tests

Create `src/operate/adapters/__tests__/YourProviderAdapter.spec.ts`:

Test each method:
- `buildRequest` - Verify request format
- `parseResponse` - Verify response parsing
- `extractToolCalls` - Verify tool call extraction
- `extractUsage` - Verify usage extraction
- `formatToolResult` - Verify tool result formatting
- `appendToolResult` - Verify tool result appending
- `responseToHistoryItems` - Verify history conversion
- `classifyError` - Verify error classification
- `isComplete` - Verify completion detection

### Provider Tests

Create `src/providers/your-provider/__tests__/YourProvider.spec.ts`:

Test:
- Constructor with default and custom model
- `operate()` method delegates to OperateLoop
- Conversation history management
- Error handling

## Features You Get for Free

By implementing the adapter, your provider automatically gets:

1. **Multi-turn Conversations** - The OperateLoop handles turn management
2. **Tool Calling** - Define tools via `Toolkit`, the loop handles execution
3. **Retry Logic** - `RetryExecutor` with exponential backoff
4. **Lifecycle Hooks**:
   - `beforeEachModelRequest`
   - `afterEachModelResponse`
   - `beforeEachTool`
   - `afterEachTool`
   - `onToolError`
   - `onRetryableModelError`
   - `onUnrecoverableModelError`
5. **Structured Output** - Via `format` option with Zod/NaturalSchema
6. **Placeholder Substitution** - Via `data` option
7. **Usage Tracking** - Aggregated across turns
8. **History Management** - Automatic conversation history

## Provider-Specific Considerations

### OpenAI Responses API

- Uses `input` array instead of `messages`
- Reasoning items must precede function_call items
- Tool definitions need `type: "function"` wrapper

### Anthropic Messages API

- Uses `messages` array with role-based structure
- Tool results are sent as user messages with `tool_result` content
- Stop reason `tool_use` indicates tool calling

## Testing Your Provider

Run the integration test:

```bash
npm run test:llm:client
```

This tests real API calls with both providers. Add your provider to the test if you have API credentials.

## Example: Minimal Adapter

Here's a minimal example showing the essential methods:

```typescript
export class MinimalAdapter extends BaseProviderAdapter {
  readonly name = "minimal";
  readonly defaultModel = "minimal-1";

  buildRequest(request: OperateRequest): unknown {
    return {
      model: request.model,
      messages: request.messages,
    };
  }

  formatTools(toolkit: Toolkit): ProviderToolDefinition[] {
    return toolkit.tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters as JsonObject,
    }));
  }

  formatOutputSchema(schema: JsonObject | NaturalSchema | z.ZodType): JsonObject {
    return schema as JsonObject;
  }

  async executeRequest(client: unknown, request: unknown): Promise<unknown> {
    return await (client as any).complete(request);
  }

  parseResponse(response: unknown): ParsedResponse {
    const r = response as any;
    return {
      content: r.content,
      hasToolCalls: !!r.tool_calls?.length,
      raw: r,
    };
  }

  extractToolCalls(response: unknown): StandardToolCall[] {
    return (response as any).tool_calls?.map((tc: any) => ({
      callId: tc.id,
      name: tc.name,
      arguments: tc.args,
      raw: tc,
    })) || [];
  }

  extractUsage(response: unknown, model: string): LlmUsageItem {
    return { input: 0, output: 0, reasoning: 0, total: 0, provider: this.name, model };
  }

  formatToolResult(toolCall: StandardToolCall, result: StandardToolResult): unknown {
    return { id: toolCall.callId, result: result.output };
  }

  appendToolResult(request: unknown, _tc: StandardToolCall, result: StandardToolResult): unknown {
    (request as any).messages.push(result);
    return request;
  }

  responseToHistoryItems(response: unknown): LlmHistory {
    return [(response as any).message];
  }

  classifyError(error: unknown): ClassifiedError {
    return { error, category: ErrorCategory.Unknown, shouldRetry: true };
  }

  isComplete(response: unknown): boolean {
    return !(response as any).tool_calls?.length;
  }
}
```
