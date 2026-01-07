// LLM adapter types for @jaypie/vocabulary

import type { ServiceHandlerFunction } from "../types.js";

/**
 * Configuration for creating an LLM tool from a service handler
 */
export interface CreateLlmToolConfig {
  /** The service handler to adapt */
  handler: ServiceHandlerFunction;
  /** Override the tool name (defaults to handler.alias) */
  name?: string;
  /** Override the tool description (defaults to handler.description) */
  description?: string;
  /** Custom message for logging (string or function) */
  message?: string | ((args?: Record<string, unknown>) => string);
  /** Fields to exclude from the tool parameters */
  exclude?: string[];
}

/**
 * LLM tool interface (compatible with @jaypie/llm Toolkit)
 */
export interface LlmTool {
  description: string;
  name: string;
  parameters: Record<string, unknown>;
  type: "function" | string;
  call: (args?: Record<string, unknown>) => Promise<unknown> | unknown;
  message?:
    | string
    | ((
        args?: Record<string, unknown>,
        context?: { name: string },
      ) => Promise<string> | string);
}

/**
 * Result of creating an LLM tool
 */
export interface CreateLlmToolResult {
  tool: LlmTool;
}
