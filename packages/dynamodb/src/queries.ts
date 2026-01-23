import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { fabricService } from "@jaypie/fabric";

import { getDocClient, getTableName } from "./client.js";
import {
  ARCHIVED_SUFFIX,
  DELETED_SUFFIX,
  INDEX_ALIAS,
  INDEX_CATEGORY,
  INDEX_SCOPE,
  INDEX_TYPE,
  INDEX_XID,
} from "./constants.js";
import {
  buildIndexAlias,
  buildIndexCategory,
  buildIndexScope,
  buildIndexType,
  buildIndexXid,
} from "./keyBuilders.js";
import type { BaseQueryOptions, StorableEntity, QueryResult } from "./types.js";

/**
 * Calculate the suffix based on archived/deleted flags
 * When both are true, returns combined suffix (archived first, alphabetically)
 */
function calculateSuffix({
  archived,
  deleted,
}: {
  archived?: boolean;
  deleted?: boolean;
}): string {
  if (archived && deleted) {
    return ARCHIVED_SUFFIX + DELETED_SUFFIX;
  }
  if (archived) {
    return ARCHIVED_SUFFIX;
  }
  if (deleted) {
    return DELETED_SUFFIX;
  }
  return "";
}

/**
 * Execute a GSI query with common options
 */
async function executeQuery<T extends StorableEntity>(
  indexName: string,
  keyValue: string,
  options: BaseQueryOptions = {},
): Promise<QueryResult<T>> {
  const { ascending = false, limit, startKey } = options;

  const docClient = getDocClient();
  const tableName = getTableName();

  const command = new QueryCommand({
    ExclusiveStartKey: startKey as Record<string, unknown> | undefined,
    ExpressionAttributeNames: {
      "#pk": indexName,
    },
    ExpressionAttributeValues: {
      ":pkValue": keyValue,
    },
    IndexName: indexName,
    KeyConditionExpression: "#pk = :pkValue",
    ...(limit && { Limit: limit }),
    ScanIndexForward: ascending,
    TableName: tableName,
  });

  const response = await docClient.send(command);

  return {
    items: (response.Items ?? []) as T[],
    lastEvaluatedKey: response.LastEvaluatedKey,
  };
}

/**
 * Query parameters for queryByScope
 */
interface QueryByScopeParams extends BaseQueryOptions {
  model: string;
  scope: string;
}

/**
 * Query entities by scope (parent hierarchy)
 * Uses indexScope GSI
 *
 * Note: This is a regular async function (not fabricService) because it accepts
 * complex startKey objects that can't be coerced by vocabulary's type system.
 */
export async function queryByScope({
  archived = false,
  ascending = false,
  deleted = false,
  limit,
  model,
  scope,
  startKey,
}: QueryByScopeParams): Promise<QueryResult<StorableEntity>> {
  const suffix = calculateSuffix({ archived, deleted });
  const keyValue = buildIndexScope(scope, model) + suffix;
  return executeQuery<StorableEntity>(INDEX_SCOPE, keyValue, {
    ascending,
    limit,
    startKey,
  });
}

/**
 * Query a single entity by human-friendly alias
 * Uses indexAlias GSI
 */
export const queryByAlias = fabricService({
  alias: "queryByAlias",
  description: "Query a single entity by human-friendly alias",
  input: {
    alias: { type: String, description: "Human-friendly alias" },
    archived: {
      type: Boolean,
      default: false,
      required: false,
      description: "Query archived entities instead of active ones",
    },
    deleted: {
      type: Boolean,
      default: false,
      required: false,
      description: "Query deleted entities instead of active ones",
    },
    model: { type: String, description: "Entity model name" },
    scope: { type: String, description: "Scope (@ for root)" },
  },
  service: async ({
    alias,
    archived,
    deleted,
    model,
    scope,
  }): Promise<StorableEntity | null> => {
    const aliasStr = alias as string;
    const archivedBool = archived as boolean | undefined;
    const deletedBool = deleted as boolean | undefined;
    const modelStr = model as string;
    const scopeStr = scope as string;

    const suffix = calculateSuffix({
      archived: archivedBool,
      deleted: deletedBool,
    });
    const keyValue = buildIndexAlias(scopeStr, modelStr, aliasStr) + suffix;
    const result = await executeQuery<StorableEntity>(INDEX_ALIAS, keyValue, {
      limit: 1,
    });
    return result.items[0] ?? null;
  },
});

/**
 * Query parameters for queryByCategory
 */
interface QueryByCategoryParams extends BaseQueryOptions {
  category: string;
  model: string;
  scope: string;
}

/**
 * Query entities by category classification
 * Uses indexCategory GSI
 *
 * Note: This is a regular async function (not fabricService) because it accepts
 * complex startKey objects that can't be coerced by vocabulary's type system.
 */
export async function queryByCategory({
  archived = false,
  ascending = false,
  category,
  deleted = false,
  limit,
  model,
  scope,
  startKey,
}: QueryByCategoryParams): Promise<QueryResult<StorableEntity>> {
  const suffix = calculateSuffix({ archived, deleted });
  const keyValue = buildIndexCategory(scope, model, category) + suffix;
  return executeQuery<StorableEntity>(INDEX_CATEGORY, keyValue, {
    ascending,
    limit,
    startKey,
  });
}

/**
 * Query parameters for queryByType
 */
interface QueryByTypeParams extends BaseQueryOptions {
  model: string;
  scope: string;
  type: string;
}

/**
 * Query entities by type classification
 * Uses indexType GSI
 *
 * Note: This is a regular async function (not fabricService) because it accepts
 * complex startKey objects that can't be coerced by vocabulary's type system.
 */
export async function queryByType({
  archived = false,
  ascending = false,
  deleted = false,
  limit,
  model,
  scope,
  startKey,
  type,
}: QueryByTypeParams): Promise<QueryResult<StorableEntity>> {
  const suffix = calculateSuffix({ archived, deleted });
  const keyValue = buildIndexType(scope, model, type) + suffix;
  return executeQuery<StorableEntity>(INDEX_TYPE, keyValue, {
    ascending,
    limit,
    startKey,
  });
}

/**
 * Query a single entity by external ID
 * Uses indexXid GSI
 */
export const queryByXid = fabricService({
  alias: "queryByXid",
  description: "Query a single entity by external ID",
  input: {
    archived: {
      type: Boolean,
      default: false,
      required: false,
      description: "Query archived entities instead of active ones",
    },
    deleted: {
      type: Boolean,
      default: false,
      required: false,
      description: "Query deleted entities instead of active ones",
    },
    model: { type: String, description: "Entity model name" },
    scope: { type: String, description: "Scope (@ for root)" },
    xid: { type: String, description: "External ID" },
  },
  service: async ({
    archived,
    deleted,
    model,
    scope,
    xid,
  }): Promise<StorableEntity | null> => {
    const archivedBool = archived as boolean | undefined;
    const deletedBool = deleted as boolean | undefined;
    const modelStr = model as string;
    const scopeStr = scope as string;
    const xidStr = xid as string;

    const suffix = calculateSuffix({
      archived: archivedBool,
      deleted: deletedBool,
    });
    const keyValue = buildIndexXid(scopeStr, modelStr, xidStr) + suffix;
    const result = await executeQuery<StorableEntity>(INDEX_XID, keyValue, {
      limit: 1,
    });
    return result.items[0] ?? null;
  },
});
