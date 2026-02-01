---
description: LLM MCP tool for debugging provider responses
related: llm, tools
---

# LLM MCP Tool

Debug and inspect LLM provider responses. Useful for understanding how providers format responses and troubleshooting API integrations.

## Usage

```
llm()                                    # Show help
llm("command", { ...params })            # Execute a command
```

## Commands

| Command | Description |
|---------|-------------|
| `list_providers` | List available LLM providers and their status |
| `debug_call` | Make a debug call to an LLM provider |

## List Providers

Check which providers are configured:

```
llm("list_providers")
```

Returns provider availability based on environment variables.

## Debug Call

Make a test call to inspect the raw response:

```
llm("debug_call", { provider: "openai", message: "Hello, world!" })
llm("debug_call", { provider: "anthropic", message: "Hello, world!" })
llm("debug_call", { provider: "openai", model: "o3-mini", message: "What is 15 * 17?" })
```

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `provider` | Yes | Provider name: `openai`, `anthropic`, `gemini`, `openrouter` |
| `message` | Yes | Message to send |
| `model` | No | Specific model to use |

### Response Fields

| Field | Description |
|-------|-------------|
| `content` | The response text |
| `reasoning` | Extracted reasoning/thinking content (if available) |
| `reasoningTokens` | Count of reasoning tokens used |
| `history` | Full conversation history |
| `rawResponses` | Raw API responses for debugging |
| `usage` | Token usage statistics |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GOOGLE_API_KEY` | Google/Gemini API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |

## Supported Providers

| Provider | Models |
|----------|--------|
| `openai` | gpt-4o, gpt-4o-mini, o1, o3-mini, etc. |
| `anthropic` | claude-sonnet-4-20250514, claude-opus-4-20250514, etc. |
| `gemini` | gemini-2.0-flash, gemini-1.5-pro, etc. |
| `openrouter` | Access to multiple providers |

## Common Patterns

### Compare Provider Responses

```
llm("debug_call", { provider: "openai", message: "Explain recursion briefly" })
llm("debug_call", { provider: "anthropic", message: "Explain recursion briefly" })
```

### Test Reasoning Models

```
llm("debug_call", { provider: "openai", model: "o3-mini", message: "Solve: If 3x + 5 = 14, what is x?" })
```

### Check Token Usage

Use `debug_call` to inspect the `usage` field for token consumption analysis.
