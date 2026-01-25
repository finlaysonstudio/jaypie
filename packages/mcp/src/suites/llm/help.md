# LLM Tools

Debug and inspect LLM provider responses. Useful for understanding how providers format responses.

## Commands

| Command | Description | Required Parameters |
|---------|-------------|---------------------|
| `debug_call` | Make a debug call and inspect response | `provider`, `message` |

## Providers

Supported providers: `openai`, `anthropic`, `gemini`, `openrouter`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GOOGLE_API_KEY` | Google/Gemini API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |

## Examples

```
llm("debug_call", { provider: "openai", message: "Hello, world!" })
llm("debug_call", { provider: "openai", model: "o3-mini", message: "What is 15 * 17? Think step by step." })
```

## Response Fields

The `debug_call` command returns:
- `content` - The response text
- `reasoning` - Extracted reasoning/thinking content (if available)
- `reasoningTokens` - Count of reasoning tokens used
- `history` - Full conversation history
- `rawResponses` - Raw API responses
- `usage` - Token usage statistics
