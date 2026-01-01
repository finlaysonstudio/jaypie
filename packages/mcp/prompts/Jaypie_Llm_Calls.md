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

## Footnotes

Llm.operate(input, options)
The Llm.send function is an older version replaced by operate.
Llm.send's `response` option is `format` in operate.
