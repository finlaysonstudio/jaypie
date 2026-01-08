import { QueryCommand } from "@aws-sdk/lib-dynamodb";

import { getDocClient, getTableName } from "./client.js";
import {
  ARCHIVED_SUFFIX,
  DELETED_SUFFIX,
  INDEX_ALIAS,
  INDEX_CLASS,
  INDEX_OU,
  INDEX_TYPE,
  INDEX_XID,
} from "./constants.js";
import {
  buildIndexAlias,
  buildIndexClass,
  buildIndexOu,
  buildIndexType,
  buildIndexXid,
} from "./keyBuilders.js";
import type {
  BaseQueryOptions,
  FabricEntity,
  QueryByAliasParams,
  QueryByClassParams,
  QueryByOuParams,
  QueryByTypeParams,
  QueryByXidParams,
  QueryResult,
} from "./types.js";

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
async function executeQuery<T extends FabricEntity>(
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
 * Query entities by organizational unit (parent hierarchy)
 * Uses indexOu GSI
 *
 * @param params.archived - Query archived entities instead of active ones
 * @param params.deleted - Query deleted entities instead of active ones
 * @throws ConfigurationError if both archived and deleted are true
 */
export async function queryByOu<T extends FabricEntity = FabricEntity>(
  params: QueryByOuParams,
): Promise<QueryResult<T>> {
  const { archived, deleted, model, ou, ...options } = params;
  const suffix = calculateSuffix({ archived, deleted });
  const keyValue = buildIndexOu(ou, model) + suffix;
  return executeQuery<T>(INDEX_OU, keyValue, options);
}

/**
 * Query a single entity by human-friendly alias
 * Uses indexAlias GSI
 *
 * @param params.archived - Query archived entities instead of active ones
 * @param params.deleted - Query deleted entities instead of active ones
 * @throws ConfigurationError if both archived and deleted are true
 * @returns The matching entity or null if not found
 */
export async function queryByAlias<T extends FabricEntity = FabricEntity>(
  params: QueryByAliasParams,
): Promise<T | null> {
  const { alias, archived, deleted, model, ou } = params;
  const suffix = calculateSuffix({ archived, deleted });
  const keyValue = buildIndexAlias(ou, model, alias) + suffix;
  const result = await executeQuery<T>(INDEX_ALIAS, keyValue, { limit: 1 });
  return result.items[0] ?? null;
}

/**
 * Query entities by category classification
 * Uses indexClass GSI
 *
 * @param params.archived - Query archived entities instead of active ones
 * @param params.deleted - Query deleted entities instead of active ones
 * @throws ConfigurationError if both archived and deleted are true
 */
export async function queryByClass<T extends FabricEntity = FabricEntity>(
  params: QueryByClassParams,
): Promise<QueryResult<T>> {
  const { archived, deleted, model, ou, recordClass, ...options } = params;
  const suffix = calculateSuffix({ archived, deleted });
  const keyValue = buildIndexClass(ou, model, recordClass) + suffix;
  return executeQuery<T>(INDEX_CLASS, keyValue, options);
}

/**
 * Query entities by type classification
 * Uses indexType GSI
 *
 * @param params.archived - Query archived entities instead of active ones
 * @param params.deleted - Query deleted entities instead of active ones
 * @throws ConfigurationError if both archived and deleted are true
 */
export async function queryByType<T extends FabricEntity = FabricEntity>(
  params: QueryByTypeParams,
): Promise<QueryResult<T>> {
  const { archived, deleted, model, ou, type, ...options } = params;
  const suffix = calculateSuffix({ archived, deleted });
  const keyValue = buildIndexType(ou, model, type) + suffix;
  return executeQuery<T>(INDEX_TYPE, keyValue, options);
}

/**
 * Query a single entity by external ID
 * Uses indexXid GSI
 *
 * @param params.archived - Query archived entities instead of active ones
 * @param params.deleted - Query deleted entities instead of active ones
 * @throws ConfigurationError if both archived and deleted are true
 * @returns The matching entity or null if not found
 */
export async function queryByXid<T extends FabricEntity = FabricEntity>(
  params: QueryByXidParams,
): Promise<T | null> {
  const { archived, deleted, model, ou, xid } = params;
  const suffix = calculateSuffix({ archived, deleted });
  const keyValue = buildIndexXid(ou, model, xid) + suffix;
  const result = await executeQuery<T>(INDEX_XID, keyValue, { limit: 1 });
  return result.items[0] ?? null;
}
