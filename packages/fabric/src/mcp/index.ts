// MCP adapter exports for @jaypie/fabric

export { fabricMcp } from "./fabricMcp.js";
export {
  createMcpServerFromSuite,
  FabricMcpServer,
  isFabricMcpServer,
} from "./FabricMcpServer.js";
export type { CreateMcpServerFromSuiteConfig } from "./FabricMcpServer.js";
export type {
  FabricMcpConfig,
  FabricMcpResult,
  FabricMcpServer as FabricMcpServerType,
  FabricMcpServerConfig,
  FabricMcpServerServiceEntry,
  FabricMcpServerToolConfig,
  McpToolContentItem,
  McpToolResponse,
  OnCompleteCallback,
  OnErrorCallback,
  OnFatalCallback,
  OnMessageCallback,
  RegisteredTool,
} from "./types.js";
