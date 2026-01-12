---
sidebar_position: 1
slug: /
---

# Jaypie

TypeScript framework for AWS Lambda and Express applications with CDK constructs and Datadog observability.

**Stack:** AWS Lambda, CDK, Express.js, Datadog, TypeScript, Node.js 20-25

## Install

```bash
npm install jaypie
```

## Quick Start

```typescript
import { expressHandler, log, NotFoundError } from "jaypie";

export default expressHandler(async (req, res) => {
  log.trace("[getUser] fetching");
  const user = await db.users.findById(req.params.id);
  if (!user) throw NotFoundError();
  return { data: user };
});
```

## What Jaypie Does

| Area | Description |
|------|-------------|
| Handlers | `expressHandler`, `lambdaHandler` with validate/setup/teardown lifecycle |
| Errors | Typed errors (`NotFoundError`, `BadRequestError`) with JSON:API format |
| Logging | Structured logging with trace IDs via `log.trace()`, `log.var()` |
| Infrastructure | CDK constructs: `JaypieLambda`, `JaypieApiGateway` with Datadog |
| Testing | Mock factories and custom matchers via `@jaypie/testkit` |

## Documentation

| Section | Description |
|---------|-------------|
| [Introduction](/docs/intro) | Getting started, installation, quick reference |
| [Core Concepts](/docs/core/handler-lifecycle) | Handler lifecycle, errors, logging, environment |
| [How-To Guides](/docs/guides/express-lambda) | Step-by-step guides for common tasks |
| [Packages](/docs/packages/jaypie) | API reference for each package |
| [Experimental](/docs/experimental/dynamodb) | Unstable packages in development |
| [Architecture](/docs/architecture/project-structure) | Project structure, patterns |
| [Contributing](/docs/contributing/development-process) | Development workflow |

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

## Links

- [Introduction](/docs/intro) - Full getting started guide
- [GitHub](https://github.com/finlaysonstudio/jaypie)
- [npm](https://www.npmjs.com/package/jaypie)
