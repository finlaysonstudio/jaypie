/* eslint-disable no-console -- MCP stdio: stderr is the only valid log channel; stdout is reserved for JSON-RPC */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { createMcpServerFromSuite } from "@jaypie/fabric/mcp";

import { suite } from "./suite.js";

export interface CreateMcpServerOptions {
  /**
   * Allowlist of tool names (service aliases) to expose. Omit to expose every
   * tool; an empty array exposes none.
   */
  services?: string[];
  version?: string;
  verbose?: boolean;
}

/**
 * Creates and configures an MCP server instance with Jaypie tools
 *
 * Uses ServiceSuite to register all services as MCP tools automatically.
 * Services are defined in suite.ts using fabricService and registered
 * by category. The createMcpServerFromSuite bridge converts them to
 * MCP tools with proper Zod schema validation.
 *
 * @param options - Configuration options (or legacy version string)
 * @returns Configured MCP server instance
 */
export function createMcpServer(
  options: CreateMcpServerOptions | string = {},
): McpServer {
  // Support legacy signature: createMcpServer(version: string)
  const config: CreateMcpServerOptions =
    typeof options === "string" ? { version: options } : options;

  const { services, version = "0.0.0", verbose = false } = config;

  if (verbose) {
    console.error("[jaypie-mcp] Creating MCP server instance from suite");
  }

  const server = createMcpServerFromSuite(suite, {
    name: suite.name,
    services,
    version,
  });

  if (verbose) {
    console.error(
      `[jaypie-mcp] Registered ${server.tools.length} tools from suite`,
    );
    console.error(`[jaypie-mcp] Categories: ${suite.categories.join(", ")}`);
  }

  return server;
}
