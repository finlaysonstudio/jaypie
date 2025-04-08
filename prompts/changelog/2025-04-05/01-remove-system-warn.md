---
instructions: prompts/removing_logic.md
file: packages/llm/src/providers/openai/operate.ts
test: packages/llm/src/providers/openai/__tests__/operate.spec.ts
types: packages/llm/src/types/LlmProvider.interface.ts
---

Right now operate checks for the illegal param `system`.
Remove that check
Remove the logic that redirects it to instructions
Remove the test

In the future it will be a legal param

