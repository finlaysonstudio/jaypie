---
sidebar_position: 1
slug: /
---

# Jaypie

TypeScript framework for AWS Lambda and Express applications with CDK constructs and Datadog observability.

**Stack:** AWS Lambda, CDK, Express.js, Datadog, TypeScript, Node.js 20-25

## Documentation

| Section | Description |
|---------|-------------|
| [Core Concepts](/docs/core/handler-lifecycle) | Handler lifecycle, errors, logging, environment |
| [How-To Guides](/docs/guides/express-lambda) | Step-by-step guides for common tasks |
| [Packages](/docs/packages/jaypie) | API reference for each package |
| [Experimental](/docs/experimental/dynamodb) | Unstable packages in development |
| [Architecture](/docs/architecture/project-structure) | Project structure, patterns |
| [Contributing](/docs/contributing/development-process) | Development workflow |

## Getting Started

**Use this section when:** starting with Jaypie, understanding what packages to install, or getting a quick reference for common patterns.

## What is Jaypie?

Jaypie is a TypeScript framework for AWS Lambda and Express applications with integrated CDK constructs and Datadog observability.

| Layer | Package | Purpose |
|-------|---------|---------|
| Infrastructure | `@jaypie/constructs` | CDK constructs for Lambda, API Gateway, CloudFront |
| Handlers | `@jaypie/express`, `@jaypie/lambda` | Handler wrappers with lifecycle and error formatting |
| Observability | `@jaypie/logger`, `@jaypie/datadog` | Structured logging, metrics |
| Testing | `@jaypie/testkit` | Mocks and matchers |
| Utilities | `@jaypie/kit`, `@jaypie/errors` | Type coercion, error classes |

## Installation

### Core (Most Projects)

```bash
npm install jaypie
```

### With CDK

```bash
npm install jaypie @jaypie/constructs aws-cdk-lib constructs
```

### With LLM

```bash
npm install jaypie @jaypie/llm
```

### Development

```bash
npm install -D @jaypie/testkit @jaypie/eslint @jaypie/repokit vitest
```

## Quick Reference

### Handler Pattern

```typescript
import { expressHandler, log, NotFoundError } from "jaypie";

export default expressHandler(
  async (req, res) => {
    log.trace("[getUser] fetching");
    const user = await db.users.findById(req.params.id);
    if (!user) throw NotFoundError();
    return { data: user };
  },
  {
    name: "getUser",
    secrets: ["MONGODB_URI"],
    validate: [(req) => req.params.id],
    setup: [async () => await connectDb()],
    teardown: [async () => await disconnectDb()],
  }
);
```

### Handler Options

| Option | Type | Purpose |
|--------|------|---------|
| `name` | `string` | Handler name for logging |
| `secrets` | `string[]` | Load from AWS Secrets Manager |
| `validate` | `Function[]` | Validation (throw or return false) |
| `setup` | `Function[]` | Run before handler |
| `teardown` | `Function[]` | Run after handler (always) |

### Response Mapping

| Return | Status |
|--------|--------|
| `object` | 200 |
| `null`/`undefined` | 204 |
| `true` | 201 |
| Thrown error | Error status |

## Error Classes

| Class | Status | Use When |
|-------|--------|----------|
| `BadRequestError` | 400 | Invalid input |
| `UnauthorizedError` | 401 | No/invalid auth |
| `ForbiddenError` | 403 | No permission |
| `NotFoundError` | 404 | Resource missing |
| `InternalError` | 500 | Server error |
| `ConfigurationError` | 500 | Missing config |
| `BadGatewayError` | 502 | External service error |
| `UnavailableError` | 503 | Service down |

```typescript
import { BadRequestError, NotFoundError } from "jaypie";

throw BadRequestError("Email required");
throw NotFoundError();
```

## Logging

| Level | Use Case |
|-------|----------|
| `trace` | Happy path |
| `debug` | Unexpected but handled |
| `info` | Significant events (rare) |
| `warn` | Concerning situations |
| `error` | Failures |

```typescript
import { log } from "jaypie";

log.trace("[functionName] starting");
log.var({ userId: "123" });  // Single key
log.debug("Cache miss");
log.error("Service failed");
```

## Utilities

### Type Coercion

```typescript
import { force } from "jaypie";

force.boolean("true");      // true
force.number("42");         // 42
force.array("item");        // ["item"]
force.string(null, "default"); // "default"
```

### Environment Checks

