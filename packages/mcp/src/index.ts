#!/usr/bin/env node
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

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { createMcpServer } from "./createMcpServer.js";
export {
  mcpExpressHandler,
  type McpExpressHandlerOptions,
} from "./mcpExpressHandler.js";
