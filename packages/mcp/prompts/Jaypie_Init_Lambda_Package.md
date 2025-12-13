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