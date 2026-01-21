// MCP adapter types for @jaypie/fabric

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

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
 * Configuration for fabricating an MCP tool from a service
 *
 * Supports two patterns:
 * 1. Pre-instantiated service: `{ server, service: myService }`
 * 2. Inline service definition: `{ server, alias, description, input, service: (input) => result }`
 *
 * When passing a pre-instantiated Service, `alias`, `description`, and `input` act as overrides.
 */
export interface FabricMcpConfig {
  /** Service alias (used as tool name if `name` not provided) - for inline or override */
  alias?: string;
  /** Override the tool description (defaults to service.description) */
  description?: string;
  /** Input field definitions - for inline service or override */
  input?: Record<string, InputFieldDefinition>;
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
  /** The MCP server to register the tool with */
  server: McpServer;
  /** The service - either a pre-instantiated Service or an inline function */
  service: Service | ServiceFunction<Record<string, unknown>, unknown>;
}

/**
 * MCP tool response content item
 */
export interface McpToolContentItem {
  text: string;
  type: "text";
}

/**
 * MCP tool response
 */
export interface McpToolResponse {
  content: McpToolContentItem[];
}

/**
 * Result of fabricating an MCP tool
 */
export interface FabricMcpResult {
  name: string;
}

// =============================================================================
// FabricMcpServer Types
// =============================================================================

/**
 * Service entry for FabricMcpServer - either a raw Service or a tool config
 */
export interface FabricMcpServerToolConfig {
  /** Override the service description */
  description?: string;
  /** Override the tool name */
  name?: string;
  /** Callback called when tool completes successfully */
  onComplete?: OnCompleteCallback;
  /** Callback for recoverable errors */
  onError?: OnErrorCallback;
  /** Callback for fatal errors */
  onFatal?: OnFatalCallback;
  /** Callback for receiving messages from service */
  onMessage?: OnMessageCallback;
  /** The service to register as a tool */
  service: Service | ServiceFunction<Record<string, unknown>, unknown>;
}

/**
 * Service entry type for FabricMcpServer services array
 */
export type FabricMcpServerServiceEntry =
  | Service
  | ServiceFunction<Record<string, unknown>, unknown>
  | FabricMcpServerToolConfig;

/**
 * Registered tool information
 */
export interface RegisteredTool {
  /** Tool description */
  description: string;
  /** Tool name */
  name: string;
  /** The resolved service */
  service: Service;
}

/**
 * Configuration for FabricMcpServer
 */
export interface FabricMcpServerConfig {
  /** Server name */
  name: string;
  /** Server-level callbacks applied to all tools */
  onComplete?: OnCompleteCallback;
  /** Server-level error callback applied to all tools */
  onError?: OnErrorCallback;
  /** Server-level fatal callback applied to all tools */
  onFatal?: OnFatalCallback;
  /** Server-level message callback applied to all tools */
  onMessage?: OnMessageCallback;
  /** Array of services to register as tools */
  services: FabricMcpServerServiceEntry[];
  /** Server version */
  version: string;
}

/**
 * FabricMcpServer type - McpServer with attached metadata
 */
export interface FabricMcpServer extends McpServer {
  /** Server name */
  name: string;
  /** Array of registered services */
  services: Service[];
  /** Array of registered tool information */
  tools: RegisteredTool[];
  /** Server version */
  version: string;
}
