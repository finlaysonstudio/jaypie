// Mock implementations for @jaypie/vocabulary

import { createMockFunction } from "./utils";
import { lambdaHandler } from "./lambda";
import { getMessages } from "./aws";

// Status Type - re-export real values (no mocking needed)
export const STATUS_VALUES = [
  "canceled",
  "complete",
  "error",
  "pending",
  "processing",
  "queued",
  "sending",
] as const;

export type Status = (typeof STATUS_VALUES)[number];

export const StatusType = [...STATUS_VALUES] as (
  | "canceled"
  | "complete"
  | "error"
  | "pending"
  | "processing"
  | "queued"
  | "sending"
)[];

export function isStatus(value: unknown): value is Status {
  return (
    typeof value === "string" &&
    STATUS_VALUES.includes(value as (typeof STATUS_VALUES)[number])
  );
}

// Vocabulary types
type ServiceHandlerFunction = (
  input?: Record<string, unknown> | string,
) => Promise<unknown>;

interface ServiceHandlerFunctionWithMetadata extends ServiceHandlerFunction {
  alias?: string;
  description?: string;
  input?: Record<string, InputFieldDefinition>;
}

interface InputFieldDefinition {
  default?: unknown;
  description?: string;
  required?: boolean;
  type: unknown;
}

interface LambdaServiceHandlerOptions {
  chaos?: string;
  name?: string;
  secrets?: string[];
  setup?: ((...args: unknown[]) => void | Promise<void>)[];
  teardown?: ((...args: unknown[]) => void | Promise<void>)[];
  throw?: boolean;
  unavailable?: boolean;
  validate?: ((...args: unknown[]) => unknown | Promise<unknown>)[];
}

interface LambdaServiceHandlerConfig extends LambdaServiceHandlerOptions {
  handler: ServiceHandlerFunction;
}

// Handler function type - must match what lambdaHandler returns
type HandlerFunction = (...args: unknown[]) => unknown;

/**
 * Mock implementation of lambdaServiceHandler
 * Mirrors the real implementation: wraps a service handler for Lambda with getMessages processing
 */
export const lambdaServiceHandler = createMockFunction<
  (
    handlerOrConfig: ServiceHandlerFunction | LambdaServiceHandlerConfig,
    options?: LambdaServiceHandlerOptions,
  ) => HandlerFunction
>((handlerOrConfig, options = {}) => {
  // Normalize arguments
  let handler: ServiceHandlerFunction;
  let opts: LambdaServiceHandlerOptions;

  if (typeof handlerOrConfig === "function") {
    handler = handlerOrConfig;
    opts = options;
  } else {
    const { handler: configHandler, ...configOpts } = handlerOrConfig;
    handler = configHandler;
    opts = configOpts;
  }

  // Use handler.alias as the name for logging (can be overridden via options.name)
  const name = opts.name ?? (handler as { alias?: string }).alias;

  // Create the inner Lambda handler logic
  const innerHandler = async (event: unknown): Promise<unknown> => {
    // Extract messages from SQS/SNS event wrapper
    const messages = getMessages(event);

    // Process each message through the service handler
    const results: unknown[] = [];
    for (const message of messages) {
      const result = await handler(message as Record<string, unknown>);
      results.push(result);
    }

    // Return single result if only one message, otherwise return array
    if (results.length === 1) {
      return results[0];
    }
    return results;
  };

  // Wrap with lambdaHandler for lifecycle management
  return lambdaHandler(innerHandler, {
    chaos: opts.chaos,
    name,
    secrets: opts.secrets,
    setup: opts.setup,
    teardown: opts.teardown,
    throw: opts.throw,
    unavailable: opts.unavailable,
    validate: opts.validate,
  });
});

// LLM adapter types
interface LlmTool {
  call: (args?: Record<string, unknown>) => Promise<unknown> | unknown;
  description: string;
  message?:
    | string
    | ((
        args?: Record<string, unknown>,
        context?: { name: string },
      ) => Promise<string> | string);
  name: string;
  parameters: Record<string, unknown>;
  type: "function" | string;
}

interface CreateLlmToolConfig {
  description?: string;
  exclude?: string[];
  handler: ServiceHandlerFunctionWithMetadata;
  message?: string | ((args?: Record<string, unknown>) => string);
  name?: string;
}

interface CreateLlmToolResult {
  tool: LlmTool;
}

/**
 * Mock implementation of createLlmTool
 * Creates an LLM tool from a vocabulary service handler
 */
export const createLlmTool = createMockFunction<
  (config: CreateLlmToolConfig) => CreateLlmToolResult
>((config) => {
  const { description, handler, message, name } = config;

  const toolName = name ?? handler.alias ?? "tool";
  const toolDescription = description ?? handler.description ?? "";

  const tool: LlmTool = {
    call: async (args?: Record<string, unknown>): Promise<unknown> => {
      return handler(args);
    },
    description: toolDescription,
    name: toolName,
    parameters: {
      properties: {},
      required: [],
      type: "object",
    },
    type: "function",
  };

  if (message !== undefined) {
    tool.message = message;
  }

  return { tool };
});

/**
 * Mock implementation of inputToJsonSchema
 * Converts vocabulary input definitions to JSON Schema
 */
export const inputToJsonSchema = createMockFunction<
  (
    input?: Record<string, InputFieldDefinition>,
    options?: { exclude?: string[] },
  ) => Record<string, unknown>
>(() => ({
  properties: {},
  required: [],
  type: "object",
}));

// MCP adapter types
interface McpToolResponse {
  content: Array<{ text: string; type: "text" }>;
}

interface McpServer {
  tool: (
    name: string,
    description: string,
    schema: Record<string, unknown>,
    handler: (args: Record<string, unknown>) => Promise<McpToolResponse>,
  ) => void;
}

interface RegisterMcpToolConfig {
  description?: string;
  handler: ServiceHandlerFunctionWithMetadata;
  name?: string;
  server: McpServer;
}

interface RegisterMcpToolResult {
  name: string;
}

/**
 * Mock implementation of registerMcpTool
 * Registers a vocabulary service handler as an MCP tool
 */
export const registerMcpTool = createMockFunction<
  (config: RegisterMcpToolConfig) => RegisterMcpToolResult
>((config) => {
  const { description, handler, name, server } = config;

  const toolName = name ?? handler.alias ?? "tool";
  const toolDescription = description ?? handler.description ?? "";

  server.tool(
    toolName,
    toolDescription,
    {},
    async (args: Record<string, unknown>): Promise<McpToolResponse> => {
      const result = await handler(args);
      return {
        content: [
          {
            text: result === undefined || result === null ? "" : String(result),
            type: "text" as const,
          },
        ],
      };
    },
  );

  return { name: toolName };
});

