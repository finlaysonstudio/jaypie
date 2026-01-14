// Create an LLM tool from a service

import type { Message, ServiceContext } from "../types.js";
import { inputToJsonSchema } from "./inputToJsonSchema.js";
import type {
  CreateLlmToolConfig,
  CreateLlmToolResult,
  LlmTool,
} from "./types.js";

/**
 * Create an LLM tool from a fabric service
 *
 * This function creates an LLM tool compatible with @jaypie/llm Toolkit.
 * It automatically:
 * - Uses handler.alias as the tool name (or custom name)
 * - Uses handler.description as the tool description (or custom)
 * - Converts input definitions to JSON Schema parameters
 * - Wraps the service as the tool's call function
 *
 * @param config - Configuration including handler and optional overrides
 * @returns An object containing the created LLM tool
 *
 * @example
 * ```typescript
 * import { createService } from "@jaypie/fabric";
 * import { createLlmTool } from "@jaypie/fabric/llm";
 * import { Toolkit } from "@jaypie/llm";
 *
 * const handler = createService({
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
export function createLlmTool(config: CreateLlmToolConfig): CreateLlmToolResult {
  const {
    description,
    exclude,
    handler,
    message,
    name,
    onComplete,
    onError,
    onFatal,
    onMessage,
  } = config;

  // Determine tool name (priority: name > handler.alias > "tool")
  const toolName = name ?? handler.alias ?? "tool";

  // Determine tool description (priority: description > handler.description)
  const toolDescription = description ?? handler.description ?? "";

  // Convert input definitions to JSON Schema
  const parameters = inputToJsonSchema(handler.input, { exclude });

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

  // Create the call function that invokes the service
  const call = async (args?: Record<string, unknown>): Promise<unknown> => {
    try {
      const result = await handler(args, context);

      // Call onComplete if provided
      if (onComplete) {
        try {
          await onComplete(result);
        } catch {
          // Swallow errors - callback failures should not halt execution
        }
      }

      return result;
    } catch (error) {
      // Any thrown error is fatal
      if (onFatal) {
        await onFatal(error);
      } else if (onError) {
        await onError(error);
      }
      throw error;
    }
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
