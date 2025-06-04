# Llm operate model and provider

packages/llm/src/types/LlmProvider.interface.ts
packages/llm/src/providers/openai/operate.ts
packages/testkit/src/mock/llm.ts

I would like to add two convenience fields to the return of LlmOperateResponse:
provider: PROVIDER.OPENAI.NAME,
model: options?.model || PROVIDER.OPENAI.MODEL.DEFAULT,

Change the mock in testkit.
