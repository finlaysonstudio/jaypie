---
sidebar_position: 1
slug: /
---

# Jaypie

Complete-stack approach to multi-environment cloud application patterns. Aligns infrastructure, execution, and observability.

**Stack:** AWS/CDK, Datadog, TypeScript

## Install

```bash
npm install jaypie
```

## Usage

```typescript
import { expressHandler, log } from "jaypie";

export default expressHandler(async (req, res) => {
  log.info("Request received");
  return { message: "Hello" };
});
```

## What It Does

| Area | Description |
|------|-------------|
| Handler Lifecycle | `lambdaHandler`, `expressHandler` share validate/setup/execute/teardown. Automatic secrets loading. |
| Infrastructure | CDK constructs: `JaypieLambda`, `JaypieDistribution`, `JaypieEnvSecret`. Shared env vars and tagging. |
| Observability | Request-scoped logging with trace IDs. Datadog Lambda layers via constructs. `submitMetric()`. |
| Errors | `@jaypie/errors`: `BadRequestError`, `NotFoundError`, etc. JSON:API format. |
| Testing | `@jaypie/testkit`: Mock factories for all packages. Custom matchers. |

## Core Packages

| Package | Purpose |
|---------|---------|
| `jaypie` | Main package: re-exports aws, errors, express, kit, lambda, logger |
| `@jaypie/constructs` | CDK constructs with Datadog integration |
| `@jaypie/errors` | JSON:API error classes |
| `@jaypie/eslint` | ESLint configuration |
| `@jaypie/express` | Express handler wrapper |
| `@jaypie/kit` | Utilities: force, uuid, constants |
| `@jaypie/lambda` | Lambda handler wrapper |
| `@jaypie/llm` | LLM provider abstraction |
| `@jaypie/logger` | Structured logging |
| `@jaypie/repokit` | Repository tooling |
| `@jaypie/testkit` | Mocks and matchers |

## Experimental Packages

These packages are in active development. APIs may change.

| Package | Purpose |
|---------|---------|
| `@jaypie/dynamodb` | DynamoDB utilities and patterns |
| `@jaypie/fabricator` | Test data generation |
| `@jaypie/mcp` | Model Context Protocol server |
| `@jaypie/textract` | AWS Textract document processing |
| `@jaypie/vocabulary` | Vocabulary and text utilities |

## Common Patterns

### Type coercion

```typescript
import { force } from "jaypie";

force.boolean("true")     // true
force.number("42")        // 42
force.array(singleItem)   // [singleItem]
```

### UUID generation

```typescript
import { uuid } from "jaypie";
const id = uuid();
```

### Environment checks

```typescript
import { isProductionEnv, isLocalEnv } from "jaypie";

if (isProductionEnv()) {
  // production-only
}
```

## Links

- [Introduction](/docs/intro)
- [API Reference](/docs/api/kit)
- [GitHub](https://github.com/finlaysonstudio/jaypie)
