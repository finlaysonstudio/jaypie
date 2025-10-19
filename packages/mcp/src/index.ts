#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./createMcpServer.js";

// Version will be injected during build
const version = "0.0.0";

async function main() {
  const server = createMcpServer(version);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is running on stdio
}

// Only run main() if this module is executed directly (not imported)
// This handles npx and symlinks in node_modules/.bin correctly
if (process.argv[1]) {
  const realPath = realpathSync(process.argv[1]);
  const realPathAsUrl = pathToFileURL(realPath).href;
  if (import.meta.url === realPathAsUrl) {
    main();
  }
}

export { createMcpServer } from "./createMcpServer.js";
export {
  mcpExpressHandler,
  type McpExpressHandlerOptions,
} from "./mcpExpressHandler.js";
