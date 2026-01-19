---
trigger: model_decision
description: When asked to create a new workspace or subpackage for lambdas
---

# Jaypie Lambda Package

Lambda package structure for AWS Lambda functions using Jaypie.

## Goal

Create AWS Lambda functions that integrate with Jaypie for event-driven processing.

## Guidelines

- Uses TypeScript with ES modules
- Leverages Jaypie's lambdaHandler wrapper for setup/teardown
- Built with Rollup for optimized deployment packages
- Tests with Vitest and Jaypie testkit

## Process

### 1. Setup Package Structure

```
packages/lambda/
├── package.json       # Define dependencies and scripts
├── tsconfig.json      # TypeScript configuration
├── rollup.config.mjs  # Bundle configuration
├── vite.config.js     # Test configuration
├── testSetup.ts       # Test setup and matchers
└── src/
    ├── index.ts       # Export handlers
    ├── worker.ts      # Lambda function implementation
    └── __tests__/     # Test files
        └── worker.spec.ts
```

### 2. Configure package.json

```json
{
  "name": "@yourorg/lambda",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/esm/index.d.ts",
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.cjs"
    }
  },
  "main": "./dist/cjs/index.cjs",
  "module": "./dist/esm/index.js",
  "types": "./dist/esm/index.d.ts",
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "rollup --config",
    "format": "npm run format:package && npm run format:lint",
    "format:lint": "eslint --fix .",
    "format:package": "sort-package-json ./package.json",
    "lint": "eslint .",
    "test": "vitest run .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@jaypie/core": "^1.1.0",
    "@jaypie/lambda": "^1.1.0"
  },
  "devDependencies": {
    "@rollup/plugin-typescript": "^12.0.0",
    "@types/aws-lambda": "^8.10.0",
    "rollup": "^4.0.0",
    "rollup-plugin-auto-external": "^2.0.0",
    "typescript": "^5.0.0"
  }
}
```

### 3. Configure TypeScript

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "declaration": true,
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/__tests__"]
}
```

### 4. Configure Rollup

Create `rollup.config.mjs`:

```javascript
import autoExternal from "rollup-plugin-auto-external";
import typescript from "@rollup/plugin-typescript";

export default [
  // ES modules version
  {
    input: "src/index.ts",
    output: {
      dir: "dist/esm",
      format: "es",
      sourcemap: true,
    },
    plugins: [
      autoExternal(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: true,
        outDir: "dist/esm",
      }),
    ],
  },
  // CommonJS version
  {
    input: "src/index.ts",
    output: {
      dir: "dist/cjs",
      format: "cjs",
      sourcemap: true,
      exports: "named",
      entryFileNames: "[name].cjs",
    },
    plugins: [
      autoExternal(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: true,
        outDir: "dist/cjs",
      }),
    ],
  },
];
```

### 5. Setup Vitest

Create `vite.config.js`:

```javascript
/// <reference types="vitest" />

import { defineConfig } from "vite";

export default defineConfig({
  test: {
    setupFiles: ["./testSetup.ts"],
  },
});
```

Create `testSetup.ts`:

```typescript
import { matchers as jaypieMatchers } from "@jaypie/testkit";
import * as extendedMatchers from "jest-extended";
import { expect } from "vitest";

expect.extend(extendedMatchers);
expect.extend(jaypieMatchers);
```

Note: Do not mock `jaypie` in the setup file for lambda consumer packages. Mock in individual test files as needed.

### 6. Create Handler Implementation

```typescript
// src/worker.ts
import { log } from "@jaypie/core";
import { lambdaHandler } from "@jaypie/lambda";
import type { LambdaContext } from "@jaypie/lambda";

export interface WorkerEvent {
  message?: string;
}

