# LLM Calls with Jaypie 🗣️

Streamline API calls with multi-model capabilities

## Types

```
export interface LlmProvider {
  operate(
    input: string | LlmHistory | LlmInputMessage,
    options?: LlmOperateOptions,
  ): Promise<LlmOperateResponse>;
  send(
    message: string,
    options?: LlmMessageOptions,
  ): Promise<string | JsonObject>;
}

export interface LlmOperateOptions {
  data?: NaturalMap;
  explain?: boolean;
  format?: JsonObject | NaturalSchema | z.ZodType;
  history?: LlmHistory;
  instructions?: string;
  model?: string;
  placeholders?: {
    input?: boolean;
    instructions?: boolean;
    system?: boolean;
  };
  providerOptions?: JsonObject;
  system?: string;
  tools?: LlmTool[];
  turns?: boolean | number;
  user?: string;
}

export interface LlmOperateResponse {
  content?: string | JsonObject;
  error?: LlmError;
  history: LlmHistory;
  output: LlmOutput;
  responses: JsonReturn[];
  status: LlmResponseStatus;
  usage: LlmUsage;
}

interface LlmUsage {
  input: number;
  output: number;
  reasoning: number;
  total: number;
}
```

## Declaring an Llm

```
import { Llm } from "jaypie";

const llm = new Llm();

const result = await llm.operate("Give me advice on Yahtzee");
```

## "Operating" an Llm

operate takes an optional second object of options

```
import { Llm, toolkit } from "jaypie";

const result = await llm.operate("Take a Yahtzee turn and report the results", {
  format: {
    throws: Array,
    score: Number,
    category: String,
  },
  tools: [toolkit.roll]
});
```

data is an object that will be used for variable replacements in input, instruction, and system.
explain will pass a rationale explaining its choice to the tool call.
format causes structured output to follow the provided schema.
history is an existing llm history.
Calls to the same instance automatically pass history.
instructions are one-time instructions.
placeholders object toggles what data applies to.
providerOptions passes additional options to the provider.
system is a permanent starting instruction.
See ./Llm_Tool_with_Jaypie.md for tool formats.
turns disables or restricts the number of turns that can be taken.
user tracks the end user

## Response

content is a convenience string for the model's response.
content will be an object when format was passed and the provider supports structured data.
error will include any errors.
output is just the output components of full responses.
responses are the complete responses.

## Footnotes

Llm.operate(input, options)
The Llm.send function is an older version replaced by operate.
