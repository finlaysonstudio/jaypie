---
description: LLM MCP tool for debugging provider responses
related: llm, tools
---

# LLM MCP Tool

Debug and inspect LLM provider responses. Useful for understanding how providers format responses and troubleshooting API integrations.

## Usage

All parameters are passed at the top level (flat structure):

```
llm()                                         # Show help
llm({ command: "...", ...params })            # Execute a command
```

## Commands

| Command | Description |
|---------|-------------|
| `debug_call` | Make a debug call to an LLM provider |

## Debug Call

Make a test call to inspect the raw response:

```
llm({ command: "debug_call", provider: "openai", message: "Hello, world!" })
llm({ command: "debug_call", provider: "anthropic", message: "Hello, world!" })
llm({ command: "debug_call", provider: "openai", model: "o3-mini", message: "What is 15 * 17?" })
```

## Parameters

All parameters are passed at the top level (flat structure):

| Parameter | Type | Description |
|-----------|------|-------------|
| `command` | string | Command to execute (omit for help) |
| `provider` | string | LLM provider: anthropic, openai, google, openrouter |
| `message` | string | Message to send to the LLM provider |
| `model` | string | Model to use (provider-specific, e.g., gpt-4, claude-3-sonnet) |

## Response Fields

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
llm({ command: "debug_call", provider: "openai", message: "Explain recursion briefly" })
llm({ command: "debug_call", provider: "anthropic", message: "Explain recursion briefly" })
```

### Test Reasoning Models

```
llm({ command: "debug_call", provider: "openai", model: "o3-mini", message: "Solve: If 3x + 5 = 14, what is x?" })
```

### Check Token Usage

Use `debug_call` to inspect the `usage` field for token consumption analysis.
