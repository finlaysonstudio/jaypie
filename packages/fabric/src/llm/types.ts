// LLM adapter types for @jaypie/fabric

import type {
  InputFieldDefinition,
  Message,
  Service,
  ServiceFunction,
} from "../types.js";

/** Callback called when tool completes successfully */
export type OnCompleteCallback = (response: unknown) => void | Promise<void>;

/** Callback called for recoverable errors (via context.onError) */
export type OnErrorCallback = (error: unknown) => void | Promise<void>;

/** Callback called for fatal errors (thrown or via context.onFatal) */
export type OnFatalCallback = (error: unknown) => void | Promise<void>;

/** Callback for receiving messages from service during execution */
export type OnMessageCallback = (message: Message) => void | Promise<void>;

/**
 * Configuration for fabricating an LLM tool from a service
 *
 * Supports two patterns:
 * 1. Pre-instantiated service: `{ service: myService }`
 * 2. Inline service definition: `{ alias, description, input, service: (input) => result }`
 *
 * When passing a pre-instantiated Service, `alias`, `description`, and `input` act as overrides.
 */
export interface FabricToolConfig {
  /** Service alias (used as tool name if `name` not provided) - for inline or override */
  alias?: string;
  /** Override the tool description (defaults to service.description) */
  description?: string;
  /** Fields to exclude from the tool parameters */
  exclude?: string[];
  /** Input field definitions - for inline service or override */
  input?: Record<string, InputFieldDefinition>;
  /** Custom message for logging (string or function) */
  message?: string | ((args?: Record<string, unknown>) => string);
  /** Override the tool name (defaults to alias or service.alias) */
  name?: string;
  /** Callback called when tool completes successfully */
  onComplete?: OnCompleteCallback;
  /** Callback for recoverable errors (via context.onError) */
  onError?: OnErrorCallback;
  /** Callback for fatal errors (thrown or via context.onFatal) */
  onFatal?: OnFatalCallback;
  /** Callback for receiving messages from service */
  onMessage?: OnMessageCallback;
  /** The service - either a pre-instantiated Service or an inline function */
  service: Service | ServiceFunction<Record<string, unknown>, unknown>;
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
 * Result of fabricating an LLM tool
 */
export interface FabricToolResult {
  tool: LlmTool;
}
