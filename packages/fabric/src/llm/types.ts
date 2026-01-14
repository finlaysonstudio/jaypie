// LLM adapter types for @jaypie/fabric

import type { Message, Service } from "../types.js";

/** Callback called when tool completes successfully */
export type OnCompleteCallback = (response: unknown) => void | Promise<void>;

/** Callback called for recoverable errors (via context.onError) */
export type OnErrorCallback = (error: unknown) => void | Promise<void>;

/** Callback called for fatal errors (thrown or via context.onFatal) */
export type OnFatalCallback = (error: unknown) => void | Promise<void>;

/** Callback for receiving messages from service during execution */
export type OnMessageCallback = (message: Message) => void | Promise<void>;

/**
 * Configuration for creating an LLM tool from a service
 */
export interface CreateLlmToolConfig {
  /** Override the tool description (defaults to handler.description) */
  description?: string;
  /** Fields to exclude from the tool parameters */
  exclude?: string[];
  /** The service to adapt */
  handler: Service;
  /** Custom message for logging (string or function) */
  message?: string | ((args?: Record<string, unknown>) => string);
  /** Override the tool name (defaults to handler.alias) */
  name?: string;
  /** Callback called when tool completes successfully */
  onComplete?: OnCompleteCallback;
  /** Callback for recoverable errors (via context.onError) */
  onError?: OnErrorCallback;
  /** Callback for fatal errors (thrown or via context.onFatal) */
  onFatal?: OnFatalCallback;
  /** Callback for receiving messages from service */
  onMessage?: OnMessageCallback;
}

/**
 * LLM tool interface (compatible with @jaypie/llm Toolkit)
 */
export interface LlmTool {
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

/**
 * Result of creating an LLM tool
 */
export interface CreateLlmToolResult {
  tool: LlmTool;
}
