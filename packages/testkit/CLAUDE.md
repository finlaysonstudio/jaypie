# packages/testkit

Test utilities and mocks for Jaypie packages. Provides custom matchers, mock factories, and test helpers for vitest.

## Exports

### Main Entry (`@jaypie/testkit`)

```typescript
import {
  jsonApiErrorSchema,
  jsonApiSchema,
  LOG,
  matchers,
  mockLogFactory,
  restoreLog,
  spyLog,
  sqsTestRecords,
} from "@jaypie/testkit";
```

### Mock Entry (`@jaypie/testkit/mock`)

```typescript
import mock, {
  // Errors (all are vitest mocks wrapping real error classes)
  BadGatewayError,
  BadRequestError,
  ConfigurationError,
  // ... all Jaypie errors

  // Core utilities
  cloneDeep,
  envBoolean,
  force,
  jaypieHandler,
  log,
  sleep,
  uuid,

  // Express
  expressHandler,
  expressStreamHandler,
  cors,

  // Lambda
  lambdaHandler,

  // LLM
  llm,
  createMockTool,

  // AWS
  getMessages,
  getSecret,
  sendMessage,
  textractDocument,
} from "@jaypie/testkit/mock";
```

## Directory Structure

```
src/
├── __tests__/           # Package tests
├── matchers/            # Custom vitest matchers
│   ├── toBeCalledAboveTrace.matcher.ts
│   ├── toBeCalledWithInitialParams.matcher.ts
│   ├── toBeClass.matcher.ts
│   ├── toBeJaypieError.matcher.ts
│   ├── toBeMockFunction.matcher.ts
│   ├── toMatch.matcher.ts      # UUID, JWT, Base64, MongoId matchers
│   ├── toThrowError.matcher.ts
│   └── toThrowJaypieError.matcher.ts
├── mock/                # Mock implementations
│   ├── aws.ts          # getMessages, getSecret, sendMessage, textractDocument
│   ├── core.ts         # Errors, jaypieHandler, force, uuid, log
│   ├── datadog.ts      # Datadog mocks
│   ├── express.ts      # expressHandler, expressStreamHandler, routes
│   ├── kit.ts          # Kit utilities
│   ├── lambda.ts       # lambdaHandler
│   ├── llm.ts          # llm, createMockTool
│   ├── logger.ts       # Logger mocks
│   ├── mongoose.ts     # Mongoose mocks
│   ├── textract.ts     # AWS Textract mocks
│   └── utils.ts        # Mock factory utilities
├── types/              # TypeScript declarations
├── constants.ts        # LOG constant
├── index.ts            # Main exports
├── jsonApiSchema.module.ts
├── matchers.module.ts  # Combines all matchers + jest-extended
├── mockLog.module.ts   # Log spying utilities
├── placeholders.ts     # Template placeholder utility
└── sqsTestRecords.function.ts
```

## Usage Patterns

### Setup Matchers

```typescript
// vitest.config.ts or test setup file
import { expect } from "vitest";
import { matchers } from "@jaypie/testkit";

expect.extend(matchers);
```

Or use the provided setup file:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ["@jaypie/testkit/testSetup"],
  },
});
```

### Mocking Jaypie Modules

```typescript
// In test files - mock entire jaypie package
vi.mock("jaypie", async () => {
  const testkit = await import("@jaypie/testkit/mock");
  return testkit;
});

// Or mock specific packages
vi.mock("@jaypie/express", async () => {
  const testkit = await import("@jaypie/testkit/mock");
  return {
    expressHandler: testkit.expressHandler,
  };
});
```

### Custom Matchers

```typescript
// Error matchers
expect(() => fn()).toThrowJaypieError();
expect(() => fn()).toThrowBadRequestError();
expect(() => fn()).toThrowNotFoundError();

// Type matchers
expect(MyClass).toBeClass();
expect(mockFn).toBeMockFunction();
expect(mockFn).toBeCalledAboveTrace();

// Format matchers
expect(value).toMatchUuid();
expect(value).toMatchUuid4();
expect(value).toMatchJwt();
expect(value).toMatchBase64();
expect(value).toMatchMongoId();
expect(value).toMatchSignedCookie();

// Schema matchers (from jest-json-schema)
expect(response).toMatchSchema(jsonApiSchema);
```

### Mock Utilities

```typescript
import {
  createMockFunction,
  createMockResolvedFunction,
  createMockReturnedFunction,
  createMockWrappedFunction,
  createMockWrappedObject,
  createMockError,
  createMockTool,
} from "@jaypie/testkit/mock";

// All mocks have _jaypie: true property for identification
const mock = createMockFunction((x) => x * 2);
expect(mock._jaypie).toBe(true);
```

### Log Spying

```typescript
import { log } from "jaypie";
import { spyLog, restoreLog } from "@jaypie/testkit";

beforeEach(() => {
  spyLog(log);
});

afterEach(() => {
  restoreLog(log);
});

it("logs correctly", () => {
  myFunction();
  expect(log.info).toHaveBeenCalledWith("expected message");
});
```

## Mock Implementation Details

All mocks are created with `_jaypie: true` property for identification. Mock factories include:

- `createMockFunction<T>()` - Creates typed mock with implementation
- `createMockResolvedFunction<T>()` - Creates async mock that resolves to value
- `createMockReturnedFunction<T>()` - Creates mock that returns value
- `createMockWrappedFunction()` - Wraps real function, falls back on error
- `createMockWrappedObject()` - Recursively wraps object methods
- `createMockError()` - Creates mock error constructor
- `createMockTool()` - Creates mock LlmTool for testing

## Dependencies

- `jest-extended` - Additional matchers (toBeObject, toBeArray, etc.)
- `jest-json-schema` - JSON schema validation matcher
- `vitest` - Test framework (peer dependency)
- `@jaypie/errors`, `@jaypie/kit`, `@jaypie/logger` - Optional peer dependencies

## Adding New Mocks

When adding exports to other Jaypie packages:

1. Add mock implementation to appropriate file in `src/mock/`
2. Export from `src/mock/index.ts`
3. Update `src/mock/index.ts` default export object
4. Bump testkit version (required for dependent package tests)
