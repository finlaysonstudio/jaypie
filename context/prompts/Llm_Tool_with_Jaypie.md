# LLM Tools with Jaypie

## Introduction

Jaypie provides a simple yet powerful interface for creating and using tools with Large Language Models (LLMs). These tools allow LLMs to perform specific actions or retrieve information beyond their training data, such as rolling dice, fetching data, or performing calculations.

## Creating a Tool

An LLM tool in Jaypie follows a standard interface that makes it compatible with various LLM providers.

### Tool Interface

Each tool must implement the `LlmTool` interface:

```typescript
interface LlmTool {
  description: string;
  name: string;
  parameters: JsonObject;
  type: "function" | string;
  call: (args?: JsonObject) => Promise<AnyValue> | AnyValue;
}
```

- `description`: A clear explanation of what the tool does
- `name`: A unique identifier for the tool
- `parameters`: JSON Schema object describing the expected input parameters
- `type`: Usually "function" (following OpenAI's function calling convention)
- `call`: The implementation function that executes when the tool is invoked

## Example Tool: Dice Roller

Here's a complete example of a dice rolling tool:

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

## Best Practices

### Parameter Validation

Always validate and sanitize input parameters. The example above uses `tryParseNumber` to ensure inputs are valid numbers with sensible defaults.

### Clear Descriptions

Write clear descriptions for both the tool and its parameters. The LLM will use these descriptions to determine when and how to use your tool.

### Consistent Return Types

Design your tool to return consistent data structures. This makes it easier for the LLM to interpret and use the results.

### Error Handling

Implement proper error handling in your tool's `call` function to prevent crashes and provide meaningful error messages.

## Using Tools with LLMs

To use tools with an LLM in Jaypie:

1. Import your tools
2. Add them to your LLM configuration
3. The LLM will automatically invoke the appropriate tool when needed

Example:

```typescript
import { createLlm } from "@jaypie/llm";
import { roll } from "./tools/roll.js";

const llm = createLlm({
  provider: "openai",
  model: "gpt-4o",
  tools: [roll],
});

const response = await llm.chat([
  { role: "user", content: "Roll 3d20 and tell me the result" }
]);

console.log(response);
```

## Reference

For more information on creating and using LLM tools with Jaypie, refer to:

- [Jaypie LLM Package Documentation](https://github.com/jaypie/llm)
- [OpenAI Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)
