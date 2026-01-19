---
sidebar_position: 1
---

# Express on Lambda


**Prerequisites:**
- Existing Jaypie monorepo or new project
- AWS CDK knowledge (for deployment)

## Overview

This guide walks through creating an Express application using Jaypie patterns that runs on AWS Lambda via serverless-express.
The same application works locally with hot reload and deploys to Lambda unchanged.

## Project Structure

```
packages/api/
├── src/
│   ├── app.ts              # Express app setup
│   ├── handler.ts          # Lambda entry point
│   ├── routers/
│   │   └── v1.router.ts    # API router
│   └── routes/
│       └── health.route.ts # Individual routes
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

## Step 1: Create Package

```bash
mkdir -p packages/api/src/{routers,routes}
```

## Step 2: Package Configuration

**packages/api/package.json:**

```json
{
  "name": "@project/api",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "main": "dist/handler.js",
  "types": "dist/handler.d.ts",
  "exports": {
    ".": {
      "import": "./dist/handler.js",
      "types": "./dist/handler.d.ts"
    }
  },
  "scripts": {
    "build": "vite build && tsc --emitDeclarationOnly",
    "dev": "env-cmd -f .env.local tsx watch src/dev.ts",
    "test": "vitest run"
  }
}
```

## Step 3: Install Dependencies

```bash
npm install jaypie @vendia/serverless-express express -w packages/api
npm install -D @jaypie/testkit @types/express vite vitest -w packages/api
```

## Step 4: Express App Setup

**packages/api/src/app.ts:**

```typescript
import { cors } from "jaypie";
import express from "express";

import v1Router from "./routers/v1.router.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/v1", v1Router);

export default app;
```

## Step 5: Lambda Handler

**packages/api/src/handler.ts:**

```typescript
import serverlessExpress from "@vendia/serverless-express";

import app from "./app.js";

export const handler = serverlessExpress({ app });
```

## Step 6: Router Setup

**packages/api/src/routers/v1.router.ts:**

```typescript
import { Router } from "express";

import healthRoute from "../routes/health.route.js";

const router = Router();

router.get("/health", healthRoute);

export default router;
```

## Step 7: Route with Handler

**packages/api/src/routes/health.route.ts:**

```typescript
import { expressHandler, log } from "jaypie";

export default expressHandler(
  async (req, res) => {
    log.trace("[health] responding");
    return { status: "healthy" };
  },
  {
    name: "health",
  }
);
```

## Step 8: Local Development Server

**packages/api/src/dev.ts:**

```typescript
import app from "./app.js";

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

**packages/api/.env.local:**

```bash
PROJECT_ENV=local
LOG_LEVEL=trace
```

## Step 9: Build Configuration

**packages/api/vite.config.ts:**

```typescript
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/handler.ts"),
      formats: ["es"],
      fileName: "handler",
    },
    rollupOptions: {
      external: [
        "express",
        "@vendia/serverless-express",
        /^jaypie/,
        /^@jaypie/,
      ],
    },
    outDir: "dist",
    emptyOutDir: true,
  },
});
```

**packages/api/tsconfig.json:**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "emitDeclarationOnly": true
  },
  "include": ["src/**/*"]
}
```

## Step 10: Test Setup

**packages/api/vitest.config.ts:**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["@jaypie/testkit/testSetup"],
  },
});
```

**packages/api/src/routes/health.route.spec.ts:**

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("jaypie", async () => {
  const testkit = await import("@jaypie/testkit/mock");
  return testkit;
});

import healthRoute from "./health.route.js";

describe("Health Route", () => {
  it("returns healthy status", async () => {
    const req = {} as any;
    const res = {} as any;
    const result = await healthRoute(req, res);
    expect(result).toEqual({ status: "healthy" });
  });
});
```

## Running Locally

```bash
npm run dev -w packages/api
# Server at http://localhost:8080
# GET http://localhost:8080/v1/health
```

## Building for Lambda

```bash
npm run build -w packages/api
# Output in packages/api/dist/handler.js
```

## CDK Deployment

See [CDK Infrastructure](/docs/guides/cdk-infrastructure) for deploying with `JaypieExpressLambda`.

```typescript
import { JaypieExpressLambda, JaypieApiGateway } from "@jaypie/constructs";

const api = new JaypieExpressLambda(this, "Api", {
  code: "../api/dist",
  handler: "handler.handler",
});

new JaypieApiGateway(this, "Gateway", {
  handler: api,
  host: "api.example.com",
});
```

## Adding Routes

### With Validation

```typescript
import { expressHandler, BadRequestError } from "jaypie";

export default expressHandler(
  async (req, res) => {
    const { id } = req.params;
    const user = await db.users.findById(id);
    if (!user) throw NotFoundError();
    return { data: user };
  },
  {
    name: "getUser",
    validate: [(req) => req.params.id],
    secrets: ["MONGODB_URI"],
  }
);
```

### With Setup/Teardown

```typescript
import { expressHandler } from "jaypie";
import { connectMongo, disconnectMongo } from "./db.js";

export default expressHandler(
  async (req, res) => {
    return await db.users.find();
  },
  {
    setup: [connectMongo],
    teardown: [disconnectMongo],
  }
);
```

## Related

- [Handler Lifecycle](/docs/core/handler-lifecycle) - Understanding validate/setup/teardown
- [CDK Infrastructure](/docs/guides/cdk-infrastructure) - Deploying to AWS
- [@jaypie/express](/docs/packages/express) - Express handler reference
- [Testing](/docs/guides/testing) - Testing Express routes
