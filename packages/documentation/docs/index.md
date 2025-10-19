---
sidebar_position: 1
slug: /
---

# Jaypie

**Event-driven JavaScript library for building serverless applications on AWS**

Jaypie is an opinionated library that embodies a "JavaScript Only" philosophy, enabling developers to use a single language across backend, infrastructure, and tooling.

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
