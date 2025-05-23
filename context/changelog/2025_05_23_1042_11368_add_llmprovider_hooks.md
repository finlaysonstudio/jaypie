# Add LlmProvider Hooks

packages/llm/src/providers/openai/operate.ts
packages/llm/src/providers/openai/__tests__/operate.spec.ts
packages/llm/src/types/LlmProvider.interface.ts

LlmProvider defines several hooks.

1. Convert these hooks, their implementation, and tests to be a single object parameter
2. Add several new hooks:

```typescript
beforeEachModelRequest({ 
  input: string | LlmHistory | LlmInputMessage,
  options?: LlmOperateOptions,
  providerRequest: any,
})
afterEachModelResponse({ 
  input: string | LlmHistory | LlmInputMessage,
  options?: LlmOperateOptions,
  providerRequest: any,
  providerResponse: any,
  content: string | JsonObject,
  usage: LlmUsage
})
onRetryableModelError({ 
  input: string | LlmHistory | LlmInputMessage,
  options?: LlmOperateOptions,
  providerRequest: any,
  error: any,
})
onUnrecoverableModelError({ 
  input: string | LlmHistory | LlmInputMessage,
  options?: LlmOperateOptions,
  providerRequest: any,
  error: any,
})
```

`content` should be the string or object response from the llm or the `${LlmMessageType.FunctionCall}:${output.name}${output.arguments}#${output.call_id}` construction.

This might require moving some functions into helpers.
Run `vitest run operate.spec.ts` to confirm functionality before and after refactoring.