```typescript
import { isProductionEnv, isLocalEnv, isNodeTestEnv } from "jaypie";

if (isProductionEnv()) { /* production */ }
if (isLocalEnv()) { /* local dev */ }
if (isNodeTestEnv()) { /* testing */ }
```

### Other Utilities

```typescript
import { uuid, sleep, cloneDeep } from "jaypie";

const id = uuid();
await sleep(1000);
const copy = cloneDeep(original);
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `PROJECT_ENV` | Environment: local, sandbox, production |
| `PROJECT_KEY` | Project identifier |
| `LOG_LEVEL` | trace, debug, info, warn, error |
| `SECRET_*` | Secret references (fetched from Secrets Manager) |
| `CDK_ENV_QUEUE_URL` | Default SQS queue |
| `CDK_ENV_BUCKET` | Default S3 bucket |

## Testing Setup

**vitest.config.ts:**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["@jaypie/testkit/testSetup"],
  },
});
```

**Mock Jaypie:**

```typescript
import { vi } from "vitest";

vi.mock("jaypie", async () => {
  const testkit = await import("@jaypie/testkit/mock");
  return testkit;
});
```

**Custom Matchers:**

```typescript
expect(() => fn()).toThrowBadRequestError();
expect(() => fn()).toThrowNotFoundError();
expect(value).toMatchUuid();
```

## CDK Constructs

```typescript
import { JaypieLambda, JaypieApiGateway } from "@jaypie/constructs";

const api = new JaypieLambda(this, "Api", {
  code: "../api/dist",
  handler: "handler.handler",
  secrets: [mongoSecret],
});

new JaypieApiGateway(this, "Gateway", {
  handler: api,
  host: "api.example.com",
  zone: "example.com",
});
```

## LLM Integration

```typescript
import Llm from "@jaypie/llm";

const response = await Llm.operate("What is 2+2?", {
  model: "claude-sonnet-4",
});

// Streaming
for await (const chunk of Llm.stream("Tell me a story")) {
  process.stdout.write(chunk.content || "");
}
```

## Packages

### Core

| Package | Purpose |
|---------|---------|
| [`jaypie`](/docs/packages/jaypie) | Main package: re-exports express, lambda, errors, kit, logger |
| [`@jaypie/express`](/docs/packages/express) | Express handler wrapper |
| [`@jaypie/lambda`](/docs/packages/lambda) | Lambda handler wrapper |
| [`@jaypie/errors`](/docs/packages/errors) | JSON:API error classes |
| [`@jaypie/logger`](/docs/packages/logger) | Structured logging |
| [`@jaypie/kit`](/docs/packages/kit) | Utilities: force, uuid, sleep |

### Infrastructure

| Package | Purpose |
|---------|---------|
| [`@jaypie/constructs`](/docs/packages/constructs) | CDK constructs with Datadog |
| [`@jaypie/llm`](/docs/packages/llm) | LLM provider abstraction |

### Development

| Package | Purpose |
|---------|---------|
| [`@jaypie/testkit`](/docs/packages/testkit) | Mocks and matchers |
| [`@jaypie/eslint`](/docs/packages/eslint) | ESLint configuration |
| [`@jaypie/repokit`](/docs/packages/repokit) | Repository tooling |

### Experimental

| Package | Purpose |
|---------|---------|
| [`@jaypie/dynamodb`](/docs/experimental/dynamodb) | DynamoDB single-table patterns |
| [`@jaypie/fabricator`](/docs/experimental/fabricator) | Test data generation |
| [`@jaypie/mcp`](/docs/experimental/mcp) | Model Context Protocol server |
| [`@jaypie/textract`](/docs/experimental/textract) | AWS Textract utilities |
| [`@jaypie/vocabulary`](/docs/experimental/vocabulary) | Service handler adapters |

## Next Steps

| Goal | Page |
|------|------|
| Understand handlers | [Handler Lifecycle](/docs/core/handler-lifecycle) |
| Build Express API | [Express on Lambda](/docs/guides/express-lambda) |
| Set up CDK | [CDK Infrastructure](/docs/guides/cdk-infrastructure) |
| Write tests | [Testing](/docs/guides/testing) |
| Add LLM | [LLM Integration](/docs/guides/llm-integration) |
| CI/CD setup | [CI/CD](/docs/guides/cicd) |

## Links

- [GitHub](https://github.com/finlaysonstudio/jaypie)
- [npm](https://www.npmjs.com/package/jaypie)
