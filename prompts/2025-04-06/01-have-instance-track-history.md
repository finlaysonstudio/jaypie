---
class: packages/llm/src/providers/OpenAiProvider.class.ts
test: packages/llm/src/providers/OpenAiProvider.class.spec.ts
types: packages/llm/src/types/LlmProvider.interface.ts
spec_review: prompts/2025-04-06/specification_review.md
---

# Persist Operate History in instances of LLM

The operate function allows a `history` object to be passed in. 
The operate response includes a `history` array that can be used.
Instances of Llm should remember their own history for subsequent `operate` calls.
That is, `llm.operate("My name is Doctor Charles Xavier"); llm.operate("What is my name?");` should not need to collect and pass history to continue functioning.

## Steps

## Caveats

* Only focus on the OpenAI implementation
