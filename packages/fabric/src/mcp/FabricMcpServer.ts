// FabricMcpServer - Standalone MCP server for multi-service tool registration

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { isService } from "../service.js";
import type { Service, ServiceFunction } from "../types.js";
import { fabricMcp } from "./fabricMcp.js";
import type {
  FabricMcpServer as FabricMcpServerType,
  FabricMcpServerConfig,
  FabricMcpServerServiceEntry,
  FabricMcpServerToolConfig,
  RegisteredTool,
} from "./types.js";

/**
 * Check if entry is a FabricMcpServerToolConfig (has service property in object form)
 */
function isToolConfig(
  entry: FabricMcpServerServiceEntry,
): entry is FabricMcpServerToolConfig {
  return (
    typeof entry === "object" &&
    entry !== null &&
    "service" in entry &&
    !("$fabric" in entry) // Not a Service (which also has service property)
  );
}

/**
 * Check if entry is a Service (fabricated service with $fabric marker)
 */
function isServiceEntry(entry: FabricMcpServerServiceEntry): entry is Service {
  return isService(entry);
}

/**
 * Create a standalone MCP server with multi-service tool registration
 *
 * Routes multiple FabricService instances as MCP tools:
 * - Creates an McpServer instance with the given name and version
 * - Registers each service as a tool using fabricMcp
 * - Attaches metadata for introspection
 *
 * @example
 * ```typescript
 * import { FabricMcpServer } from "@jaypie/fabric/mcp";
 * import { fabricService } from "@jaypie/fabric";
 *
 * const greetService = fabricService({
 *   alias: "greet",
 *   description: "Greet a user by name",
 *   input: { name: { type: String } },
 *   service: ({ name }) => `Hello, ${name}!`,
 * });
 *
 * const echoService = fabricService({
 *   alias: "echo",
 *   description: "Echo back the input",
 *   input: { message: { type: String } },
 *   service: ({ message }) => message,
 * });
 *
 * const server = FabricMcpServer({
 *   name: "my-mcp-server",
 *   version: "1.0.0",
 *   services: [
 *     greetService,
 *     echoService,
 *     { service: anotherService, name: "custom-name" },
 *   ],
 * });
 * ```
 */
export function FabricMcpServer(
  config: FabricMcpServerConfig,
): FabricMcpServerType {
  const {
    name,
    onComplete: serverOnComplete,
    onError: serverOnError,
    onFatal: serverOnFatal,
    onMessage: serverOnMessage,
    services,
    version,
  } = config;

  // Create the MCP server
  const mcpServer = new McpServer({ name, version });

  // Track registered services and tools
  const registeredServices: Service[] = [];
  const registeredTools: RegisteredTool[] = [];

  // Register each service as a tool
  for (const entry of services) {
    let service: Service | ServiceFunction<Record<string, unknown>, unknown>;
    let toolName: string | undefined;
    let toolDescription: string | undefined;
    let entryOnComplete = serverOnComplete;
    let entryOnError = serverOnError;
    let entryOnFatal = serverOnFatal;
    let entryOnMessage = serverOnMessage;

    if (isToolConfig(entry)) {
      // Tool config with explicit settings
      service = entry.service;
      toolName = entry.name;
      toolDescription = entry.description;
      // Entry-level callbacks override server-level
      entryOnComplete = entry.onComplete ?? serverOnComplete;
      entryOnError = entry.onError ?? serverOnError;
      entryOnFatal = entry.onFatal ?? serverOnFatal;
      entryOnMessage = entry.onMessage ?? serverOnMessage;
    } else if (isServiceEntry(entry)) {
      // Pre-fabricated service
      service = entry;
    } else if (typeof entry === "function") {
      // Inline function (will be wrapped by fabricMcp)
      service = entry;
    } else {
      throw new Error(
        "FabricMcpServer: Each service entry must be a Service, ServiceFunction, or { service: Service }",
      );
    }

    // Register the tool
    const result = fabricMcp({
      description: toolDescription,
      name: toolName,
      onComplete: entryOnComplete,
      onError: entryOnError,
      onFatal: entryOnFatal,
      onMessage: entryOnMessage,
      server: mcpServer,
      service,
    });

    // Track the registered service and tool info
    // Note: fabricMcp resolves the service internally, so we track what we can
    if (isServiceEntry(entry)) {
      registeredServices.push(entry);
      registeredTools.push({
        description: toolDescription ?? entry.description ?? "",
        name: result.name,
        service: entry,
      });
    } else if (isToolConfig(entry) && isService(entry.service)) {
      registeredServices.push(entry.service);
      registeredTools.push({
        description: toolDescription ?? entry.service.description ?? "",
        name: result.name,
        service: entry.service,
      });
    }
  }

  // Attach metadata to server
  const server = mcpServer as FabricMcpServerType;
  server.name = name;
  server.services = registeredServices;
  server.tools = registeredTools;
  server.version = version;

  return server;
}

/**
 * Check if a value is a FabricMcpServer
 */
export function isFabricMcpServer(
  value: unknown,
): value is FabricMcpServerType {
  return (
    typeof value === "object" &&
    value !== null &&
    value instanceof McpServer &&
    "services" in value &&
    Array.isArray((value as FabricMcpServerType).services) &&
    "tools" in value &&
    Array.isArray((value as FabricMcpServerType).tools) &&
    "name" in value &&
    "version" in value
  );
}
