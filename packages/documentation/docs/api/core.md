# @jaypie/core

Foundation package providing errors, logging, validation, and HTTP utilities.

## Overview

`@jaypie/core` is the foundational package of the Jaypie framework. It provides essential utilities for:

- Error handling and custom error classes
- Structured JSON logging
- Request/response validation
- HTTP utilities and constants
- Handler lifecycle management

## Installation

```bash
npm install @jaypie/core
```

## Key Features

### Handler Lifecycle

The core package provides `jaypieHandler`, which manages a four-phase lifecycle:

1. **Validate** - Request validation
2. **Setup** - Resource initialization
3. **Handler** - Business logic
4. **Teardown** - Cleanup (always runs)

### Logging

Structured JSON logger with multiple log levels:

```javascript
import { log } from "@jaypie/core";

log.info("Application started");
log.error("An error occurred", { error });
log.debug("Debug information", { data });
```

### Validation

Type validation utilities:

```javascript
import { validate } from "@jaypie/core";

validate.string(value);
validate.array(value);
validate.optional.number(value);
```

### Error Handling

Custom error classes for common HTTP status codes:

```javascript
import { BadRequestError, NotFoundError } from "@jaypie/core";

throw new BadRequestError("Invalid input");
throw new NotFoundError("Resource not found");
```

## API Documentation

_API documentation will be generated from TypeScript definitions._

## Related Packages

- [@jaypie/express](./express) - Express.js integration
- [@jaypie/lambda](./lambda) - AWS Lambda integration
- [@jaypie/errors](./errors) - Error class definitions
