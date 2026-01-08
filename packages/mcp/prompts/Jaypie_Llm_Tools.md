---
trigger: glob
globs: packages/tools/*
---

# LLM Tools with Jaypie 🔧

Extend LLM capabilities with tools for external actions and data retrieval

## Goal

Create and integrate tools that enable LLMs to perform specific functions beyond their training data

## Interface

Implement the `LlmTool` interface:

```typescript
import { z } from "zod/v4";

interface LlmTool {
  description: string;
  name: string;
  parameters: JsonObject | z.ZodType;  // JSON Schema or Zod schema
  type: "function" | string;
  call: (args?: JsonObject) => Promise<AnyValue> | AnyValue;
}
```

Properties:
- `description`: Clear explanation of tool functionality
- `name`: Unique identifier
- `parameters`: JSON Schema or Zod schema defining input parameters
- `type`: Usually "function" (OpenAI convention)
- `call`: Implementation function executed on invocation

## Example: Dice Roller (JSON Schema)

```typescript
import { LlmTool } from "../types/LlmTool.interface.js";
import { log, random, tryParseNumber } from "../util";

export const roll: LlmTool = {
  description: "Roll one or more dice with a specified number of sides",
  name: "roll",
  parameters: {
    type: "object",
    properties: {
      number: {
        type: "number",
        description: "Number of dice to roll. Default: 1",
      },
      sides: {
        type: "number",
        description: "Number of sides on each die. Default: 6",
      },
    },
    required: ["number", "sides"],
  },
  type: "function",
  call: ({ number = 1, sides = 6 } = {}): {
    rolls: number[];
    total: number;
  } => {
    const rng = random();
    const rolls: number[] = [];
    let total = 0;

    const parsedNumber = tryParseNumber(number, {
      defaultValue: 1,
      warnFunction: log.warn,
    }) as number;
    const parsedSides = tryParseNumber(sides, {
      defaultValue: 6,
      warnFunction: log.warn,
    }) as number;

    for (let i = 0; i < parsedNumber; i++) {
      const rollValue = rng({ min: 1, max: parsedSides, integer: true });
      rolls.push(rollValue);
      total += rollValue;
    }

    return { rolls, total };
  },
};
```

## Example: Weather Tool (Zod Schema)

```typescript
import { z } from "zod/v4";
import { LlmTool } from "jaypie";

export const getWeather: LlmTool = {
  description: "Get current weather for a city",
  name: "get_weather",
  parameters: z.object({
    city: z.string().describe("City name"),
    unit: z.enum(["celsius", "fahrenheit"]).describe("Temperature unit"),
  }),
  type: "function",
  call: async ({ city, unit }) => {
    // Implementation here
    return { city, temperature: 72, unit };
  },
};
```

## Best Practices

### Input Validation
Validate and sanitize parameters with utilities like `tryParseNumber`.

### Clear Descriptions
Write precise descriptions for tools and parameters to guide LLM usage.

### Consistent Returns
Return consistent data structures for predictable LLM interpretation.

### Error Handling
Implement robust error handling to prevent crashes and provide meaningful messages.

## Integration

```typescript
import { Llm } from "jaypie";
import { roll } from "./tools/roll.js";

// Create Llm instance
const llm = new Llm("openai", { model: "gpt-4o" });

// Use tools with operate
const response = await llm.operate("Roll 3d20 and tell me the result", {
  tools: [roll],
});

// Or use Toolkit for additional features
import { Toolkit } from "jaypie";

const toolkit = new Toolkit([roll], {
  explain: true,  // Requires model to explain why it's calling tools
  log: true,      // Log tool calls (default)
});

const result = await llm.operate("Roll some dice", {
  tools: toolkit,
});
```

## References

- [Jaypie Library](https://github.com/finlaysonstudio/jaypie)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [Jaypie_Llm_Calls.md](./Jaypie_Llm_Calls.md) to better understand Llm.operate()