export const handler = lambdaHandler(
  async (event: WorkerEvent, context?: LambdaContext) => {
    log.trace("worker: start");

    const message = event?.message || "Hello, world!";

    log.trace("worker: processing message", { message });

    const response = {
      status: "success",
      message,
      timestamp: new Date().toISOString(),
    };

    log.trace("worker: complete");
    return response;
  },
  {
    name: "worker",
  },
);
```

### 7. Export Handler

```typescript
// src/index.ts
export { handler as workerHandler } from "./worker.js";
```

### 8. Write Tests

Tests are organized in sections: Base Cases, Error Conditions, Security, Observability, Happy Paths, Features, Specific Scenarios. Omit sections that are not applicable.

```typescript
// src/__tests__/worker.spec.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { log } from "@jaypie/core";
import { restoreLog, spyLog } from "@jaypie/testkit";

// Subject
import { handler } from "../worker.js";
import type { WorkerEvent } from "../worker.js";

//
//
// Mock modules
//

vi.mock("@jaypie/core", async () => {
  const actual = await vi.importActual("@jaypie/core");
  return {
    ...actual,
  };
});

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
  spyLog(log);
});
afterEach(() => {
  process.env = DEFAULT_ENV;
  vi.clearAllMocks();
  restoreLog(log);
});

//
//
// Run tests
//

describe("worker Lambda handler", () => {
  describe("Base Cases", () => {
    it("Works", async () => {
      const event: WorkerEvent = {};
      const result = await handler(event);
      expect(result).toBeDefined();
    });
  });

  describe("Observability", () => {
    it("Does not log above trace", async () => {
      const event: WorkerEvent = { message: "Test" };
      await handler(event);
      expect(log).not.toBeCalledAboveTrace();
    });
  });

  describe("Happy Paths", () => {
    it("Returns success with provided message", async () => {
      const event: WorkerEvent = {
        message: "Test message",
      };

      const result = await handler(event);

      expect(result).toHaveProperty("status", "success");
      expect(result).toHaveProperty("message", "Test message");
      expect(result).toHaveProperty("timestamp");
    });

    it("Returns default message when none provided", async () => {
      const event: WorkerEvent = {};

      const result = await handler(event);

      expect(result).toHaveProperty("message", "Hello, world!");
    });
  });
});
```

### 9. Build and Test

Build, lint, typecheck, and test the package:

```bash
# Install dependencies (from monorepo root)
npm install <package> -w packages/lambda

# Lint and format
npm run format -w packages/lambda

# Type check
npm run typecheck -w packages/lambda

# Build the package
npm run build -w packages/lambda

# Run tests
npm run test -w packages/lambda
```

### 10. Deploy

Deploy using AWS CDK or other deployment tool. The Lambda handler will be referenced as "workerHandler" from the built package.

## Important Notes

### Import Patterns

- Import `lambdaHandler` from `@jaypie/lambda`, not from `jaypie`
- Import `log` from `@jaypie/core`, not from `jaypie`
- Use `LambdaContext` type from `@jaypie/lambda`, not `Context` from `jaypie`
- TypeScript files must use `.js` extension in relative imports (e.g., `from "./worker.js"`)

### Test Structure

- Tests are organized in 7 sections: Base Cases, Error Conditions, Security, Observability, Happy Paths, Features, Specific Scenarios
- Omit sections that are not applicable
- Use `spyLog` and `restoreLog` from `@jaypie/testkit` for logging tests
- Use Jaypie matchers like `toBeCalledAboveTrace()` for observability tests
- Mock `@jaypie/core` in test files, not in `testSetup.ts`

### Build Configuration

- Use `rollup-plugin-auto-external` to automatically exclude dependencies from bundles
- Build both ESM and CommonJS formats for maximum compatibility
- Use `vite.config.js` (not `vitest.config.ts`) for test configuration
- Use `testSetup.ts` (not `vitest.setup.ts`) for test setup

### Code Style

- Use double quotes, trailing commas, semicolons
- Alphabetize imports and properties
- Define constants for hard-coded values at file top
- Never throw vanilla Error; use errors from `@jaypie/errors`

## Streaming Lambda Functions

Use `lambdaStreamHandler` for AWS Lambda Response Streaming. This enables real-time streaming responses for LLM interactions, large file processing, and SSE endpoints.

### Lambda Streaming Setup

Create a streaming Lambda handler with `awslambda.streamifyResponse`:

```typescript
// src/streamWorker.ts
import { log } from "@jaypie/core";
import { lambdaStreamHandler, createLambdaStream, Llm } from "jaypie";
import type { StreamHandlerContext } from "@jaypie/lambda";

