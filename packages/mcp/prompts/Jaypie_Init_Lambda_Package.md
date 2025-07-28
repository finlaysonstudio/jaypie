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
├── rollup.config.ts   # Bundle configuration
├── vitest.config.ts   # Test configuration
├── vitest.setup.ts    # Test setup and mocks
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
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "rollup --config",
    "lint": "eslint .",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "jaypie": "^1.1.0"
  },
  "devDependencies": {
    "@rollup/plugin-typescript": "^12.0.0",
    "@types/aws-lambda": "^8.10.0",
    "rollup": "^4.0.0",
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
    "esModuleInterop": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 4. Configure Rollup

```typescript
import typescript from "@rollup/plugin-typescript";
import type { RollupOptions } from "rollup";

const config: RollupOptions[] = [
  {
    input: "src/worker.ts",
    output: {
      file: "dist/worker.js",
      format: "es",
      sourcemap: true
    },
    plugins: [
      typescript({
        exclude: ["**/__tests__/**/*"]
      })
    ],
    external: ["jaypie"]
  },
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.js",
      format: "es",
      sourcemap: true
    },
    plugins: [
      typescript({
        exclude: ["**/__tests__/**/*"]
      })
    ],
    external: ["jaypie"]
  }
];

export default config;
```

### 5. Setup Vitest

```typescript
// vitest.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"]
  }
});

// vitest.setup.ts
import { matchers as jaypieMatchers } from "@jaypie/testkit";
import * as extendedMatchers from "jest-extended";
import { expect, vi } from "vitest";

expect.extend(extendedMatchers);
expect.extend(jaypieMatchers);

vi.mock("jaypie", async () => vi.importActual("@jaypie/testkit/mock"));
```

### 6. Create Handler Implementation

```typescript
// src/worker.ts
import { lambdaHandler, log } from "jaypie";
import type { Context } from "jaypie";

export interface WorkerEvent {
  message?: string;
}

export const handler = lambdaHandler(
  async (event: WorkerEvent, context: Context) => {
    log.trace("worker: start");
    
    const message = event?.message || "Hello, world!";
    
    log.trace("worker: processing message", { message });
    
    const response = {
      status: "success",
      message,
      timestamp: new Date().toISOString()
    };
    
    log.trace("worker: complete");
    return response;
  },
  {
    name: "worker"
  }
);
```

### 7. Export Handler

```typescript
// src/index.ts
export { handler as workerHandler } from "./worker.js";
```

### 8. Write Tests

```typescript
// src/__tests__/worker.spec.ts
import { vi, describe, it, expect, beforeEach } from "vitest";
import { handler, WorkerEvent } from "../worker.js";
import { log } from "jaypie";
import type { Context } from "jaypie";

vi.mock("jaypie", async () => vi.importActual("@jaypie/testkit/mock"));

describe("worker Lambda handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success with provided message", async () => {
    const event: WorkerEvent = {
      message: "Test message"
    };

    const result = await handler(event, {} as Context);
    
    expect(result).toHaveProperty("status", "success");
    expect(result).toHaveProperty("message", "Test message");
    expect(result).toHaveProperty("timestamp");
  });

  it("returns default message when none provided", async () => {
    const event = {} as WorkerEvent;

    const result = await handler(event, {} as Context);
    
    expect(result).toHaveProperty("message", "Hello, world!");
  });

  it("logs trace for operations", async () => {
    const event: WorkerEvent = {
      message: "Test message"
    };

    await handler(event, {} as Context);
    
    expect(log.trace).toHaveBeenCalled();
    expect(log).not.toBeCalledAboveTrace();
  });
});
```

### 9. Build and Deploy

```bash
# Build the Lambda package
npm run build

# Deploy using AWS CDK or other deployment tool
# The Lambda handler will be referenced as "workerHandler"
```