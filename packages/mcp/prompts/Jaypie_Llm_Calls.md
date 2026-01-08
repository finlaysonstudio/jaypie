---
trigger: model_decision
description: Calling OpenAI and other provider LLM functions from Jaypie, specifically using Jaypie's Llm class and Llm.operate() function
---

# LLM Calls with Jaypie 🗣️

Streamline API calls with multi-model capabilities

## Types

```
export interface LlmProvider {
  operate(
    input: string | LlmHistory | LlmInputMessage | LlmOperateInput,
    options?: LlmOperateOptions,
  ): Promise<LlmOperateResponse>;
  send(
    message: string,
    options?: LlmMessageOptions,
  ): Promise<string | JsonObject>;
}

// Simplified input for files and images
type LlmOperateInput = LlmOperateInputContent[];
type LlmOperateInputContent = string | LlmOperateInputFile | LlmOperateInputImage;

interface LlmOperateInputFile {
  file: string;           // Path or filename
  bucket?: string;        // S3 bucket (uses CDK_ENV_BUCKET if omitted)
  pages?: number[];       // Extract specific PDF pages (omit = all)
  data?: string;          // Base64 data (skips file loading)
}

interface LlmOperateInputImage {
  image: string;          // Path or filename
  bucket?: string;        // S3 bucket (uses CDK_ENV_BUCKET if omitted)
  data?: string;          // Base64 data (skips file loading)
}

export interface LlmOperateOptions {
  data?: NaturalMap;
  explain?: boolean;
  format?: JsonObject | NaturalSchema | z.ZodType;
  history?: LlmHistory;
  hooks?: LlmOperateHooks;
  instructions?: string;
  model?: string;
  placeholders?: {
    input?: boolean;
    instructions?: boolean;
    system?: boolean;
  };
  providerOptions?: JsonObject;
  system?: string;
  tools?: LlmTool[] | Toolkit;
  turns?: boolean | number;
  user?: string;
}

export interface LlmOperateHooks {
  afterEachModelResponse?: (context: HookContext) => unknown | Promise<unknown>;
  afterEachTool?: (context: ToolHookContext) => unknown | Promise<unknown>;
  beforeEachModelRequest?: (context: HookContext) => unknown | Promise<unknown>;
  beforeEachTool?: (context: ToolHookContext) => unknown | Promise<unknown>;
  onRetryableModelError?: (context: ErrorHookContext) => unknown | Promise<unknown>;
  onToolError?: (context: ToolErrorContext) => unknown | Promise<unknown>;
  onUnrecoverableModelError?: (context: ErrorHookContext) => unknown | Promise<unknown>;
}

export interface LlmOperateResponse {
  content?: string | JsonObject;
  error?: LlmError;
  history: LlmHistory;
  model?: string;
  output: LlmOutput;
  provider?: string;
  reasoning: string[];
  responses: JsonReturn[];
  status: LlmResponseStatus;
  usage: LlmUsage;
}

// LlmUsage is an array of usage items (one per model call in multi-turn)
type LlmUsage = LlmUsageItem[];

interface LlmUsageItem {
  input: number;
  output: number;
  reasoning: number;
  total: number;
  model?: string;
  provider?: string;
}
```

## Declaring an Llm

```
import { Llm } from "jaypie";

const llm = new Llm();

const result = await llm.operate("Give me advice on Yahtzee");
```

## Providers and Models

Available providers: `anthropic`, `gemini`, `openai`, `openrouter`

```typescript
import { Llm, PROVIDER } from "jaypie";

// Using provider name (uses provider's default model)
const llm = new Llm("anthropic");

// Using model name directly (provider auto-detected)
const llm2 = new Llm("claude-sonnet-4-0");
const llm3 = new Llm("gpt-4.1");
const llm4 = new Llm("gemini-2.5-flash");

// Using provider with specific model
const llm5 = new Llm("openai", { model: "gpt-4.1" });

// Using constants
const llm6 = new Llm(PROVIDER.OPENAI.NAME, {
  model: PROVIDER.OPENAI.MODEL.LARGE
});
```

