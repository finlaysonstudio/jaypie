// Fabric a service as an MCP tool

import { z } from "zod";

import { resolveService } from "../resolveService.js";
import type { Message, ServiceContext } from "../types.js";
import { inputToZodShape } from "./inputToZodShape.js";
import type { FabricMcpConfig, FabricMcpResult } from "./types.js";

/**
 * Format a value as a string for MCP response
 */
function formatResult(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

/**
 * Fabric a service as an MCP tool
 *
 * This function registers a service with an MCP server.
 * It automatically:
 * - Uses service.alias as the tool name (or custom name)
 * - Uses service.description as the tool description (or custom)
 * - Delegates validation to the service
 * - Wraps the service and formats the response
 *
 * @param config - Configuration including service, server, and optional overrides
 * @returns An object containing the fabricated tool name
 *
 * @example
 * ```typescript
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { fabricService } from "@jaypie/fabric";
 * import { fabricMcp } from "@jaypie/fabric/mcp";
 *
 * const myService = fabricService({
 *   alias: "greet",
 *   description: "Greet a user by name",
 *   input: {
 *     userName: { type: String, description: "The user's name" },
 *     loud: { type: Boolean, default: false, description: "Shout the greeting" },
 *   },
 *   service: ({ userName, loud }) => {
 *     const greeting = `Hello, ${userName}!`;
 *     return loud ? greeting.toUpperCase() : greeting;
 *   },
 * });
 *
 * const server = new McpServer({ name: "my-server", version: "1.0.0" });
 * fabricMcp({ server, service: myService });
 * ```
 */
export function fabricMcp(config: FabricMcpConfig): FabricMcpResult {
  const {
    alias,
    description,
    input,
    name,
    onComplete,
    onError,
    onFatal,
    onMessage,
    server,
    service: serviceOrFunction,
  } = config;

  // Resolve inline service or apply overrides to pre-instantiated service
  const service = resolveService({
    alias,
    description,
    input,
    service: serviceOrFunction,
  });

  // Determine tool name (priority: name > service.alias > "tool")
  const toolName = name ?? service.alias ?? "tool";

  // Determine tool description
  const toolDescription = service.description ?? "";

  // Create context callbacks that wrap with error swallowing
  const sendMessage = onMessage
    ? async (msg: Message): Promise<void> => {
        try {
          await onMessage(msg);
        } catch {
          // Swallow errors - callback failures should not halt execution
        }
      }
    : undefined;

  const contextOnError = onError
    ? async (error: unknown): Promise<void> => {
        try {
          await onError(error);
        } catch {
          // Swallow errors - callback failures should not halt execution
        }
      }
    : undefined;

  const contextOnFatal = onFatal
    ? async (error: unknown): Promise<void> => {
        try {
          await onFatal(error);
        } catch {
          // Swallow errors - callback failures should not halt execution
        }
      }
    : undefined;

  // Create context for the service
  const context: ServiceContext = {
    onError: contextOnError,
    onFatal: contextOnFatal,
    sendMessage,
  };

  // Convert input definitions to Zod schema for MCP SDK
  const zodSchema = inputToZodShape(z, service.input);

  // Register the tool with the MCP server
  server.tool(toolName, toolDescription, zodSchema, async (args) => {
    try {
      const result = await service(args as Record<string, unknown>, context);

      // Call onComplete if provided
      if (onComplete) {
        try {
          await onComplete(result);
        } catch {
          // Swallow errors - callback failures should not halt execution
        }
      }

      return {
        content: [
          {
            text: formatResult(result),
            type: "text" as const,
          },
        ],
      };
    } catch (error) {
      // Any thrown error is fatal
      if (onFatal) {
        await onFatal(error);
      } else if (onError) {
        await onError(error);
      }
      throw error;
    }
  });

  return { name: toolName };
}
