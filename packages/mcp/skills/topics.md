---
description: Topic index and cross-reference
---

# Topic Index

Quick reference for finding the right skill for your task.

## By Task

### Starting a New Project
- `skill("jaypie")` - Jaypie overview
- `skill("style")` - Code conventions
- `skill("cdk")` - Infrastructure setup

### Writing Code
- `skill("style")` - Code style
- `skill("errors")` - Error handling
- `skill("services")` - Service patterns
- `skill("models")` - Data models

### Testing
- `skill("tests")` - Vitest patterns
- `skill("mocks")` - @jaypie/testkit mocks

### Deploying
- `skill("cdk")` - CDK constructs
- `skill("cicd")` - GitHub Actions
- `skill("variables")` - Environment config

### Debugging
- `skill("debugging")` - Debug techniques
- `skill("logs")` - Log searching
- `skill("datadog")` - Observability tools

### AWS Integration
- `skill("aws")` - AWS tools overview
- `skill("dynamodb")` - DynamoDB patterns
- `skill("secrets")` - Secret management

## By Package

### jaypie (main package)
- `skill("jaypie")` - Overview
- `skill("errors")` - Error types
- `skill("logs")` - Logging
- `skill("secrets")` - Secret access

### @jaypie/constructs
- `skill("cdk")` - CDK constructs

### @jaypie/testkit
- `skill("mocks")` - Mock patterns
- `skill("tests")` - Test patterns

### @jaypie/fabric
- `skill("fabric")` - Service patterns
- `skill("services")` - Service layer

### Legacy Packages
- `skill("legacy")` - Deprecated patterns

## By Concept

### Error Handling
- `skill("errors")` - Error types and usage

### Environment Configuration
- `skill("variables")` - Environment variables
- `skill("secrets")` - Secret management

### Infrastructure
- `skill("cdk")` - CDK constructs
- `skill("aws")` - AWS integration
- `skill("dns")` - Domain configuration

### Observability
- `skill("logs")` - Logging patterns
- `skill("datadog")` - Datadog integration
- `skill("debugging")` - Debug techniques

### Data
- `skill("models")` - Data models and types
- `skill("dynamodb")` - DynamoDB patterns

## Quick Answers

### "How do I throw an error?"
```typescript
import { NotFoundError } from "jaypie";
throw new NotFoundError("Item not found");
```
See: `skill("errors")`

### "How do I mock Jaypie in tests?"
```typescript
vi.mock("jaypie", async () => {
  const { mockJaypie } = await import("@jaypie/testkit");
  return mockJaypie(vi);
});
```
See: `skill("mocks")`

### "How do I get a secret?"
```typescript
import { getSecret } from "jaypie";
const apiKey = await getSecret("my-api-key");
```
See: `skill("secrets")`

### "How do I log with context?"
```typescript
import { log } from "jaypie";
log.info("Operation completed", { userId, duration });
```
See: `skill("logs")`
