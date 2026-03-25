import { loadEnvSecrets } from "@jaypie/aws";
import { initClient } from "@jaypie/dynamodb";
import { ForbiddenError, UnauthorizedError } from "@jaypie/errors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { NextFunction, Request, Response } from "express";

import { extractToken, validateApiKey } from "../apikey/index.js";

//
//
// Constants
//

const GARDEN_MCP_VERSION = "0.0.1";

//
//
// Auth Middleware
//

let initialized = false;

async function ensureInitialized(): Promise<void> {
  if (!initialized) {
    await loadEnvSecrets("PROJECT_SALT");
    initClient({ endpoint: process.env.DYNAMODB_ENDPOINT });
    initialized = true;
  }
}

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

    await ensureInitialized();

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
// Garden MCP Server
//

function createGardenMcpServer(): McpServer {
  const server = new McpServer({
    name: "garden",
    version: GARDEN_MCP_VERSION,
  });

  server.tool(
    "version",
    "Prints the current version and hash",
    {},
    async () => {
      const commit = process.env.PROJECT_COMMIT || "unknown";
      return {
        content: [
          {
            text: `@jaypie/garden-api@${GARDEN_MCP_VERSION} (${commit})`,
            type: "text",
          },
        ],
      };
    },
  );

  return server;
}

//
//
// MCP Handler
//

async function createMcpHandler(): Promise<
  (req: Request, res: Response) => Promise<void>
> {
  const server = createGardenMcpServer();

  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: undefined, // Stateless — no sessions in Lambda
  });

  await server.connect(transport);

  return async (req: Request, res: Response): Promise<void> => {
    try {
      // Manually collect the raw body — the Lambda adapter's LambdaRequest
      // stream isn't compatible with Hono's getRequestListener conversion.
      // Passing parsedBody lets the SDK skip reading from the raw stream.
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const parsedBody = rawBody ? JSON.parse(rawBody) : undefined;
      await transport.handleRequest(req, res, parsedBody);
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
