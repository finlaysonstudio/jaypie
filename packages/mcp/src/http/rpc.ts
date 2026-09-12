import { isJaypieError } from "@jaypie/errors";
import type { ServiceSuite } from "@jaypie/fabric";
import { inputToJsonSchema } from "@jaypie/fabric/llm";
import { log } from "@jaypie/logger";

import { findTool, selectTools } from "./tools.js";

//
//
// Constants
//

export const JSON_RPC_ERROR = {
  INTERNAL: -32603,
  INVALID_PARAMS: -32602,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  PARSE: -32700,
} as const;

export const JSON_RPC_VERSION = "2.0";

export const MCP_METHOD = {
  CALL_TOOL: "tools/call",
  CANCELLED: "notifications/cancelled",
  INITIALIZE: "initialize",
  INITIALIZED: "notifications/initialized",
  LIST_TOOLS: "tools/list",
  PING: "ping",
} as const;

/** Latest protocol version; answered when a client requests an unknown one */
export const MCP_PROTOCOL_VERSION = "2025-06-18";

export const MCP_SUPPORTED_PROTOCOL_VERSIONS: readonly string[] = [
  MCP_PROTOCOL_VERSION,
  "2025-03-26",
  "2024-11-05",
];

const MESSAGE = {
  EMPTY_BATCH: "An empty batch is not a request",
  INVALID_ARGUMENTS: "Tool arguments must be an object",
  INVALID_REQUEST: "The request is not a JSON-RPC request",
  PARSE: "The body is not JSON-RPC",
  TOOL_FAILED: "The tool call failed",
  UNKNOWN_METHOD: "Unknown method",
  UNKNOWN_TOOL: "Unknown tool",
} as const;

//
//
// Types
//

export type JsonRpcId = number | string | null;

export interface JsonRpcRequest {
  id?: JsonRpcId;
  jsonrpc?: string;
  method?: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  error?: { code: number; data?: unknown; message: string };
  id: JsonRpcId;
  jsonrpc: typeof JSON_RPC_VERSION;
  result?: unknown;
}

export interface McpRpcOptions {
  /** Server name reported by `initialize`. Defaults to the suite name */
  name?: string;
  /** Allowlist of service aliases exposed as tools. Omit to expose all */
  services?: string[];
  /** Suite served as tools. Defaults to the Jaypie MCP suite */
  suite?: ServiceSuite;
  /** Server version reported by `initialize`. Defaults to the suite version */
  version?: string;
}

//
//
// Helpers
//

let defaultSuite: Promise<ServiceSuite> | undefined;

