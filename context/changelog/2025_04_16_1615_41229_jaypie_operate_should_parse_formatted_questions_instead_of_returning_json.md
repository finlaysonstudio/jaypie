# Jaypie operate should parse formatted questions instead of returning json

<Files>
packages/llm/src/types/LlmProvider.interface.ts
packages/llm/src/providers/openai/operate.ts
</Files>

<Tests>
packages/llm/src/providers/openai/__tests__/operate.spec.ts
</Tests>

Make LlmOperateResponse content?: string | JsonObject;

If the options include format, try to parse content.
If it parses return the parsed version.
If it doesn't parse return the original.

Add tests.
