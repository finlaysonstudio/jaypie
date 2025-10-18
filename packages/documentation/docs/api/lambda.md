# @jaypie/lambda

AWS Lambda wrappers and lifecycle management.

## Overview

`@jaypie/lambda` provides AWS Lambda integration for the Jaypie framework, including:

- Lambda handler wrapper with lifecycle management
- Event/context integration
- Error handling for Lambda environments

## Installation

```bash
npm install @jaypie/lambda
```

## Key Features

### Lambda Handler

Wraps AWS Lambda functions with Jaypie's handler lifecycle:

```javascript
import { lambdaHandler } from "@jaypie/lambda";

export const handler = lambdaHandler(async (event, context) => {
  // Handler logic
  return { statusCode: 200, body: JSON.stringify({ success: true }) };
});
```

### Lifecycle Integration

The `lambdaHandler` integrates AWS Lambda event and context with the standard handler lifecycle:

1. **Validate** - Event validation
2. **Setup** - Resource initialization
3. **Handler** - Business logic
4. **Teardown** - Cleanup (always runs)

### Error Handling

Automatic error handling and formatting for Lambda responses.

## API Documentation

_API documentation will be generated from TypeScript definitions._

## Related Packages

- [@jaypie/core](./core) - Core utilities
- [@jaypie/express](./express) - Express.js integration
- [@jaypie/aws](./aws) - AWS service integrations
