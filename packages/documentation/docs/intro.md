# Jaypie Documentation

Welcome to the Jaypie documentation! Jaypie is an event-driven JavaScript library for building serverless applications on AWS.

## What is Jaypie?

Jaypie is an opinionated library that embodies a "JavaScript Only" philosophy, enabling developers to use a single language across:

- **Backend**: Express.js, AWS Lambda
- **Infrastructure**: AWS CDK
- **Tooling**: Node.js ecosystem

## Core Features

### Unified Handler Lifecycle

Single `jaypieHandler` function manages validate → setup → handler → teardown phases for both Lambda and Express.

### Event-Driven Patterns

Pre-built CDK constructs encode best practices (S3→SQS→Lambda, API Gateway→Express).

### LLM-First

Native support for AI interactions with conversation history, tool calling, and multi-turn reasoning.

### Infrastructure as Code

All infrastructure defined in TypeScript via AWS CDK - no YAML or JSON configuration files.

### Comprehensive Testing

Complete test isolation with mocks for all external services via `@jaypie/testkit`.

## Getting Started

Install the main Jaypie package:

```bash
npm install @jaypie/jaypie
```

Or install individual packages as needed:

```bash
npm install @jaypie/core @jaypie/express @jaypie/lambda
```

## Package Overview

### Core Packages

- **[@jaypie/core](./api/core)** - Foundation: errors, logging, validation, HTTP utilities
- **[@jaypie/express](./api/express)** - Express.js handlers, CORS, routes
- **[@jaypie/lambda](./api/lambda)** - Lambda wrappers and lifecycle management

### Integration Packages

- **[@jaypie/aws](./api/aws)** - SQS, Textract, Secrets Manager integrations
- **[@jaypie/llm](./api/llm)** - LLM abstraction (OpenAI, Anthropic, tools)

### Utility Packages

- **[@jaypie/errors](./api/errors)** - Error class definitions
- **[@jaypie/testkit](./api/testkit)** - Test utilities and mocks

## Architecture

Jaypie follows an event-driven architecture centered around:

1. **Handler Lifecycle**: Consistent request/event processing across platforms
2. **Event Sources**: S3, SQS, API Gateway, and more
3. **Infrastructure**: CDK constructs for common patterns
4. **Observability**: Built-in logging and metrics

## Next Steps

- Explore the [API Reference](./api/core) for detailed package documentation
- Check out the [GitHub repository](https://github.com/finlaysonstudio/jaypie)
- View packages on [npm](https://www.npmjs.com/package/@jaypie/jaypie)
