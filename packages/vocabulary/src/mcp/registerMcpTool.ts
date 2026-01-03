// Register a service handler as an MCP tool

import { inputToZodSchema } from "./inputToZodSchema.js";
import type { RegisterMcpToolConfig, RegisterMcpToolResult } from "./types.js";

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
 * Register a vocabulary service handler as an MCP tool
 *
 * This function registers a service handler with an MCP server.
 * It automatically:
 * - Uses handler.alias as the tool name (or custom name)
 * - Uses handler.description as the tool description (or custom)
 * - Converts input definitions to Zod schema parameters
 * - Wraps the handler and formats the response
 *
 * @param config - Configuration including handler, server, and optional overrides
 * @returns An object containing the registered tool name
 *
 * @example
 * ```typescript
 * import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
 * import { serviceHandler } from "@jaypie/vocabulary";
 * import { registerMcpTool } from "@jaypie/vocabulary/mcp";
 *
 * const handler = serviceHandler({
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
 * registerMcpTool({ handler, server });
 * ```
 */
export function registerMcpTool(
  config: RegisterMcpToolConfig,
): RegisterMcpToolResult {
  const { description, exclude, handler, name, server } = config;

  // Determine tool name (priority: name > handler.alias > "tool")
  const toolName = name ?? handler.alias ?? "tool";

  // Determine tool description (priority: description > handler.description)
  const toolDescription = description ?? handler.description ?? "";

  // Convert input definitions to Zod schema
  const zodSchema = inputToZodSchema(handler.input, { exclude });

  // Register the tool with the MCP server
  server.tool(toolName, toolDescription, zodSchema, async (args) => {
    const result = await handler(args as Record<string, unknown>);

    return {
      content: [
        {
          text: formatResult(result),
          type: "text" as const,
        },
      ],
    };
  });

  return { name: toolName };
}
