# @jaypie/llm

Large language model abstraction with multi-provider support.

## Overview

`@jaypie/llm` provides a unified interface for working with large language models, including:

- Multi-provider support (OpenAI, Anthropic)
- Tool calling and function execution
- Structured output generation
- Conversation history management
- Multi-turn reasoning

## Installation

```bash
npm install @jaypie/llm
```

## Key Features

### LLM Interface

Unified interface for multiple LLM providers:

```javascript
import { Llm } from "@jaypie/llm";

const llm = new Llm("gpt-4o");
const response = await llm.send("What is the capital of France?");
```

### Tool Calling

Execute functions during LLM conversations:

```javascript
import { Llm, toolkit } from "@jaypie/llm";

const llm = new Llm("gpt-4o");
const response = await llm.operate("What's the weather in Paris?", {
  tools: [toolkit.weather],
  turns: 12,
});
```

### Structured Outputs

Generate structured data with natural schema syntax:

```javascript
const response = await llm.send("Extract user information", {
  format: { name: String, age: Number, email: String },
});
```

### Built-in Tools

Pre-configured tools for common tasks:

- `time` - Get current time
- `weather` - Get weather information
- `random` - Generate random numbers
- `roll` - Roll dice

## API Documentation

_API documentation will be generated from TypeScript definitions._

## Related Packages

- [@jaypie/core](./core) - Core utilities
- [@jaypie/aws](./aws) - AWS integrations
- [@jaypie/testkit](./testkit) - Testing utilities
