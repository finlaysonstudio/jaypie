---
instructions: prompts/test_first_development.md
file: packages/llm/src/providers/openai/operate.ts
test: packages/llm/src/providers/openai/__tests__/operate.spec.ts
types: packages/llm/src/types/LlmProvider.interface.ts
---

Add a new LlmMessageOptions `system` that is a string. 
If it is present apply placeholders to it similar to `input`.
Skip placeholders when placeholders.system === false (treat undefined as true). 
If it is passed, create a LlmInputMessage with this content, role LlmMessageRole.System, type: LlmMessageType.Message.
Make this the first message in the input, before the history.
Return this as part of the history.
Return this as part of the output.
Iff history starts with a system message with the same content, de-dup.
If their contents are different, prepend the new message so it is the first.
