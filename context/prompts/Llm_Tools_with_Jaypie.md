# LLM Tools with Jaypie 🔧

Extend LLM capabilities with tools for external actions and data retrieval

## Goal

Create and integrate tools that enable LLMs to perform specific functions beyond their training data

## Interface

Implement the `LlmTool` interface:

```typescript
interface LlmTool {
  description: string;
  name: string;
  parameters: JsonObject;
  type: "function" | string;
  call: (args?: JsonObject) => Promise<AnyValue> | AnyValue;
}
```

Properties:
- `description`: Clear explanation of tool functionality
- `name`: Unique identifier
- `parameters`: JSON Schema defining input parameters
- `type`: Usually "function" (OpenAI convention)
- `call`: Implementation function executed on invocation

## Example: Dice Roller

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

const llm = new Llm({
  provider: "openai",
  model: "gpt-4o"
});

const response = await llm.operate([
  { role: "user", content: "Roll 3d20 and tell me the result" },
  {
    tools: [roll],
  },
]);
```

## References

- [Jaypie LLM Package](https://github.com/finlaysonstudio/jaypie)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
