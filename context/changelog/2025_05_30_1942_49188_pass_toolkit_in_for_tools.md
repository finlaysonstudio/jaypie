# Pass toolkit in for tools

packages/llm/src/providers/openai/__tests__/operate.spec.ts
packages/llm/src/providers/openai/operate.ts
packages/llm/src/tools/__tests__/Toolkit.class.test.ts
packages/llm/src/tools/Toolkit.class.ts
packages/llm/src/types/LlmProvider.interface.ts
packages/llm/src/types/LlmTool.interface.ts

I would like to update `operate` to accept an array of `tools` or a toolkit as defined in the toolkit class.

Right now a toolkit is created from tools.
This is fine when tools are passed in.
If a toolkit is passed in, just use that.