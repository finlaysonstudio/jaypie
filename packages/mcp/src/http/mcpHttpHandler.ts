import { MethodNotAllowedError } from "@jaypie/errors";
import { expressHandler, expressStreamHandler } from "@jaypie/express";
import type { ExpressHandlerOptions } from "@jaypie/express";
import type { Request, Response } from "express";

import { expectsResponse, handleMcpRpcBody } from "./rpc.js";
import type { JsonRpcResponse, McpRpcOptions } from "./rpc.js";

//
//
// Constants
//

const HANDLER_NAME = {
  JSON: "mcpHttpHandler",
  STREAM: "mcpHttpStreamHandler",
} as const;

const HEADER_ALLOW = "Allow";
const HTTP_ACCEPTED = 202;
const HTTP_METHOD_POST = "POST";

const MEDIA_TYPE = {
  EVENT_STREAM: "text/event-stream",
  JSON: "application/json",
} as const;

const MESSAGE_METHOD_NOT_ALLOWED =
  "This MCP endpoint is stateless and accepts POST only";

const SSE_EVENT = "message";

//
//
// Types
//

/**
 * Options for `mcpHttpHandler`
 *
 * Lifecycle options (`secrets`, `setup`, `validate`, ...) pass through to
 * `expressHandler` and `expressStreamHandler`. `name` and `version` describe
 * the MCP server reported by `initialize`.
 */
export interface McpHttpHandlerOptions
  extends Omit<ExpressHandlerOptions, "fabric" | "name">, McpRpcOptions {}

export type McpHttpHandler = (
  req: Request,
  res: Response,
  ...params: unknown[]
) => Promise<unknown>;

//
//
// Helpers
//

/** Does the client prefer an event stream over one JSON body? */
function wantsEventStream(req: Request): boolean {
  const accept = String(req.headers.accept ?? "");
  const streamIndex = accept.indexOf(MEDIA_TYPE.EVENT_STREAM);
  if (streamIndex === -1) {
    return false;
  }
  const jsonIndex = accept.indexOf(MEDIA_TYPE.JSON);
  return jsonIndex === -1 || streamIndex < jsonIndex;
}

function formatSseMessage(response: JsonRpcResponse): string {
  return `event: ${SSE_EVENT}\ndata: ${JSON.stringify(response)}\n\n`;
}

//
//
// Main
//

/**
 * Serve a fabric `ServiceSuite` as MCP streamable HTTP without the MCP SDK
 *
 * Stateless JSON-RPC 2.0 on a single endpoint. A POST answers with one JSON
 * body, or with server-sent events when the client's `Accept` header prefers
 * `text/event-stream`. Notifications answer 202 with no body. GET, DELETE, and
 * other methods answer 405.
 *
 * @example
 * ```typescript
 * import express from "express";
 * import { createLambdaStreamHandler } from "@jaypie/express";
 * import { mcpHttpHandler } from "@jaypie/mcp/http";
 *
 * const app = express();
 * app.use(express.json());
 * app.all("/mcp", mcpHttpHandler({ services: ["skill", "version"] }));
 *
 * export const handler = createLambdaStreamHandler(app);
 * ```
 */
export function mcpHttpHandler(
  options: McpHttpHandlerOptions = {},
): McpHttpHandler {
  const { name, services, suite, version, ...lifecycle } = options;
  const rpcOptions: McpRpcOptions = { name, services, suite, version };

  const jsonHandler = expressHandler(
    async (req: Request, res: Response) => {
      if (req.method !== HTTP_METHOD_POST) {
        res.setHeader(HEADER_ALLOW, HTTP_METHOD_POST);
        throw new MethodNotAllowedError(MESSAGE_METHOD_NOT_ALLOWED);
      }
      const answer = await handleMcpRpcBody(req.body, rpcOptions);
      if (answer === null) {
        // Streamable HTTP requires 202 with no body for notifications
        res.status(HTTP_ACCEPTED).end();
        return undefined;
      }
      return answer;
    },
    { ...lifecycle, name: HANDLER_NAME.JSON },
  );

  const streamHandler = expressStreamHandler(
    async (req: Request, res: Response) => {
      const answer = await handleMcpRpcBody(req.body, rpcOptions);
      const responses = answer === null ? [] : [answer].flat();
      for (const response of responses) {
        res.write(formatSseMessage(response));
      }
    },
    { ...lifecycle, format: "sse", name: HANDLER_NAME.STREAM },
  );

  return async (req: Request, res: Response, ...params: unknown[]) => {
    if (
      req.method === HTTP_METHOD_POST &&
      wantsEventStream(req) &&
      expectsResponse(req.body)
    ) {
      return streamHandler(req, res, ...params);
    }
    return jsonHandler(req, res, ...params);
  };
}
