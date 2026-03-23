import {
  cors,
  echoRoute,
  EXPRESS,
  noContentRoute,
  notFoundRoute,
} from "jaypie";
import express from "express";
import type { Request, Response } from "express";

import apikeyValidateRoute from "./routes/apikeyValidate.route.js";
import { createMcpHandler, mcpAuthMiddleware } from "./routes/mcp.route.js";

const app = express();

// Built-in Jaypie routes
app.get(EXPRESS.PATH.ROOT, noContentRoute);
app.use("/_sy/echo", cors(), echoRoute);

// API routes
app.post("/apikey/validate", cors(), apikeyValidateRoute);

// MCP endpoint (lazy-initialized)
let mcpHandler: ((req: Request, res: Response) => Promise<void>) | null = null;
app.post(
  "/mcp",
  cors(),
  express.json(),
  mcpAuthMiddleware,
  async (req: Request, res: Response) => {
    if (!mcpHandler) {
      mcpHandler = await createMcpHandler();
    }
    return mcpHandler(req, res);
  },
);

// Catch-all
app.all(EXPRESS.PATH.ANY, notFoundRoute);

export default app;
