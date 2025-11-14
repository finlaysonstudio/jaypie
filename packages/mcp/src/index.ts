#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpServer } from "./createMcpServer.js";

// Version will be injected during build
const version = "0.0.0";

let server: McpServer | null = null;
let isShuttingDown = false;

async function gracefulShutdown(exitCode = 0) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  try {
    if (server) {
      await server.close();
    }
  } catch (error) {
    // Ignore errors during shutdown
  } finally {
    process.exit(exitCode);
  }
}

async function main() {
  server = createMcpServer(version);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Handle process termination signals
  process.on("SIGINT", () => gracefulShutdown(0));
  process.on("SIGTERM", () => gracefulShutdown(0));

  // Handle stdio stream errors (but let transport handle normal stdin end/close)
  process.stdin.on("error", (error) => {
    if (error.message?.includes("EPIPE") || error.message?.includes("EOF")) {
      gracefulShutdown(0);
    }
  });

  process.stdout.on("error", (error) => {
    if (error.message?.includes("EPIPE")) {
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
      console.error("Fatal error:", error);
      process.exit(1);
    });
  }
}

export { createMcpServer } from "./createMcpServer.js";
export {
  mcpExpressHandler,
  type McpExpressHandlerOptions,
} from "./mcpExpressHandler.js";
