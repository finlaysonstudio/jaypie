// MCP adapter types for @jaypie/vocabulary

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ServiceHandlerFunction } from "../types.js";

/**
 * Configuration for registering an MCP tool from a service handler
 */
export interface RegisterMcpToolConfig {
  /** Override the tool description (defaults to handler.description) */
  description?: string;
  /** The service handler to adapt */
  handler: ServiceHandlerFunction;
  /** Override the tool name (defaults to handler.alias) */
  name?: string;
  /** The MCP server to register the tool with */
  server: McpServer;
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
 * Result of registering an MCP tool
 */
export interface RegisterMcpToolResult {
  name: string;
}
