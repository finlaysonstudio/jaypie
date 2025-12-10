---
description: Template files for creating an Express on Lambda subpackage in a Jaypie monorepo
---

# Express Subpackage Templates

Templates for creating an Express subpackage that runs on AWS Lambda in a Jaypie monorepo.

## index.ts

```typescript
import serverlessExpress from "@codegenie/serverless-express";
import app from "./src/app.js";

export default serverlessExpress({ app });

if (process.env.NODE_ENV === "development") {
  app.listen(8080);
}
```

## src/app.ts

```typescript
import { cors, echoRoute, EXPRESS, noContentRoute, notFoundRoute } from "jaypie";
import express from "express";
import resourceRouter from "./routes/resource.router.js";

const app = express();

// Built-in Jaypie routes
app.get(EXPRESS.PATH.ROOT, noContentRoute);
app.use("/_sy/echo", cors(), echoRoute);

// Application routes
app.use(/^\/resource$/, cors(), resourceRouter);
app.use("/resource/", cors(), resourceRouter);

// Catch-all
app.all(EXPRESS.PATH.ANY, notFoundRoute);

export default app;
```

## src/handler.config.ts

```typescript
import { force } from "jaypie";

interface HandlerConfigOptions {
  locals?: Record<string, any>;
  setup?: Array<() => void | Promise<void>>;
  teardown?: Array<() => void | Promise<void>>;
  validate?: Array<() => boolean | Promise<boolean>>;
}

interface HandlerConfig {
  name: string;
  locals: Record<string, any>;
  setup: Array<() => void | Promise<void>>;
  teardown: Array<() => void | Promise<void>>;
  validate: Array<() => boolean | Promise<boolean>>;
}

const handlerConfig = (
  nameOrConfig: string | (HandlerConfig & { name: string }),
  options: HandlerConfigOptions = {}
): HandlerConfig => {
  let name: string;
  let locals: Record<string, any>;
  let setup: Array<() => void | Promise<void>>;
  let teardown: Array<() => void | Promise<void>>;
  let validate: Array<() => boolean | Promise<boolean>>;

  if (typeof nameOrConfig === "object") {
    ({ name, locals = {}, setup = [], teardown = [], validate = [] } = nameOrConfig);
  } else {
    name = nameOrConfig;
    ({ locals = {}, setup = [], teardown = [], validate = [] } = options);
  }

  return {
    name,
    locals: { ...force.object(locals) },
    setup: [...force.array(setup)],
    teardown: [...force.array(teardown)],
    validate: [...force.array(validate)],
  };
};

export default handlerConfig;
```

## src/routes/resource.router.ts

```typescript
import express from "express";
import { EXPRESS } from "jaypie";
import resourceGetRoute from "./resource/resourceGet.route.js";

const router = express.Router();
router.use(express.json({ strict: false }));

// Single example route
router.get(EXPRESS.PATH.ROOT, resourceGetRoute);

export default router;
```

## src/routes/resource/resourceGet.route.ts

```typescript
import { expressHandler } from "jaypie";
import type { Request } from "express";
import handlerConfig from "../../handler.config.js";

interface ResourceGetResponse {
  message: string;
  query: Record<string, any>;
  timestamp: string;
}

export default expressHandler(
  handlerConfig("resourceGet"),
  async (req: Request): Promise<ResourceGetResponse> => {
    const { query } = req;

    return {
      message: "Resource endpoint",
      query,
      timestamp: new Date().toISOString(),
    };
  }
);
```

## src/routes/resource/__tests__/resourceGet.route.spec.ts

```typescript
import { describe, expect, it } from "vitest";
import resourceGet from "../resourceGet.route.js";

describe("Resource Get Route", () => {
  it("returns resource data", async () => {
    const mockRequest = {
      query: { search: "test" },
      locals: {},
    } as any;

    const response = await resourceGet(mockRequest);

    expect(response.message).toBe("Resource endpoint");
    expect(response.query).toEqual({ search: "test" });
    expect(response.timestamp).toBeDefined();
  });

  it("handles empty query", async () => {
    const mockRequest = {
      query: {},
      locals: {},
    } as any;

    const response = await resourceGet(mockRequest);

    expect(response.message).toBe("Resource endpoint");
    expect(response.query).toEqual({});
  });
});
```

## src/types/express.ts

```typescript
declare global {
  namespace Express {
    interface Request {
      locals?: Record<string, any>;
    }
  }
}

export {};
```
