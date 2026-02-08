---
sidebar_position: 99
---

# Jaypie Criticisms


## Overview

No framework is perfect. This page honestly documents Jaypie's limitations, trade-offs, and situations where other tools may be better choices.

## When NOT to Use Jaypie

### Simple Lambda Functions

If you're writing a single Lambda function with no lifecycle needs, vanilla code may be simpler:

```typescript
// This doesn't need Jaypie
export const handler = async (event) => {
  return { statusCode: 200, body: "Hello" };
};
```

### Non-AWS Environments

Jaypie is designed for AWS Lambda and Express on Lambda. If you're deploying to:
- Vercel
- Cloudflare Workers
- Google Cloud Functions
- Azure Functions

Consider native tooling for those platforms.

### Non-TypeScript Projects

Jaypie is TypeScript-first. While JavaScript works, you lose significant value without types.

## Valid Criticisms

### Learning Curve

**Criticism:** Jaypie has opinions that take time to learn.

**Response:** True. The handler lifecycle, error patterns, and logging conventions require understanding. The investment pays off in consistency across large projects.

### Vendor Lock-in

**Criticism:** Jaypie ties you to AWS and Datadog.

**Response:** Partially true. Core utilities (`force`, `uuid`, errors) work anywhere. Handlers and constructs are AWS-specific. Logging works without Datadog but loses features.

### Opinionated

**Criticism:** Jaypie's opinions may not match your preferences.

**Response:** By design. Jaypie trades flexibility for consistency. If you disagree with the patterns, use individual packages or other tools.

### Documentation Gaps

**Criticism:** Some packages lack documentation.

**Response:** Work in progress. Experimental packages especially need better docs. Contributions welcome.

### Breaking Changes

**Criticism:** Pre-1.0 packages have breaking changes.

**Response:** True. Experimental packages (`@jaypie/dynamodb`, `@jaypie/fabric`) are unstable. Core packages (`jaypie`, `@jaypie/express`, `@jaypie/lambda`) are stable.

## Alternatives

### Error Handling

| Alternative | Comparison |
|-------------|------------|
| `http-errors` | More HTTP codes, no JSON:API format |
| `boom` | Hapi ecosystem, similar concept |
| Custom errors | More control, more code |

### Handler Wrappers

| Alternative | Comparison |
|-------------|------------|
| `middy` | More middleware, less opinionated |
| `@aws-lambda-powertools` | AWS official, Java/Python focus |
| Raw Lambda | Maximum control |

### Logging

| Alternative | Comparison |
|-------------|------------|
| `pino` | Faster, less structured |
| `winston` | More transports, more config |
| `console` | Simple, no structure |

### CDK Constructs

| Alternative | Comparison |
|-------------|------------|
| `@aws-cdk/*` | Official, more verbose |
| `projen` | Project generator approach |
| Custom constructs | Full control |

## Known Issues

### Type Inference

Some complex handler types don't infer perfectly. Use explicit types when needed:

```typescript
expressHandler<MyRequestType, MyResponseType>(async (req, res) => {
  // ...
});
```

### ESM/CJS Interop

Jaypie is ESM-only. Legacy CJS projects may need configuration changes.

### Test Setup

Mocking requires specific setup. Some developers find the pattern verbose.

## Feedback

If you have criticisms not listed here, please:

1. [Open an issue](https://github.com/finlaysonstudio/jaypie/issues)
2. Propose improvements
3. Contribute fixes

Jaypie improves through honest feedback.
