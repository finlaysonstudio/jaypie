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
app.use("/_sy/echo", cors(), express.json(), echoRoute);

// API routes
app.post("/apikey/validate", cors(), apikeyValidateRoute);

// MCP endpoint (lazy-initialized)
// Do NOT use express.json() here — the MCP SDK's transport reads the raw body
// stream itself. If express.json() consumes the stream first, the transport
// gets an empty body and returns a parse error.
let mcpHandler: ((req: Request, res: Response) => Promise<void>) | null = null;
app.post(
  "/mcp",
  cors(),
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
