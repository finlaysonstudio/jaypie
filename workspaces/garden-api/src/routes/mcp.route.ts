import { loadEnvSecrets } from "@jaypie/aws";
import { initClient } from "@jaypie/dynamodb";
import { ForbiddenError, UnauthorizedError } from "@jaypie/errors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
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
      const commit = (process.env.PROJECT_COMMIT || "unknown").slice(0, 8);
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

// Use InMemoryTransport to bridge JSON-RPC messages to the McpServer.
// StreamableHTTPServerTransport uses Hono's getRequestListener which is
// incompatible with Lambda's custom LambdaResponseStreaming adapter.
async function createMcpHandler(): Promise<
  (req: Request, res: Response) => Promise<void>
> {
  const server = createGardenMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);

  return async (req: Request, res: Response): Promise<void> => {
    try {
      // Collect body from Lambda request stream
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const message: JSONRPCMessage = JSON.parse(rawBody);

      // Collect response from server
      const responsePromise = new Promise<JSONRPCMessage>((resolve) => {
        const originalOnMessage = clientTransport.onmessage;
        clientTransport.onmessage = (response: JSONRPCMessage) => {
          // Restore original handler
          clientTransport.onmessage = originalOnMessage;
          resolve(response);
        };
      });

      // Send message and wait for response
      await clientTransport.send(message);
      const response = await responsePromise;

      res.setHeader("Content-Type", "application/json");
      res.status(200).json(response);
    } catch (error) {
      if (!res.headersSent) {
        res.status(400).json({
          error: {
            code: -32700,
            message: "Parse error",
            data: error instanceof Error ? error.message : String(error),
          },
          id: null,
          jsonrpc: "2.0",
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
