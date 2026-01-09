import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMcpTool } from "@jaypie/vocabulary/mcp";
import { serviceHandler, type ServiceHandlerFunction } from "@jaypie/vocabulary";

import {
  archiveEntity,
  deleteEntity,
  destroyEntity,
  getEntity,
  putEntity,
  queryByAlias,
  queryByClass,
  queryByOu,
  queryByType,
  queryByXid,
  updateEntity,
} from "../index.js";
import type { FabricEntity } from "../types.js";
import {
  createTableHandler,
  dockerComposeHandler,
  statusHandler,
} from "./admin/index.js";
import { ensureInitialized } from "./autoInit.js";

export interface RegisterDynamoDbToolsConfig {
  /** MCP server to register tools with */
  server: McpServer;
  /** Include admin tools (create_table, docker_compose, status). Default: true */
  includeAdmin?: boolean;
}

export interface RegisterDynamoDbToolsResult {
  /** Names of registered tools */
  tools: string[];
}

/**
 * Wrap a handler to auto-initialize before execution
 */
function wrapWithInit(
  handler: ServiceHandlerFunction,
): ServiceHandlerFunction {
  const wrapped = async (input: Record<string, unknown>) => {
    ensureInitialized();
    return handler(input);
  };
  // Preserve handler properties for MCP registration
  Object.assign(wrapped, {
    alias: handler.alias,
    description: handler.description,
    input: handler.input,
  });
  return wrapped as ServiceHandlerFunction;
}

// MCP-specific serviceHandler wrappers for functions with complex inputs
// Note: These wrap the regular async functions to make them work with registerMcpTool

/**
 * MCP wrapper for putEntity
 * Accepts entity JSON directly from LLM
 */
const mcpPutEntity = serviceHandler({
  alias: "dynamodb_put",
  description: "Create or replace an entity in DynamoDB (auto-indexes GSI keys)",
  input: {
    // Required entity fields
    id: { type: String, description: "Entity ID (sort key)" },
    model: { type: String, description: "Entity model name (partition key)" },
    name: { type: String, description: "Entity name" },
    ou: { type: String, description: "Organizational unit (@ for root)" },
    // Optional fields
    alias: { type: String, required: false, description: "Human-friendly alias" },
    class: { type: String, required: false, description: "Category classification" },
    type: { type: String, required: false, description: "Type classification" },
    xid: { type: String, required: false, description: "External ID" },
  },
  service: async (input) => {
    const now = new Date().toISOString();
    const entity: FabricEntity = {
      alias: input.alias as string | undefined,
      class: input.class as string | undefined,
      createdAt: now,
      id: input.id as string,
      model: input.model as string,
      name: input.name as string,
      ou: input.ou as string,
      sequence: Date.now(),
      type: input.type as string | undefined,
      updatedAt: now,
      xid: input.xid as string | undefined,
    };
    return putEntity({ entity });
  },
});

/**
 * MCP wrapper for updateEntity
 * Accepts entity JSON directly from LLM
 */
const mcpUpdateEntity = serviceHandler({
  alias: "dynamodb_update",
  description: "Update an entity in DynamoDB (sets updatedAt, re-indexes GSI keys)",
  input: {
    // Required fields to identify the entity
    id: { type: String, description: "Entity ID (sort key)" },
    model: { type: String, description: "Entity model name (partition key)" },
    // Fields that can be updated
    name: { type: String, required: false, description: "Entity name" },
    ou: { type: String, required: false, description: "Organizational unit" },
    alias: { type: String, required: false, description: "Human-friendly alias" },
    class: { type: String, required: false, description: "Category classification" },
    type: { type: String, required: false, description: "Type classification" },
    xid: { type: String, required: false, description: "External ID" },
  },
  service: async (input) => {
    // First get the existing entity
    const existing = await getEntity({
      id: input.id as string,
      model: input.model as string,
    });
    if (!existing) {
      return { error: "Entity not found", id: input.id, model: input.model };
    }
    // Merge updates
    const entity: FabricEntity = {
      ...existing,
      ...(input.alias !== undefined && { alias: input.alias as string }),
      ...(input.class !== undefined && { class: input.class as string }),
      ...(input.name !== undefined && { name: input.name as string }),
      ...(input.ou !== undefined && { ou: input.ou as string }),
      ...(input.type !== undefined && { type: input.type as string }),
      ...(input.xid !== undefined && { xid: input.xid as string }),
    };
    return updateEntity({ entity });
  },
});

/**
 * MCP wrapper for queryByOu
 * Note: Pagination via startKey is not exposed to MCP; use limit instead
 */
const mcpQueryByOu = serviceHandler({
  alias: "dynamodb_query_ou",
  description: "Query entities by organizational unit (parent hierarchy)",
  input: {
    model: { type: String, description: "Entity model name" },
    ou: { type: String, description: "Organizational unit (@ for root)" },
    archived: {
      type: Boolean,
      default: false,
      required: false,
      description: "Query archived entities instead of active ones",
    },
    ascending: {
      type: Boolean,
      default: false,
      required: false,
      description: "Sort ascending (oldest first)",
    },
    deleted: {
      type: Boolean,
      default: false,
      required: false,
      description: "Query deleted entities instead of active ones",
    },
    limit: {
      type: Number,
      required: false,
      description: "Maximum number of items to return",
    },
  },
  service: async (input) => {
    return queryByOu({
      archived: input.archived as boolean,
      ascending: input.ascending as boolean,
      deleted: input.deleted as boolean,
      limit: input.limit as number | undefined,
      model: input.model as string,
      ou: input.ou as string,
    });
  },
});

