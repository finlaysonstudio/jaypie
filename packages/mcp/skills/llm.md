---
description: Using @jaypie/llm for unified LLM access
related: fabric, streaming, tests, tools
---

# @jaypie/llm

Unified interface for calling LLM providers with multi-turn conversations, tool calling, streaming, and structured output.

## Quick Start

```typescript
import Llm from "@jaypie/llm";

// Auto-detect provider from model name
const response = await Llm.operate("What is 2+2?", { model: "claude-sonnet-4" });
console.log(response.content); // "4"
```

## Providers and Models

| Provider | Match Keywords | Default Model |
|----------|----------------|---------------|
| OpenAI | "openai", "gpt", /^o\d/ | gpt-5.1 |
| Anthropic | "anthropic", "claude", "haiku", "opus", "sonnet" | claude-sonnet-4-5 |
| Gemini | "gemini", "google" | gemini-3-pro-preview |
| OpenRouter | "openrouter" | z-ai/glm-4.7 |

```typescript
// Provider auto-detected from model
await Llm.operate(input, { model: "gpt-5.1" });      // OpenAI
await Llm.operate(input, { model: "claude-opus-4" }); // Anthropic
await Llm.operate(input, { model: "gemini-3" });     // Gemini
```

## Core Methods

### operate() - Multi-turn with Tools

The primary method for complex interactions:

```typescript
const response = await Llm.operate(input, {
  model: "gpt-5.1",
  system: "You are a helpful assistant",
  tools: toolkit,
  turns: 5, // Allow up to 5 conversation turns
});

// Response structure
response.content;    // string | object (structured output)
response.history;    // LlmHistory - for follow-up calls
response.usage;      // Token usage per turn
response.reasoning;  // Extended thinking (if available)
response.status;     // "completed" | "incomplete" | "in_progress"
```

### send() - Simple Completions

For single-shot text completions:

```typescript
const response = await Llm.send("Explain REST APIs", {
  model: "claude-sonnet-4",
  system: "You are a technical writer",
});
```

### stream() - Streaming Responses

For real-time output:

```typescript
for await (const chunk of Llm.stream("Tell me a story", { model: "gpt-5.1" })) {
  switch (chunk.type) {
    case "text":
      process.stdout.write(chunk.content);
      break;
    case "tool_call":
      console.log(`Tool: ${chunk.toolCall.name}`);
      break;
    case "done":
      console.log("Usage:", chunk.usage);
      break;
  }
}
```

## Tool Calling

### Define Tools with Toolkit

```typescript
import Llm, { Toolkit } from "@jaypie/llm";

const toolkit = new Toolkit([
  {
    name: "get_weather",
    description: "Get current weather for a city",
    type: "function",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name" },
      },
      required: ["city"],
    },
    call: async ({ city }) => {
      // Actual implementation
      return { temp: 72, conditions: "sunny" };
    },
  },
]);

const response = await Llm.operate("What's the weather in NYC?", {
  model: "gpt-5.1",
  tools: toolkit,
});
```

### Built-in Tools

```typescript
import Llm, { tools, JaypieToolkit } from "@jaypie/llm";

// Use individual tools
const response = await Llm.operate("Roll 2d6", {
  model: "gpt-5.1",
  tools,  // Includes: random, roll, time, weather
});

// Or use the pre-configured toolkit
const toolkit = new JaypieToolkit();
```

### Fabric Services as Tools

```typescript
import { fabricLlmTool } from "@jaypie/fabric";

const greetTool = fabricLlmTool(greetService);
const toolkit = new Toolkit([greetTool]);
```

## Structured Output

### Natural Schema

```typescript
const result = await Llm.operate("Extract contact info from: John Doe, john@example.com, 555-1234", {
  model: "gpt-5.1",
  format: {
    name: String,
    email: String,
    phone: String,
  },
});
// result.content = { name: "John Doe", email: "john@example.com", phone: "555-1234" }
```

### Zod Schema

```typescript
import { z } from "zod";

const PersonSchema = z.object({
  name: z.string(),
  age: z.number(),
  hobbies: z.array(z.string()),
});

const result = await Llm.operate("Parse: Alice is 30 and likes hiking and reading", {
  model: "gpt-5.1",
  format: PersonSchema,
});
```

## Conversation History

Continue conversations across calls:

```typescript
const first = await Llm.operate("My name is Alice", { model: "gpt-5.1" });

const second = await Llm.operate("What's my name?", {
  model: "gpt-5.1",
  history: first.history,
});
// second.content = "Your name is Alice"
```

## Input with Files and Images

```typescript
const response = await Llm.operate([
  "Analyze these documents",
  { file: "report.pdf", bucket: "my-bucket" },
  { image: "chart.png" },
], {
  model: "claude-sonnet-4",
});
```

## Placeholders and Data

Substitute data into prompts:

```typescript
const response = await Llm.operate("Summarize the article about {{topic}}", {
  model: "gpt-5.1",
  data: { topic: "climate change" },
  placeholders: { input: true },
});
```