export interface StreamWorkerEvent {
  prompt?: string;
}

const streamWorker = lambdaStreamHandler(
  async (event: StreamWorkerEvent, context: StreamHandlerContext) => {
    log.trace("streamWorker: start");

    const llm = new Llm("anthropic");
    const stream = llm.stream(event.prompt || "Hello");

    // createLambdaStream pipes LLM chunks as SSE events
    await createLambdaStream(stream, context.responseStream);

    log.trace("streamWorker: complete");
  },
  {
    name: "streamWorker",
    contentType: "text/event-stream",
  }
);

// Wrap with AWS streamifyResponse
declare const awslambda: { streamifyResponse: <T>(handler: T) => T };
export const handler = awslambda.streamifyResponse(streamWorker);
```

### Manual Stream Writing

Write directly to the response stream for custom SSE events:

```typescript
import { lambdaStreamHandler } from "jaypie";
import type { StreamHandlerContext } from "@jaypie/lambda";

const manualStreamHandler = lambdaStreamHandler(
  async (event: unknown, context: StreamHandlerContext) => {
    const { responseStream } = context;

    // Write SSE events directly
    responseStream.write("event: start\ndata: {\"status\": \"processing\"}\n\n");

    // Process data in chunks
    for (const item of items) {
      const result = await process(item);
      responseStream.write(`event: data\ndata: ${JSON.stringify(result)}\n\n`);
    }

    responseStream.write("event: done\ndata: {\"status\": \"complete\"}\n\n");
    // Handler automatically calls responseStream.end()
  },
  {
    name: "manualStream",
  }
);
```

### Stream Handler Options

```typescript
import type { LambdaStreamHandlerOptions } from "@jaypie/lambda";

const options: LambdaStreamHandlerOptions = {
  name: "myStreamHandler",          // Handler name for logging
  contentType: "text/event-stream", // Response content type (default)
  chaos: "low",                     // Chaos testing level
  secrets: ["API_KEY"],             // AWS secrets to load into process.env
  setup: [],                        // Setup function(s)
  teardown: [],                     // Teardown function(s)
  validate: [],                     // Validation function(s)
  throw: false,                     // Re-throw errors instead of SSE error
  unavailable: false,               // Return 503 if true
};
```

### Stream Handler Types

```typescript
import type {
  LambdaStreamHandlerOptions,
  StreamHandlerContext,
  ResponseStream,
  AwsStreamingHandler,
} from "@jaypie/lambda";
```

### CDK Configuration for Streaming

Enable Lambda Response Streaming via Function URL in CDK:

```typescript
import { JaypieLambda } from "@jaypie/constructs";
import { FunctionUrlAuthType, InvokeMode } from "aws-cdk-lib/aws-lambda";

const streamingLambda = new JaypieLambda(this, "StreamingFunction", {
  code: "dist",
  handler: "streamWorker.handler",
  timeout: Duration.minutes(5),
});

// Add Function URL with streaming enabled
streamingLambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE, // or AWS_IAM for auth
  invokeMode: InvokeMode.RESPONSE_STREAM,
});

// Or use JaypieDistribution with streaming: true for CloudFront integration
new JaypieDistribution(this, "Distribution", {
  handler: streamingLambda,
  streaming: true,
  host: "api.example.com",
  zone: "example.com",
});
```

### Error Handling in Streams

Errors are formatted as SSE error events:

```typescript
// Jaypie errors written as:
// event: error
// data: {"errors":[{"status":500,"title":"Internal Error"}]}
```

Set `throw: true` to re-throw errors instead of writing to stream.