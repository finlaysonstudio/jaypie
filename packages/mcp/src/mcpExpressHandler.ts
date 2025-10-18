import { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";
import { createMcpServer } from "./createMcpServer.js";

// Version will be injected during build
const DEFAULT_VERSION = "0.0.0";

/**
 * Options for configuring the MCP Express handler
 */
export interface McpExpressHandlerOptions {
  /**
   * Version string for the MCP server
   */
  version?: string;
  /**
   * Whether to enable session management (stateful mode)
   * Default: true
   */
  enableSessions?: boolean;
  /**
   * Custom session ID generator function
   */
  sessionIdGenerator?: () => string;
  /**
   * Enable JSON responses instead of SSE streaming
   * Default: false
   */
  enableJsonResponse?: boolean;
}

/**
 * Creates an Express handler for the Jaypie MCP server using HTTP transport
 *
 * @param options - Configuration options for the handler
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { mcpExpressHandler } from '@jaypie/mcp';
 *
 * const app = express();
 * app.use(express.json());
 *
 * app.use('/mcp', mcpExpressHandler({
 *   version: '1.0.0',
 *   enableSessions: true
 * }));
 *
 * app.listen(3000, () => {
 *   console.log('MCP server running on http://localhost:3000/mcp');
 * });
 * ```
 */
export function mcpExpressHandler(
  options: McpExpressHandlerOptions = {},
): (req: Request, res: Response) => Promise<void> {
  const {
    version = DEFAULT_VERSION,
    enableSessions = true,
    sessionIdGenerator = () => randomUUID(),
    enableJsonResponse = false,
  } = options;

  return async (req: Request, res: Response): Promise<void> => {
    const server = createMcpServer(version);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: enableSessions ? sessionIdGenerator : undefined,
      enableJsonResponse,
    });

    await server.connect(transport);

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
