// Create an LLM tool from a service handler

import { inputToJsonSchema } from "./inputToJsonSchema.js";
import type {
  CreateLlmToolConfig,
  CreateLlmToolResult,
  LlmTool,
} from "./types.js";

/**
 * Create an LLM tool from a vocabulary service handler
 *
 * This function creates an LLM tool compatible with @jaypie/llm Toolkit.
 * It automatically:
 * - Uses handler.alias as the tool name (or custom name)
 * - Uses handler.description as the tool description (or custom)
 * - Converts input definitions to JSON Schema parameters
 * - Wraps the handler as the tool's call function
 *
 * @param config - Configuration including handler and optional overrides
 * @returns An object containing the created LLM tool
 *
 * @example
 * ```typescript
 * import { serviceHandler } from "@jaypie/vocabulary";
 * import { createLlmTool } from "@jaypie/vocabulary/llm";
 * import { Toolkit } from "@jaypie/llm";
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
 * const { tool } = createLlmTool({ handler });
 *
 * // Use with Toolkit
 * const toolkit = new Toolkit([tool]);
 * ```
 */
export function createLlmTool(
  config: CreateLlmToolConfig,
): CreateLlmToolResult {
  const { description, exclude, handler, message, name } = config;

  // Determine tool name (priority: name > handler.alias > "tool")
  const toolName = name ?? handler.alias ?? "tool";

  // Determine tool description (priority: description > handler.description)
  const toolDescription = description ?? handler.description ?? "";

  // Convert input definitions to JSON Schema
  const parameters = inputToJsonSchema(handler.input, { exclude });

  // Create the call function that invokes the handler
  const call = async (args?: Record<string, unknown>): Promise<unknown> => {
    return handler(args);
  };

  // Build the tool
  const tool: LlmTool = {
    call,
    description: toolDescription,
    name: toolName,
    parameters,
    type: "function",
  };

  // Add message if provided
  if (message !== undefined) {
    tool.message = message;
  }

  return { tool };
}
