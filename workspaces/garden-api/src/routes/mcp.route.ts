import { initClient } from "@jaypie/dynamodb";
import { ForbiddenError, UnauthorizedError } from "@jaypie/errors";
import { createMcpServer } from "@jaypie/mcp";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { NextFunction, Request, Response } from "express";

import { extractToken, validateApiKey } from "../apikey/index.js";

//
//
// Constants
//

const MCP_VERSION = "0.1.0";

//
//
// Auth Middleware
//

let dynamoInitialized = false;

async function mcpAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      throw new UnauthorizedError();
    }

    if (!dynamoInitialized) {
      initClient({ endpoint: process.env.DYNAMODB_ENDPOINT });
      dynamoInitialized = true;
    }

    await validateApiKey(token);
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      res.status(401).json({ error: "Unauthorized" });
    } else if (error instanceof ForbiddenError) {
      res.status(403).json({ error: "Forbidden" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

//
//
// MCP Handler
//

async function createMcpHandler(): Promise<
  (req: Request, res: Response) => Promise<void>
> {
  const server = createMcpServer(MCP_VERSION);

  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: false,
    sessionIdGenerator: undefined, // Stateless — no sessions in Lambda
  });

  await server.connect(transport);

  return async (req: Request, res: Response): Promise<void> => {
    try {
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  };
}

//
//
// Export
//

export { createMcpHandler, mcpAuthMiddleware };
