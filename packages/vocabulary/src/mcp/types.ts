// MCP adapter types for @jaypie/vocabulary

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";

import type { ServiceHandlerFunction } from "../types.js";

/**
 * Configuration for registering an MCP tool from a service handler
 */
export interface RegisterMcpToolConfig {
  /** The service handler to adapt */
  handler: ServiceHandlerFunction;
  /** The MCP server to register the tool with */
  server: McpServer;
  /** Override the tool name (defaults to handler.alias) */
  name?: string;
  /** Override the tool description (defaults to handler.description) */
  description?: string;
  /** Fields to exclude from the tool parameters */
  exclude?: string[];
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
 * Zod schema record type for MCP tool parameters
 */
export type ZodSchemaRecord = Record<string, z.ZodTypeAny>;

/**
 * Result of registering an MCP tool
 */
export interface RegisterMcpToolResult {
  name: string;
}