### Model Aliases

Each provider has standard aliases: `DEFAULT`, `SMALL`, `LARGE`, `TINY`

| Provider | DEFAULT | LARGE | SMALL | TINY |
|----------|---------|-------|-------|------|
| anthropic | claude-opus-4-1 | claude-opus-4-1 | claude-sonnet-4-0 | claude-3-5-haiku-latest |
| gemini | gemini-3-pro-preview | gemini-3-pro-preview | gemini-3-flash-preview | gemini-2.0-flash-lite |
| openai | gpt-4.1 | gpt-4.1 | gpt-4.1-mini | gpt-4.1-nano |
| openrouter | z-ai/glm-4.7 | z-ai/glm-4.7 | z-ai/glm-4.7 | z-ai/glm-4.7 |

### Provider Constants

```typescript
import { PROVIDER } from "jaypie";

// Anthropic models
PROVIDER.ANTHROPIC.MODEL.CLAUDE_OPUS_4      // claude-opus-4-1
PROVIDER.ANTHROPIC.MODEL.CLAUDE_SONNET_4    // claude-sonnet-4-0
PROVIDER.ANTHROPIC.MODEL.CLAUDE_3_HAIKU     // claude-3-5-haiku-latest

// Gemini models
PROVIDER.GEMINI.MODEL.GEMINI_3_PRO_PREVIEW  // gemini-3-pro-preview
PROVIDER.GEMINI.MODEL.GEMINI_2_5_FLASH      // gemini-2.5-flash
PROVIDER.GEMINI.MODEL.GEMINI_2_0_FLASH      // gemini-2.0-flash

// OpenAI models
PROVIDER.OPENAI.MODEL.GPT_4_1               // gpt-4.1
PROVIDER.OPENAI.MODEL.GPT_4_O               // gpt-4o
PROVIDER.OPENAI.MODEL.O3                    // o3
PROVIDER.OPENAI.MODEL.O4_MINI               // o4-mini
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

## Files and Images

Use `LlmOperateInput` array syntax to send files and images with automatic loading and provider translation:

```javascript
import { Llm } from "jaypie";

const llm = new Llm("openai");

// Image from local filesystem
const imageResult = await llm.operate([
  "Extract text from this image",
  { image: "/path/to/photo.png" }
]);

// PDF from local filesystem
const pdfResult = await llm.operate([
  "Summarize this document",
  { file: "/path/to/document.pdf" }
]);

// From S3 bucket (uses CDK_ENV_BUCKET if bucket omitted)
const s3Result = await llm.operate([
  "Analyze this file",
  { file: "documents/report.pdf", bucket: "my-bucket" }
]);

// Extract specific PDF pages
const pagesResult = await llm.operate([
  "Read pages 1-3",
  { file: "large-doc.pdf", pages: [1, 2, 3] }
]);

// With pre-loaded base64 data (skips file loading)
const base64Result = await llm.operate([
  "Describe this image",
  { image: "photo.jpg", data: base64String }
]);

// Multiple files and text
const multiResult = await llm.operate([
  "Compare these documents",
  { file: "doc1.pdf" },
  { file: "doc2.pdf" },
  "Focus on the methodology section"
]);
```

### File Resolution Order

1. If `data` is present → uses base64 directly
2. If `bucket` is present → loads from S3
3. If `CDK_ENV_BUCKET` env var exists → loads from that S3 bucket
4. Otherwise → loads from local filesystem (relative to process.cwd())

### Supported Image Extensions

Files with these extensions are treated as images: `png`, `jpg`, `jpeg`, `gif`, `webp`, `svg`, `bmp`, `ico`, `tiff`, `avif`

## Streaming

Use `Llm.stream()` for real-time streaming responses:

```javascript
import { Llm } from "jaypie";

const llm = new Llm("anthropic");

// Basic streaming
for await (const chunk of llm.stream("Tell me a story")) {
  if (chunk.type === "text") {
    process.stdout.write(chunk.content);
  }
}

