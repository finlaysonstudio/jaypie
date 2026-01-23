import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fabricMcp } from "@jaypie/fabric/mcp";
import { fabricService, type Service } from "@jaypie/fabric";

import {
  archiveEntity,
  deleteEntity,
  destroyEntity,
  getEntity,
  putEntity,
  queryByAlias,
  queryByCategory,
  queryByScope,
  queryByType,
  queryByXid,
  updateEntity,
} from "../index.js";
import type { StorableEntity } from "../types.js";
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
 * Uses explicit type assertion to allow any Service type to be wrapped
 */

function wrapWithInit(handler: Service<any, any, any>): Service {
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
  return wrapped as Service;
}

// MCP-specific serviceHandler wrappers for functions with complex inputs
// Note: These wrap the regular async functions to make them work with fabricMcp

/**
 * MCP wrapper for putEntity
 * Accepts entity JSON directly from LLM
 */
const mcpPutEntity = fabricService({
  alias: "dynamodb_put",
  description:
    "Create or replace an entity in DynamoDB (auto-indexes GSI keys)",
  input: {
    // Required entity fields
    id: { type: String, description: "Entity ID (sort key)" },
    model: { type: String, description: "Entity model name (partition key)" },
    name: { type: String, description: "Entity name" },
    scope: { type: String, description: "Scope (@ for root)" },
    // Optional fields
    alias: {
      type: String,
      required: false,
      description: "Human-friendly alias",
    },
    category: {
      type: String,
      required: false,
      description: "Category classification",
    },
    type: { type: String, required: false, description: "Type classification" },
    xid: { type: String, required: false, description: "External ID" },
  },
  service: async (input) => {
    const now = new Date().toISOString();
    const entity: StorableEntity = {
      alias: input.alias as string | undefined,
      category: input.category as string | undefined,
      createdAt: now,
      id: input.id as string,
      model: input.model as string,
      name: input.name as string,
      scope: input.scope as string,
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
const mcpUpdateEntity = fabricService({
  alias: "dynamodb_update",
  description:
    "Update an entity in DynamoDB (sets updatedAt, re-indexes GSI keys)",
  input: {
    // Required fields to identify the entity
    id: { type: String, description: "Entity ID (sort key)" },
    model: { type: String, description: "Entity model name (partition key)" },
    // Fields that can be updated
    name: { type: String, required: false, description: "Entity name" },
    scope: { type: String, required: false, description: "Scope" },
    alias: {
      type: String,
      required: false,
      description: "Human-friendly alias",
    },
    category: {
      type: String,
      required: false,
      description: "Category classification",
    },
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
    const entity: StorableEntity = {
      ...existing,
      ...(input.alias !== undefined && { alias: input.alias as string }),
      ...(input.category !== undefined && {
        category: input.category as string,
      }),
      ...(input.name !== undefined && { name: input.name as string }),
      ...(input.scope !== undefined && { scope: input.scope as string }),
      ...(input.type !== undefined && { type: input.type as string }),
      ...(input.xid !== undefined && { xid: input.xid as string }),
    };
    return updateEntity({ entity });
  },
});

/**
 * MCP wrapper for queryByScope
 * Note: Pagination via startKey is not exposed to MCP; use limit instead
 */
const mcpQueryByScope = fabricService({
  alias: "dynamodb_query_scope",
  description: "Query entities by scope (parent hierarchy)",
  input: {
    model: { type: String, description: "Entity model name" },
    scope: { type: String, description: "Scope (@ for root)" },
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
    return queryByScope({
      archived: input.archived as boolean,
      ascending: input.ascending as boolean,
      deleted: input.deleted as boolean,
      limit: input.limit as number | undefined,
      model: input.model as string,
      scope: input.scope as string,
    });
  },
});

/**
 * MCP wrapper for queryByCategory
 * Note: Pagination via startKey is not exposed to MCP; use limit instead
 */
const mcpQueryByCategory = fabricService({
  alias: "dynamodb_query_category",
  description: "Query entities by category classification",
  input: {
    category: { type: String, description: "Category classification" },
    model: { type: String, description: "Entity model name" },
    scope: { type: String, description: "Scope (@ for root)" },
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
    return queryByCategory({
      archived: input.archived as boolean,
      ascending: input.ascending as boolean,
      category: input.category as string,
      deleted: input.deleted as boolean,
      limit: input.limit as number | undefined,
      model: input.model as string,
      scope: input.scope as string,
    });
  },
});

/**
 * MCP wrapper for queryByType
 * Note: Pagination via startKey is not exposed to MCP; use limit instead
 */
const mcpQueryByType = fabricService({
  alias: "dynamodb_query_type",
  description: "Query entities by type classification",
  input: {
    model: { type: String, description: "Entity model name" },
    scope: { type: String, description: "Scope (@ for root)" },
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
      scope: input.scope as string,
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
  fabricMcp({
    service: wrapWithInit(getEntity),
    name: "dynamodb_get",
    server,
  });
  tools.push("dynamodb_get");

  fabricMcp({
    service: wrapWithInit(mcpPutEntity),
    name: "dynamodb_put",
    server,
  });
  tools.push("dynamodb_put");

  fabricMcp({
    service: wrapWithInit(mcpUpdateEntity),
    name: "dynamodb_update",
    server,
  });
  tools.push("dynamodb_update");

  fabricMcp({
    service: wrapWithInit(deleteEntity),
    name: "dynamodb_delete",
    server,
  });
  tools.push("dynamodb_delete");

  fabricMcp({
    service: wrapWithInit(archiveEntity),
    name: "dynamodb_archive",
    server,
  });
  tools.push("dynamodb_archive");

  fabricMcp({
    service: wrapWithInit(destroyEntity),
    name: "dynamodb_destroy",
    server,
  });
  tools.push("dynamodb_destroy");

  // Query operations
  fabricMcp({
    service: wrapWithInit(mcpQueryByScope),
    name: "dynamodb_query_scope",
    server,
  });
  tools.push("dynamodb_query_scope");

  fabricMcp({
    service: wrapWithInit(queryByAlias),
    name: "dynamodb_query_alias",
    server,
  });
  tools.push("dynamodb_query_alias");

  fabricMcp({
    service: wrapWithInit(mcpQueryByCategory),
    name: "dynamodb_query_category",
    server,
  });
  tools.push("dynamodb_query_category");

  fabricMcp({
    service: wrapWithInit(mcpQueryByType),
    name: "dynamodb_query_type",
    server,
  });
  tools.push("dynamodb_query_type");

  fabricMcp({
    service: wrapWithInit(queryByXid),
    name: "dynamodb_query_xid",
    server,
  });
  tools.push("dynamodb_query_xid");

  // Admin tools (MCP-only)
  if (includeAdmin) {
    fabricMcp({ service: statusHandler, server });
    tools.push("dynamodb_status");

    fabricMcp({ service: createTableHandler, server });
    tools.push("dynamodb_create_table");

    fabricMcp({ service: dockerComposeHandler, server });
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