## Lifecycle Hooks

Monitor and react to LLM operations:

```typescript
const response = await Llm.operate(input, {
  model: "gpt-5.1",
  hooks: {
    beforeEachModelRequest: ({ providerRequest }) => {
      console.log("Sending request...");
    },
    afterEachModelResponse: ({ content, usage }) => {
      console.log(`Tokens: ${usage.total}`);
    },
    beforeEachTool: ({ toolName, args }) => {
      console.log(`Calling ${toolName} with`, args);
    },
    afterEachTool: ({ result, toolName }) => {
      console.log(`${toolName} returned:`, result);
    },
    onToolError: ({ error, toolName }) => {
      console.error(`${toolName} failed:`, error);
    },
  },
});
```

## Fallback Providers

Configure a chain of fallback providers that automatically retry failed calls when the primary provider fails:

```typescript
// Instance-level configuration
const llm = new Llm("anthropic", {
  model: "claude-sonnet-4",
  fallback: [
    { provider: "openai", model: "gpt-4o" },
    { provider: "gemini", model: "gemini-2.0-flash" },
  ],
});

// Per-call override
const response = await llm.operate(input, {
  fallback: [{ provider: "openai", model: "gpt-4o" }],
});

// Disable fallback for specific call
const response = await llm.operate(input, { fallback: false });

// Static method with fallback
const response = await Llm.operate(input, {
  model: "claude-sonnet-4",
  fallback: [{ provider: "openai", model: "gpt-4o" }],
});
```

### Fallback Response Metadata

```typescript
response.provider;        // Which provider handled the request
response.fallbackUsed;    // true if a fallback was used
response.fallbackAttempts; // Number of providers tried (1 = primary only)
```

## Instance Usage

For repeated calls with same configuration:

```typescript
const llm = new Llm("anthropic", {
  model: "claude-sonnet-4",
  system: "You are a code reviewer",
});

const review1 = await llm.operate(code1);
const review2 = await llm.operate(code2);
```

## Environment Variables

```bash
OPENAI_API_KEY      # Required for OpenAI
ANTHROPIC_API_KEY   # Required for Anthropic
GOOGLE_API_KEY      # Required for Gemini
OPENROUTER_API_KEY  # Required for OpenRouter
```

Keys are resolved via `getEnvSecret()` which supports AWS Secrets Manager.

## Error Handling

The package auto-retries rate limits and transient errors:

```typescript
try {
  const response = await Llm.operate(input, { model: "gpt-5.1" });
  if (response.status !== "completed") {
    console.log("Incomplete:", response.error);
  }
} catch (error) {
  // Unrecoverable errors (auth, validation) throw
}
```

## Testing Pattern

```typescript
import { describe, expect, it, vi } from "vitest";
import Llm, { Toolkit } from "@jaypie/llm";

describe("LLM Integration", () => {
  it("calls tool and returns response", async () => {
    const mockTool = {
      name: "calculate",
      description: "Perform calculation",
      type: "function",
      parameters: { type: "object", properties: { expr: { type: "string" } } },
      call: vi.fn().mockResolvedValue("42"),
    };

    const toolkit = new Toolkit([mockTool]);
    const response = await Llm.operate("Calculate 6*7", {
      model: "gpt-5.1",
      tools: toolkit,
    });

    expect(mockTool.call).toHaveBeenCalled();
    expect(response.status).toBe("completed");
  });
});
```

## Best Practices

1. **Use operate() over send()** - More flexible, handles tools and structure
2. **Set turns appropriately** - Default is 1; increase for tool-heavy workflows
3. **Provide clear tool descriptions** - LLMs use these to decide which tool to call
4. **Use structured output** - More reliable than parsing free text
5. **Track usage** - Monitor `response.usage` for cost management
6. **Handle incomplete status** - Check `response.status` for tool errors or limits
7. **Configure fallbacks** - Set up fallback providers for resilience against outages

## Common Options

```typescript
interface LlmOperateOptions {
  data?: Record<string, any>;           // Placeholder substitution data
  fallback?: LlmFallbackConfig[] | false; // Fallback provider chain
  format?: JsonObject | ZodType;        // Structured output schema
  history?: LlmHistory;                 // Previous conversation
  hooks?: LlmHooks;                     // Lifecycle callbacks
  instructions?: string;                // Additional instructions
  model?: string;                       // Model override
  system?: string;                      // System prompt
  tools?: LlmTool[] | Toolkit;         // Available tools
  turns?: boolean | number;             // Max conversation turns
  user?: string;                        // User ID for logging
}

interface LlmFallbackConfig {
  provider: string;   // Provider name (e.g., "openai", "anthropic", "gemini")
  model?: string;     // Model to use (optional, uses provider default)
  apiKey?: string;    // API key (optional, uses environment variable)
}
```

## See Also

- **`skill("streaming")`** - Streaming LLM responses to Lambda and Express with `createLambdaStream`
