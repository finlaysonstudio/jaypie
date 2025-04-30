---
instructions: prompts/test_first_development.md
file: packages/llm/src/providers/openai/operate.ts
test: packages/llm/src/providers/openai/__tests__/operate.spec.ts
types: packages/llm/src/types/LlmProvider.interface.ts
---

# Add Developer Warning

Create a test that incorrectly passes LlmMessageOptions a `developer` key, even though it is not supported:

``` javascript
await operate("test message",
  { developer: developerMessage },
  { client: mockClient },
);
```

If it is present, log a warning.
Check a warning was logged.
Treat `developer` like `system`, including the use of the system role in messages.
Check it is handled like system in the test.
Do NOT add `developer` to the type.
Explain to the linter the incorrectly passed type is intentional.
