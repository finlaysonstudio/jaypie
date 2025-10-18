# @jaypie/testkit

Test utilities and mocks for Jaypie applications.

## Overview

`@jaypie/testkit` provides comprehensive testing utilities, including:

- Mocks for all Jaypie services
- Custom Vitest matchers
- Test helpers and utilities
- Mock creation utilities

## Installation

```bash
npm install --save-dev @jaypie/testkit
```

## Key Features

### Service Mocks

Complete mocking system for all Jaypie services:

```javascript
import { mock } from "@jaypie/testkit";

// Mock LLM
mock.Llm.operate();

// Mock Express handler
const app = mock.expressHandler(handler);

// Mock Datadog metrics
mock.submitMetric();
```

### Custom Matchers

Vitest matchers for Jaypie-specific assertions:

```javascript
import { toThrowJaypieError } from "@jaypie/testkit";

expect.extend({ toThrowJaypieError });

expect(() => {
  throw new BadRequestError("Invalid input");
}).toThrowJaypieError(BadRequestError);
```

### Mock Utilities

Create custom mocks with fallback behavior:

```javascript
import { createMockWrappedFunction } from "@jaypie/testkit";

const mockFn = createMockWrappedFunction(originalFn, {
  fallback: "default value",
});
```

### Logger Mocks

Mock logger for testing logging behavior:

```javascript
import { mockLogFactory, spyLog, restoreLog } from "@jaypie/testkit";

const mockLog = mockLogFactory();
spyLog(log);
// ... test code ...
restoreLog(log);
```

## API Documentation

_API documentation will be generated from TypeScript definitions._

## Related Packages

- [@jaypie/core](./core) - Core utilities
- [@jaypie/express](./express) - Express.js integration
- [@jaypie/llm](./llm) - LLM utilities
