// MCP adapter types for @jaypie/fabric

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

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
 * Configuration for fabricating an MCP tool from a service
 */
export interface FabricMcpConfig {
  /** Override the tool description (defaults to service.description) */
  description?: string;
  /** Override the tool name (defaults to service.alias) */
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
  /** The service to adapt */
  service: Service;
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