// Streaming with tools
for await (const chunk of llm.stream("Roll 3d6", { tools: [roll] })) {
  switch (chunk.type) {
    case "text":
      console.log("Text:", chunk.content);
      break;
    case "tool_call":
      console.log("Calling tool:", chunk.toolCall.name);
      break;
    case "tool_result":
      console.log("Tool result:", chunk.toolResult.result);
      break;
    case "done":
      console.log("Usage:", chunk.usage);
      break;
    case "error":
      console.error("Error:", chunk.error);
      break;
  }
}

// Static method
for await (const chunk of Llm.stream("Hello", { llm: "openai" })) {
  // ...
}
```

### Stream Chunk Types

```typescript
type LlmStreamChunk =
  | LlmStreamChunkText      // { type: "text", content: string }
  | LlmStreamChunkToolCall  // { type: "tool_call", toolCall: { id, name, arguments } }
  | LlmStreamChunkToolResult // { type: "tool_result", toolResult: { id, name, result } }
  | LlmStreamChunkDone      // { type: "done", usage: LlmUsage }
  | LlmStreamChunkError;    // { type: "error", error: { status, title, detail? } }
```

### Streaming to Express

Use `createExpressStream` to pipe LLM streams to Express responses:

```javascript
import { expressStreamHandler, Llm, createExpressStream } from "jaypie";

const chatRoute = expressStreamHandler(async (req, res) => {
  const llm = new Llm("anthropic");
  const stream = llm.stream(req.body.prompt);
  await createExpressStream(stream, res);
});

app.post("/chat", chatRoute);
```

### Streaming to Lambda

Use `createLambdaStream` with Lambda Response Streaming:

```javascript
import { lambdaStreamHandler, Llm, createLambdaStream } from "jaypie";

const handler = awslambda.streamifyResponse(
  lambdaStreamHandler(async (event, context) => {
    const llm = new Llm("openai");
    const stream = llm.stream(event.prompt);
    await createLambdaStream(stream, context.responseStream);
  })
);
```

### JaypieStream Wrapper

Use `JaypieStream` or `createJaypieStream` for fluent piping:

```javascript
import { createJaypieStream, Llm } from "jaypie";

const llm = new Llm("gemini");
const stream = createJaypieStream(llm.stream("Hello"));

// Pipe to Express
await stream.toExpress(res);

// Or pipe to Lambda
await stream.toLambda(responseStream);

// Or iterate manually
for await (const chunk of stream) {
  console.log(chunk);
}
```

## Hooks

Use hooks to intercept and observe the LLM lifecycle:

```javascript
const result = await llm.operate("Process this", {
  hooks: {
    beforeEachModelRequest: ({ input, options, providerRequest }) => {
      console.log("About to call model with:", providerRequest);
    },
    afterEachModelResponse: ({ content, usage, providerResponse }) => {
      console.log("Model responded:", content);
      console.log("Tokens used:", usage);
    },
    beforeEachTool: ({ toolName, args }) => {
      console.log(`Calling tool ${toolName} with:`, args);
    },
    afterEachTool: ({ toolName, result }) => {
      console.log(`Tool ${toolName} returned:`, result);
    },
    onToolError: ({ toolName, error }) => {
      console.error(`Tool ${toolName} failed:`, error);
    },
    onRetryableModelError: ({ error }) => {
      console.warn("Retrying after error:", error);
    },
    onUnrecoverableModelError: ({ error }) => {
      console.error("Fatal error:", error);
    },
  },
});
```

## Toolkit

Group tools with `Toolkit` for additional features:

```javascript
import { Llm, Toolkit } from "jaypie";

const toolkit = new Toolkit([roll, weather, time], {
  explain: true,  // Add __Explanation param to tools
  log: true,      // Log tool calls (default)
});

// Extend toolkit with more tools
toolkit.extend([anotherTool], { replace: true });

const result = await llm.operate("Roll dice and check weather", {
  tools: toolkit,
});
```

## Footnotes

Llm.operate(input, options)
The Llm.send function is an older version replaced by operate.
Llm.send's `response` option is `format` in operate.