/** Load the Jaypie suite only when no suite is supplied */
function loadDefaultSuite(): Promise<ServiceSuite> {
  if (!defaultSuite) {
    defaultSuite = import("../suite.js")
      .then((module) => module.suite)
      .catch((error: unknown) => {
        defaultSuite = undefined;
        throw error;
      });
  }
  return defaultSuite;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonRpcError({
  code,
  id = null,
  message,
}: {
  code: number;
  id?: JsonRpcId;
  message: string;
}): JsonRpcResponse {
  return { error: { code, message }, id, jsonrpc: JSON_RPC_VERSION };
}

function jsonRpcResult({
  id,
  result,
}: {
  id: JsonRpcId;
  result: unknown;
}): JsonRpcResponse {
  return { id, jsonrpc: JSON_RPC_VERSION, result };
}

function textContent(value: unknown): { text: string; type: "text" }[] {
  let text: string;
  if (value === undefined || value === null) {
    text = "";
  } else if (typeof value === "string") {
    text = value;
  } else {
    text = JSON.stringify(value, null, 2);
  }
  return [{ text, type: "text" }];
}

/** A notification carries no id and expects no response */
export function isNotification(request: unknown): boolean {
  return isRecord(request) && (request.id === undefined || request.id === null);
}

/**
 * Normalize a raw body: a Buffer or string is parsed as JSON; anything else is
 * taken as already parsed. Returns `undefined` when there is no parseable body.
 */
export function parseRpcBody(body: unknown): unknown {
  const raw = Buffer.isBuffer(body) ? body.toString("utf8") : body;
  if (typeof raw !== "string") {
    return raw;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Does the body carry anything that must be answered? */
export function expectsResponse(body: unknown): boolean {
  const parsed = parseRpcBody(body);
  if (Array.isArray(parsed)) {
    return (
      parsed.length === 0 || parsed.some((entry) => !isNotification(entry))
    );
  }
  return !isNotification(parsed);
}

async function callTool({
  id,
  params,
  services,
  suite,
}: {
  id: JsonRpcId;
  params: Record<string, unknown>;
  services?: string[];
  suite: ServiceSuite;
}): Promise<JsonRpcResponse> {
  const name = typeof params.name === "string" ? params.name : "";
  const tool = findTool(name, { services, suite });
  if (!tool) {
    return jsonRpcError({
      code: JSON_RPC_ERROR.INVALID_PARAMS,
      id,
      message: `${MESSAGE.UNKNOWN_TOOL}: ${name}`,
    });
  }

  const args = params.arguments ?? {};
  if (!isRecord(args)) {
    return jsonRpcError({
      code: JSON_RPC_ERROR.INVALID_PARAMS,
      id,
      message: MESSAGE.INVALID_ARGUMENTS,
    });
  }

  try {
    const result = await tool(args);
    log.trace(`[mcp] Tool call complete: ${name}`);
    return jsonRpcResult({ id, result: { content: textContent(result) } });
  } catch (error) {
    let message: string = MESSAGE.TOOL_FAILED;
    if (isJaypieError(error) && error instanceof Error) {
      message = error.message;
      log.debug(`[mcp] Tool call rejected: ${name}`);
    } else {
      log.warn(`[mcp] Tool call failed: ${name}`);
    }
    log.var({
      mcpToolError: {
        message: error instanceof Error ? error.message : String(error),
        tool: name,
      },
    });
    return jsonRpcResult({
      id,
      result: { content: textContent(message), isError: true },
    });
  }
}

//
//
// Main
//

/**
 * Answer one JSON-RPC request against a suite
 *
 * Returns `null` for a notification, which the transport answers with 202 and
 * no body.
 */
export async function handleMcpRpc(
  request: JsonRpcRequest,
  options: McpRpcOptions = {},
): Promise<JsonRpcResponse | null> {
  const id = request.id ?? null;
  const notification = isNotification(request);

  if (typeof request.method !== "string") {
    if (notification) {
      return null;
    }
    return jsonRpcError({
      code: JSON_RPC_ERROR.INVALID_REQUEST,
      id,
      message: MESSAGE.INVALID_REQUEST,
    });
  }

  const suite = options.suite ?? (await loadDefaultSuite());
  const { name = suite.name, services, version = suite.version } = options;
  const params = isRecord(request.params) ? request.params : {};

  log.trace(`[mcp] ${request.method}`);

  switch (request.method) {
    case MCP_METHOD.INITIALIZE: {
      const requested = params.protocolVersion;
      const protocolVersion =
        typeof requested === "string" &&
        MCP_SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
          ? requested
          : MCP_PROTOCOL_VERSION;
      return jsonRpcResult({
        id,
        result: {
          capabilities: { tools: {} },
          protocolVersion,
          serverInfo: { name, version },
        },
      });
    }

    case MCP_METHOD.CANCELLED:
    case MCP_METHOD.INITIALIZED:
      return null;

    case MCP_METHOD.PING:
      return jsonRpcResult({ id, result: {} });

    case MCP_METHOD.LIST_TOOLS:
      return jsonRpcResult({
        id,
        result: {
          tools: selectTools({ services, suite }).map((tool) => ({
            description: tool.description ?? "",
            inputSchema: inputToJsonSchema(tool.input),
            name: String(tool.alias),
          })),
        },
      });

    case MCP_METHOD.CALL_TOOL:
      return callTool({ id, params, services, suite });

    default:
      if (notification) {
        return null;
      }
      return jsonRpcError({
        code: JSON_RPC_ERROR.METHOD_NOT_FOUND,
        id,
        message: `${MESSAGE.UNKNOWN_METHOD}: ${request.method}`,
      });
  }
}

/**
 * Answer a body that may be one request or a batch
 *
 * Accepts a parsed body, a JSON string, or a Buffer. Returns `null` when
 * nothing needs an answer.
 */
export async function handleMcpRpcBody(
  body: unknown,
  options: McpRpcOptions = {},
): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
  const parsed = parseRpcBody(body);

  if (parsed === undefined) {
    return jsonRpcError({ code: JSON_RPC_ERROR.PARSE, message: MESSAGE.PARSE });
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return jsonRpcError({
        code: JSON_RPC_ERROR.INVALID_REQUEST,
        message: MESSAGE.EMPTY_BATCH,
      });
    }
    const responses = await Promise.all(
      parsed.map((entry) =>
        isRecord(entry)
          ? handleMcpRpc(entry as JsonRpcRequest, options)
          : jsonRpcError({
              code: JSON_RPC_ERROR.INVALID_REQUEST,
              message: MESSAGE.INVALID_REQUEST,
            }),
      ),
    );
    const answered = responses.filter(
      (response): response is JsonRpcResponse => response !== null,
    );
    return answered.length > 0 ? answered : null;
  }

  if (!isRecord(parsed)) {
    return jsonRpcError({
      code: JSON_RPC_ERROR.INVALID_REQUEST,
      message: MESSAGE.INVALID_REQUEST,
    });
  }

  return handleMcpRpc(parsed as JsonRpcRequest, options);
}
