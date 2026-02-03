# LLM Tools

Debug and inspect LLM provider responses. Useful for understanding how providers format responses.

## Commands

| Command | Description | Required Parameters |
|---------|-------------|---------------------|
| `debug_call` | Make a debug call and inspect response | `provider`, `message` |

## Parameters

All parameters are passed at the top level (flat structure):

| Parameter | Type | Description |
|-----------|------|-------------|
| `command` | string | Command to execute (omit for help) |
| `provider` | string | LLM provider: anthropic, openai, google, openrouter |
| `message` | string | Message to send to the LLM provider |
| `model` | string | Model to use (provider-specific, e.g., gpt-4, claude-3-sonnet) |

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
# Debug OpenAI call
llm({ command: "debug_call", provider: "openai", message: "Hello, world!" })

# Debug with specific model
llm({ command: "debug_call", provider: "openai", model: "o3-mini", message: "What is 15 * 17? Think step by step." })

# Debug Anthropic call
llm({ command: "debug_call", provider: "anthropic", message: "Explain quantum computing" })
```

## Response Fields

The `debug_call` command returns:
- `content` - The response text
- `reasoning` - Extracted reasoning/thinking content (if available)
- `reasoningTokens` - Count of reasoning tokens used
- `history` - Full conversation history
- `rawResponses` - Raw API responses
- `usage` - Token usage statistics
