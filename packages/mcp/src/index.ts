#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpServer } from "./createMcpServer.js";

// Version will be injected during build
const version = "0.0.0";

// Parse command-line arguments
const args = process.argv.slice(2);
const verbose = args.includes("--verbose") || args.includes("-v");

// Logger for verbose mode (uses stderr to not interfere with JSON-RPC on stdout)
const log = {
  info: (message: string, ...args: unknown[]) => {
    if (verbose) {
      console.error(`[jaypie-mcp] ${message}`, ...args);
    }
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`[jaypie-mcp ERROR] ${message}`, ...args);
  },
};

let server: McpServer | null = null;
let isShuttingDown = false;

async function gracefulShutdown(exitCode = 0) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  log.info("Shutting down gracefully...");

  try {
    if (server) {
      await server.close();
      log.info("Server closed successfully");
    }
  } catch (error) {
    log.error("Error during shutdown:", error);
  } finally {
    process.exit(exitCode);
  }
}

async function main() {
  log.info("Starting Jaypie MCP server...");
  log.info(`Version: ${version}`);
  log.info(`Node version: ${process.version}`);
  log.info(`Verbose mode: ${verbose ? "enabled" : "disabled"}`);

  server = createMcpServer({ version, verbose });

  log.info("MCP server created successfully");

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log.info("Connected to stdio transport");
  log.info("Server is ready to accept requests");

  // Handle process termination signals
  process.on("SIGINT", () => {
    log.info("Received SIGINT signal");
    gracefulShutdown(0);
  });
  process.on("SIGTERM", () => {
    log.info("Received SIGTERM signal");
    gracefulShutdown(0);
  });

  // Handle stdio stream errors (but let transport handle normal stdin end/close)
  process.stdin.on("error", (error) => {
    if (error.message?.includes("EPIPE") || error.message?.includes("EOF")) {
      log.info("stdin closed");
      gracefulShutdown(0);
    }
  });

  process.stdout.on("error", (error) => {
    if (error.message?.includes("EPIPE")) {
      log.info("stdout pipe broken");
      gracefulShutdown(0);
    }
  });

  // Server is running on stdio
}

// Only run main() if this module is executed directly (not imported)
// This handles npx and symlinks in node_modules/.bin correctly
if (process.argv[1]) {
  const realPath = realpathSync(process.argv[1]);
  const realPathAsUrl = pathToFileURL(realPath).href;
  if (import.meta.url === realPathAsUrl) {
    main().catch((error) => {
      log.error("Fatal error:", error);
      process.exit(1);
    });
  }
}

export { createMcpServer } from "./createMcpServer.js";
export type { CreateMcpServerOptions } from "./createMcpServer.js";
export {
  mcpExpressHandler,
  type McpExpressHandlerOptions,
} from "./mcpExpressHandler.js";
