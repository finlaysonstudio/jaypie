# @jaypie/errors

Error utilities for Jaypie applications. Provides typed HTTP errors with JSON:API-compliant response formatting.

## Package Structure

```
src/
├── index.ts                 # Public exports
├── baseErrors.ts            # JaypieError base class
├── errors.ts                # Pre-configured error classes
├── errorFactory.ts          # Factory for creating error classes
├── isJaypieError.ts         # Type guard function
├── jaypieErrorFromStatus.ts # Create error from HTTP status code
└── types.ts                 # Constants and TypeScript interfaces
```

## Core Concepts

### JaypieError Base Class

All errors extend `JaypieError` which provides:
- `status`: HTTP status code
- `title`: Human-readable error title
- `detail`: Error message (same as `message`)
- `isJaypieError`: Always `true` for identification
- `isProjectError`: Legacy alias for `isJaypieError`
- `json()`: Returns JSON:API error object
- `body()`: Returns JSON:API error response body

### Available Errors

**Standard HTTP Errors:**
- `BadGatewayError` (502)
- `BadRequestError` (400)
- `ForbiddenError` (403)
- `GatewayTimeoutError` (504)
- `GoneError` (410)
- `InternalError` (500)
- `MethodNotAllowedError` (405)
- `NotFoundError` (404)
- `TeapotError` (418)
- `TooManyRequestsError` (429)
- `UnauthorizedError` (401)
- `UnavailableError` (503)

**Special Errors:**
- `ConfigurationError` (500) - Application configuration issues
- `CorsError` (401) - CORS validation failures
- `IllogicalError` (500) - Illogical code paths
- `NotImplementedError` (400) - Unimplemented features
- `RejectedError` (403) - Request rejected before processing
- `UnhandledError` (500) - Unhandled exceptions
- `UnreachableCodeError` (500) - Code that should never execute

## Usage

```typescript
import {
  BadRequestError,
  ConfigurationError,
  isJaypieError,
  jaypieErrorFromStatus,
} from "@jaypie/errors";

// Throw with default message
throw new BadRequestError();

// Throw with custom message
throw new ConfigurationError("Missing required API_KEY");

// Errors can be called as functions (proxy pattern)
throw BadRequestError("Invalid input");

// Check if error is a Jaypie error
if (isJaypieError(error)) {
  return res.status(error.status).json(error.body());
}

// Create error from HTTP status code
const error = jaypieErrorFromStatus(404, "User not found");
```

## Use in Other Packages

This package is foundational and used throughout the monorepo:

- **@jaypie/core**: Re-exports errors, uses in argument validation
- **@jaypie/kit**: Handler error wrapping and chaos testing
- **@jaypie/lambda**: Error handling in Lambda handlers
- **@jaypie/express**: Error responses and CORS handling
- **@jaypie/llm**: Provider error handling
- **@jaypie/aws**: SQS/Secrets/Textract error handling
- **@jaypie/constructs**: CDK construct validation
- **@jaypie/testkit**: Mock patterns and `toThrowJaypieError` matcher

## Guidelines

- Never throw vanilla `Error`; always use a Jaypie error type
- Use `isJaypieError()` to check before accessing Jaypie-specific properties
- Prefer specific error types over generic `InternalError`
- Custom messages are optional; defaults are user-friendly