/**
 * MCP wrapper for queryByClass
 * Note: Pagination via startKey is not exposed to MCP; use limit instead
 */
const mcpQueryByClass = serviceHandler({
  alias: "dynamodb_query_class",
  description: "Query entities by category classification",
  input: {
    model: { type: String, description: "Entity model name" },
    ou: { type: String, description: "Organizational unit (@ for root)" },
    recordClass: { type: String, description: "Category classification" },
    archived: {
      type: Boolean,
      default: false,
      required: false,
      description: "Query archived entities instead of active ones",
    },
    ascending: {
      type: Boolean,
      default: false,
      required: false,
      description: "Sort ascending (oldest first)",
    },
    deleted: {
      type: Boolean,
      default: false,
      required: false,
      description: "Query deleted entities instead of active ones",
    },
    limit: {
      type: Number,
      required: false,
      description: "Maximum number of items to return",
    },
  },
  service: async (input) => {
    return queryByClass({
      archived: input.archived as boolean,
      ascending: input.ascending as boolean,
      deleted: input.deleted as boolean,
      limit: input.limit as number | undefined,
      model: input.model as string,
      ou: input.ou as string,
      recordClass: input.recordClass as string,
    });
  },
});

/**
 * MCP wrapper for queryByType
 * Note: Pagination via startKey is not exposed to MCP; use limit instead
 */
const mcpQueryByType = serviceHandler({
  alias: "dynamodb_query_type",
  description: "Query entities by type classification",
  input: {
    model: { type: String, description: "Entity model name" },
    ou: { type: String, description: "Organizational unit (@ for root)" },
    type: { type: String, description: "Type classification" },
    archived: {
      type: Boolean,
      default: false,
      required: false,
      description: "Query archived entities instead of active ones",
    },
    ascending: {
      type: Boolean,
      default: false,
      required: false,
      description: "Sort ascending (oldest first)",
    },
    deleted: {
      type: Boolean,
      default: false,
      required: false,
      description: "Query deleted entities instead of active ones",
    },
    limit: {
      type: Number,
      required: false,
      description: "Maximum number of items to return",
    },
  },
  service: async (input) => {
    return queryByType({
      archived: input.archived as boolean,
      ascending: input.ascending as boolean,
      deleted: input.deleted as boolean,
      limit: input.limit as number | undefined,
      model: input.model as string,
      ou: input.ou as string,
      type: input.type as string,
    });
  },
});

/**
 * Register all DynamoDB MCP tools with a server
 */
export function registerDynamoDbTools(
  config: RegisterDynamoDbToolsConfig,
): RegisterDynamoDbToolsResult {
  const { includeAdmin = true, server } = config;
  const tools: string[] = [];

  // Entity operations
  registerMcpTool({
    handler: wrapWithInit(getEntity),
    name: "dynamodb_get",
    server,
  });
  tools.push("dynamodb_get");

  registerMcpTool({
    handler: wrapWithInit(mcpPutEntity),
    name: "dynamodb_put",
    server,
  });
  tools.push("dynamodb_put");

  registerMcpTool({
    handler: wrapWithInit(mcpUpdateEntity),
    name: "dynamodb_update",
    server,
  });
  tools.push("dynamodb_update");

  registerMcpTool({
    handler: wrapWithInit(deleteEntity),
    name: "dynamodb_delete",
    server,
  });
  tools.push("dynamodb_delete");

  registerMcpTool({
    handler: wrapWithInit(archiveEntity),
    name: "dynamodb_archive",
    server,
  });
  tools.push("dynamodb_archive");

  registerMcpTool({
    handler: wrapWithInit(destroyEntity),
    name: "dynamodb_destroy",
    server,
  });
  tools.push("dynamodb_destroy");

  // Query operations
  registerMcpTool({
    handler: wrapWithInit(mcpQueryByOu),
    name: "dynamodb_query_ou",
    server,
  });
  tools.push("dynamodb_query_ou");

  registerMcpTool({
    handler: wrapWithInit(queryByAlias),
    name: "dynamodb_query_alias",
    server,
  });
  tools.push("dynamodb_query_alias");

  registerMcpTool({
    handler: wrapWithInit(mcpQueryByClass),
    name: "dynamodb_query_class",
    server,
  });
  tools.push("dynamodb_query_class");

  registerMcpTool({
    handler: wrapWithInit(mcpQueryByType),
    name: "dynamodb_query_type",
    server,
  });
  tools.push("dynamodb_query_type");

  registerMcpTool({
    handler: wrapWithInit(queryByXid),
    name: "dynamodb_query_xid",
    server,
  });
  tools.push("dynamodb_query_xid");

  // Admin tools (MCP-only)
  if (includeAdmin) {
    registerMcpTool({ handler: statusHandler, server });
    tools.push("dynamodb_status");

    registerMcpTool({ handler: createTableHandler, server });
    tools.push("dynamodb_create_table");

    registerMcpTool({ handler: dockerComposeHandler, server });
    tools.push("dynamodb_generate_docker_compose");
  }

  return { tools };
}

// Export individual handlers for direct use
export {
  createTableHandler,
  dockerComposeHandler,
  statusHandler,
} from "./admin/index.js";

export { ensureInitialized } from "./autoInit.js";
