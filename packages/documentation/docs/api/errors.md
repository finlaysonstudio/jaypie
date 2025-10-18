# @jaypie/errors

Error class definitions for Jaypie applications.

## Overview

`@jaypie/errors` provides a comprehensive set of error classes for common HTTP status codes and application errors:

- HTTP error classes (400, 401, 403, 404, 500, etc.)
- Base `JaypieError` class
- Error factory functions
- JSON:API error formatting

## Installation

```bash
npm install @jaypie/errors
```

## Key Features

### Error Classes

Pre-defined error classes for common HTTP status codes:

```javascript
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  InternalError,
} from "@jaypie/errors";

throw new BadRequestError("Invalid input");
throw new NotFoundError("User not found");
throw new InternalError("Database connection failed");
```

### JaypieError Base Class

All errors extend the base `JaypieError` class, which includes:

- `statusCode` - HTTP status code
- `message` - Error message
- JSON:API formatting
- Logging integration

### Error Factory

Create custom errors with specific status codes:

```javascript
import { errorFactory } from "@jaypie/errors";

const CustomError = errorFactory(418, "I'm a teapot");
throw new CustomError("Cannot brew coffee");
```

## API Documentation

_API documentation will be generated from TypeScript definitions._

## Related Packages

- [@jaypie/core](./core) - Core utilities
- [@jaypie/express](./express) - Express.js integration
- [@jaypie/lambda](./lambda) - AWS Lambda integration
